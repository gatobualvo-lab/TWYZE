// Emails the team when someone submits the Guide's "Report a problem" form. The form's row is
// already saved to support_requests by the caller (via the regular RLS-scoped client) before this
// is invoked — this call is a best-effort notification on top of that, so losing it never loses
// the report itself, only the speed of noticing it. The message goes to support@trackwyze.com
// with Reply-To set to the reporting person's own address, so replying in a normal mail client
// goes straight to them — not back to the team's own inbox.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, emailLayout, EmailSendError, APP_URL } from '../_shared/sendgrid.ts';

const SUPPORT_INBOX = 'support@trackwyze.com';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_PAGE_LENGTH = 60;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const { message, page } = body as { message?: string; page?: string };
    if (!message?.trim()) return json({ error: 'message is required' }, 400);

    const apiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!apiKey) return json({ error: 'Email is not configured yet.' }, 503);

    // Fails closed: sending costs money and affects the sender's reputation, so a broken check blocks the email.
    const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_action: 'support_request.email',
      p_max: 10,
      p_window_seconds: 3600,
      p_anon_key: '',
    });
    if (rateLimitError || withinLimit !== true) return json({ error: 'rate_limited' }, 429);

    const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle();
    const fromEmail = profile?.email || user.email;
    if (!fromEmail) return json({ error: 'No email address on file' }, 400);
    const fromName = profile?.full_name || 'A TrackWyze user';

    const cleanMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    const cleanPage = page?.trim().slice(0, MAX_PAGE_LENGTH);
    // AdminPanel doesn't read a tab from the URL, so this links to the panel itself, not a
    // specific tab — Support Requests is one click away from there.
    const adminUrl = `${APP_URL}/admin`;

    const subject = `Support request from ${fromName}`;
    const bodyHtml = `
      <p style="margin:0 0 14px;">New support request:</p>
      <p style="margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(cleanMessage)}</p>
      <p style="margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(fromName)} (${escapeHtml(fromEmail)})</p>
      ${cleanPage ? `<p style="margin:0 0 4px;"><strong>Page:</strong> ${escapeHtml(cleanPage)}</p>` : ''}
      <p style="margin:14px 0 0;">Reply to this email to respond directly to them.</p>
    `;

    await sendEmail({
      apiKey,
      to: SUPPORT_INBOX,
      subject,
      html: emailLayout(escapeHtml(subject), bodyHtml, {
        cta: { label: 'Open in Admin Panel', url: adminUrl },
      }),
      text: `New support request from ${fromName} (${fromEmail})${cleanPage ? `\nPage: ${cleanPage}` : ''}\n\n${cleanMessage}\n\nReply to this email to respond directly to them.\n\nOpen in Admin Panel: ${adminUrl}`,
      replyTo: { email: fromEmail, name: fromName },
    });

    return json({ sent: true });
  } catch (err) {
    console.error('send-support-request-email error:', err);
    const status = err instanceof EmailSendError ? 502 : 500;
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status);
  }
});
