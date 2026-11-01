// Sends a transactional email to the CALLING user's own address only —
// welcome (after signup), subscription-expiry-warning (triggered
// client-side the moment a lapse is detected, see
// src/services/subscription/subscriptionLapseService.ts), and
// opportunity_alert (triggered client-side when a high-priority opportunity
// notification — low stock, an overdue invoice — is first published, see
// src/services/notifications/notificationSync.ts; title/body are supplied
// by the caller and HTML-escaped before being rendered). Follows the
// create-checkout auth pattern: JWT forwarded, anon-key client, so RLS
// scopes every lookup to the caller's own profile automatically. For
// emails to a DIFFERENT user (e.g. an admin approving someone else's
// payment), see send-payment-approved-email instead — that one explicitly
// verifies admin rights before looking up someone else's data. For emails
// to MANY users at once (an admin announcement), see send-broadcast-email.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, emailLayout, EmailSendError, APP_URL } from '../_shared/sendgrid.ts';

type EmailType = 'welcome' | 'subscription_expiry_warning' | 'opportunity_alert';

const MAX_ALERT_FIELD_LENGTH = 300;

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

function buildEmail(type: EmailType, name: string, alert?: { title: string; body: string }): { subject: string; html: string; text: string } | null {
  if (type === 'welcome') {
    const subject = 'Welcome to TrackWyze';
    const bodyHtml = `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin:0 0 14px;">Your TrackWyze account is ready. Here is the quickest way to get going:</p>
      <ol style="margin:0 0 6px;padding-left:20px;">
        <li style="margin:0 0 6px;">Add your products under <strong>Inventory</strong>.</li>
        <li style="margin:0 0 6px;">Record your first sale under <strong>Sales</strong>.</li>
        <li style="margin:0 0 6px;">Watch your daily profit build up on the <strong>Dashboard</strong>.</li>
      </ol>
    `;
    return {
      subject,
      html: emailLayout(subject, bodyHtml, {
        preheader: 'Your account is ready. Add your products and record your first sale.',
        cta: { label: 'Open TrackWyze', url: APP_URL },
      }),
      text: `Hi ${name || 'there'},\n\nYour TrackWyze account is ready. Add your products, record your first sale, and watch your daily profit build up.\n\nOpen TrackWyze: ${APP_URL}`,
    };
  }
  if (type === 'subscription_expiry_warning') {
    const subject = 'Your TrackWyze subscription has expired';
    const renewUrl = `${APP_URL}/?tab=payment-management`;
    const bodyHtml = `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin:0 0 14px;">Your TrackWyze subscription has expired. You have a few days of grace before your account moves to view-only mode, so renew now to keep adding sales, expenses and stock.</p>
      <p style="margin:0;">Your records stay safe either way.</p>
    `;
    return {
      subject,
      html: emailLayout(subject, bodyHtml, {
        preheader: 'Renew to keep recording sales, expenses and stock.',
        cta: { label: 'Renew subscription', url: renewUrl },
      }),
      text: `Hi ${name || 'there'},\n\nYour TrackWyze subscription has expired. Renew soon to keep adding new records. Your records stay safe either way.\n\nRenew: ${renewUrl}`,
    };
  }
  if (type === 'opportunity_alert' && alert) {
    const subject = alert.title;
    const detailsUrl = `${APP_URL}/?tab=notifications`;
    const bodyHtml = `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin:0 0 6px;">${escapeHtml(alert.body)}</p>
    `;
    return {
      subject,
      html: emailLayout(escapeHtml(alert.title), bodyHtml, {
        preheader: alert.body,
        cta: { label: 'View details', url: detailsUrl },
      }),
      text: `Hi ${name || 'there'},\n\n${alert.body}\n\nView details: ${detailsUrl}`,
    };
  }
  return null;
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
    const { type, title, body: alertBody } = body as { type?: string; title?: string; body?: string };
    if (type !== 'welcome' && type !== 'subscription_expiry_warning' && type !== 'opportunity_alert') {
      return json({ error: 'Invalid email type' }, 400);
    }

    let alert: { title: string; body: string } | undefined;
    if (type === 'opportunity_alert') {
      if (!title?.trim() || !alertBody?.trim()) {
        return json({ error: 'title and body are required for opportunity_alert' }, 400);
      }
      alert = {
        title: title.trim().slice(0, MAX_ALERT_FIELD_LENGTH),
        body: alertBody.trim().slice(0, MAX_ALERT_FIELD_LENGTH),
      };
    }

    const apiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!apiKey) return json({ error: 'Email is not configured yet.' }, 503);

    const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle();
    const toEmail = profile?.email || user.email;
    if (!toEmail) return json({ error: 'No email address on file' }, 400);

    const content = buildEmail(type, profile?.full_name || '', alert);
    if (!content) return json({ error: 'Invalid email type' }, 400);

    await sendEmail({ apiKey, to: toEmail, subject: content.subject, html: content.html, text: content.text });

    return json({ sent: true });
  } catch (err) {
    console.error('send-transactional-email error:', err);
    const status = err instanceof EmailSendError ? 502 : 500;
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status);
  }
});
