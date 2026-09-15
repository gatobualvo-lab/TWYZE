// Sends a payment-confirmation email after an ADMIN manually approves a
// payment submission (see src/services/admin/adminService.ts
// approvePaymentSubmission). Unlike send-transactional-email, the
// recipient here is a different person than the caller, so this function
// explicitly verifies the caller is an admin (via the existing
// check_user_role RPC) before using a service-role client to look up the
// target user's email — the JWT-forwarded client can't see another user's
// profile under normal RLS, which is exactly the point.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, emailLayout, EmailSendError } from '../_shared/sendgrid.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    const { userId, amount, currency, planLabel } = body as { userId?: string; amount?: number; currency?: string; planLabel?: string };
    if (!userId) return json({ error: 'userId is required' }, 400);

    const apiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!apiKey) return json({ error: 'Email is not configured yet.' }, 503);

    // Service-role only for this one elevated lookup — the caller's own
    // admin-ness was already verified above using their own JWT.
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await adminClient.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
    const toEmail = profile?.email;
    if (!toEmail) return json({ error: 'Target user has no email on file' }, 400);

    const amountLabel = amount && currency ? `${currency} ${amount.toLocaleString()}` : 'your payment';
    const subject = 'Payment confirmed — TrackWyze';
    const bodyHtml = `
      <p>Hi ${profile?.full_name || 'there'},</p>
      <p>We've confirmed ${amountLabel}${planLabel ? ` for the ${planLabel}` : ''}. Your TrackWyze subscription is active — thank you for staying with us.</p>
    `;

    await sendEmail({
      apiKey,
      to: toEmail,
      subject,
      html: emailLayout(subject, bodyHtml),
      text: `Hi ${profile?.full_name || 'there'},\n\nWe've confirmed ${amountLabel}. Your TrackWyze subscription is active.`,
    });

    return json({ sent: true });
  } catch (err) {
    console.error('send-payment-approved-email error:', err);
    const status = err instanceof EmailSendError ? 502 : 500;
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status);
  }
});
