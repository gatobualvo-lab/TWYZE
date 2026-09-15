// Sends an announcement/update email to MANY users at once (an admin
// broadcast — new feature, maintenance notice, etc.). Unlike
// send-transactional-email, this never sends to the caller's own address;
// the recipient list is every user matching the requested audience filter.
// Follows send-payment-approved-email's admin-check pattern: the caller's
// own JWT-forwarded client verifies admin rights via check_user_role
// BEFORE a service-role client is used to look up every matching user's
// email — the JWT-forwarded client can't see other users' profiles under
// normal RLS, which is exactly the point. The admin's own client logs the
// send afterwards (see src/components/admin/BroadcastEmail.tsx), so this
// function doesn't touch the email_broadcasts table itself.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendBulkEmail, emailLayout, EmailSendError } from '../_shared/sendgrid.ts';

type Audience = 'all' | 'active' | 'trial' | 'expired';
const AUDIENCES: Audience[] = ['all', 'active', 'trial', 'expired'];

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(para => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: 'Not authenticated' }, 401);

    const { data: isAdmin } = await callerClient.rpc('check_user_role', { required_role: 'admin', user_id: caller.id });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const { subject, body: messageBody, audience } = body as { subject?: string; body?: string; audience?: string };

    if (!subject?.trim() || !messageBody?.trim()) {
      return json({ error: 'subject and body are required' }, 400);
    }
    if (!audience || !AUDIENCES.includes(audience as Audience)) {
      return json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` }, 400);
    }

    const apiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!apiKey) return json({ error: 'Email is not configured yet.' }, 503);

    const trimmedSubject = subject.trim().slice(0, MAX_SUBJECT_LENGTH);
    const trimmedBody = messageBody.trim().slice(0, MAX_BODY_LENGTH);

    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let query = adminClient.from('profiles').select('email').not('email', 'is', null);
    if (audience !== 'all') {
      query = query.eq('subscription_status', audience);
    }
    const { data: profiles, error: profilesError } = await query;
    if (profilesError) return json({ error: profilesError.message }, 500);

    const recipients = Array.from(new Set((profiles ?? []).map(p => p.email).filter((e): e is string => !!e)));
    if (recipients.length === 0) {
      return json({ sent: true, recipientCount: 0 });
    }

    await sendBulkEmail({
      apiKey,
      recipients,
      subject: trimmedSubject,
      html: emailLayout(escapeHtml(trimmedSubject), textToHtmlParagraphs(trimmedBody)),
      text: trimmedBody,
    });

    return json({ sent: true, recipientCount: recipients.length });
  } catch (err) {
    console.error('send-broadcast-email error:', err);
    const status = err instanceof EmailSendError ? 502 : 500;
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status);
  }
});
