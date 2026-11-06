// Sends a transactional email to the CALLING user's own address only —
// welcome (after signup), subscription-expiry-warning (triggered
// client-side the moment a lapse is detected, see
// src/services/subscription/subscriptionLapseService.ts),
// opportunity_alert (triggered client-side when a high-priority opportunity
// notification — low stock, an overdue invoice — is first published, see
// src/services/notifications/notificationSync.ts; title/body are supplied
// by the caller and HTML-escaped before being rendered), and
// password_changed (triggered client-side right after a successful
// AccountSettings password change — a security notice, not a confirmation
// gate, since the caller is already an authenticated session). Follows the
// create-checkout auth pattern: JWT forwarded, anon-key client, so RLS
// scopes every lookup to the caller's own profile automatically. For
// emails to a DIFFERENT user (e.g. an admin approving someone else's
// payment), see send-payment-approved-email instead — that one explicitly
// verifies admin rights before looking up someone else's data. For emails
// to MANY users at once (an admin announcement), see send-broadcast-email.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, emailLayout, EmailSendError, APP_URL, unsubscribeLinks } from '../_shared/sendgrid.ts';

type EmailType = 'welcome' | 'subscription_expiry_warning' | 'opportunity_alert' | 'password_changed';

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

// The expiry notice and the password-changed notice are about the account itself (the second is
// a security notice, not marketing), so both go out even to someone who has unsubscribed from the rest.
const ESSENTIAL: EmailType[] = ['subscription_expiry_warning', 'password_changed'];

function buildEmail(type: EmailType, name: string, alert: { title: string; body: string } | undefined, unsubscribeUrl: string): { subject: string; html: string; text: string } | null {
  const unsubscribe = { url: unsubscribeUrl, essential: ESSENTIAL.includes(type) };
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
        unsubscribe,
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
        unsubscribe,
      }),
      text: `Hi ${name || 'there'},\n\nYour TrackWyze subscription has expired. Renew soon to keep adding new records. Your records stay safe either way.\n\nRenew: ${renewUrl}`,
    };
  }
  if (type === 'password_changed') {
    const subject = 'Your TrackWyze password was changed';
    const changedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' });
    const bodyHtml = `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin:0 0 14px;">Your TrackWyze account password was changed on ${escapeHtml(changedAt)} (Nairobi time).</p>
      <p style="margin:0;">If this was you, no action is needed. If you didn't make this change, contact support right away — someone else may have access to your account.</p>
    `;
    return {
      subject,
      html: emailLayout(subject, bodyHtml, {
        preheader: "If this wasn't you, contact support right away.",
        unsubscribe,
      }),
      text: `Hi ${name || 'there'},\n\nYour TrackWyze account password was changed on ${changedAt} (Nairobi time).\n\nIf this was you, no action is needed. If you didn't make this change, contact support right away.`,
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
        unsubscribe,
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
    if (type !== 'welcome' && type !== 'subscription_expiry_warning' && type !== 'opportunity_alert' && type !== 'password_changed') {
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

    // Fails closed: sending costs money and affects the sender's reputation, so a broken check blocks the email.
    const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_action: 'email.transactional',
      p_max: 20,
      p_window_seconds: 3600,
      p_anon_key: '',
    });
    if (rateLimitError || withinLimit !== true) return json({ error: 'rate_limited' }, 429);

    const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle();

    // Someone who unsubscribed (or did not tick the box at signup) gets only the account notices.
    if (!ESSENTIAL.includes(type)) {
      const { data: prefs } = await supabase.from('notification_preferences').select('emails_unsubscribed').eq('user_id', user.id).maybeSingle();
      if (prefs?.emails_unsubscribed) return json({ sent: false, skipped: 'unsubscribed' });
    }

    const links = await unsubscribeLinks({ secret: Deno.env.get('UNSUBSCRIBE_SECRET'), userId: user.id, supabaseUrl: Deno.env.get('SUPABASE_URL') });
    const toEmail = profile?.email || user.email;
    if (!toEmail) return json({ error: 'No email address on file' }, 400);

    const content = buildEmail(type, profile?.full_name || '', alert, links.pageUrl);
    if (!content) return json({ error: 'Invalid email type' }, 400);

    await sendEmail({ apiKey, to: toEmail, subject: content.subject, html: content.html, text: content.text, unsubscribe: links });

    return json({ sent: true });
  } catch (err) {
    console.error('send-transactional-email error:', err);
    const status = err instanceof EmailSendError ? 502 : 500;
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status);
  }
});
