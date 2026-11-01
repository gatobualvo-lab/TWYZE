// Minimal SendGrid v3 Mail Send wrapper. SENDGRID_API_KEY lives only as an
// Edge Function secret (see supabase/functions/README.md) — never in
// .env/.env.example, never VITE_-prefixed.

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const FROM_EMAIL = 'notifications@trackwyze.com';
const FROM_NAME = 'TrackWyze';

export class EmailSendError extends Error {}

export async function sendEmail(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: params.subject,
      content: [
        { type: 'text/plain', value: withTextFooter(params.text) },
        { type: 'text/html', value: params.html },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new EmailSendError(`SendGrid error ${response.status}: ${body.slice(0, 500)}`);
  }
}

const BULK_CHUNK_SIZE = 500;

// Same "to" is repeated as the from/subject/content for every recipient —
// this is a broadcast, not a personalized mail merge. One personalization
// per recipient (rather than one big BCC list) keeps each recipient's
// address private from the others. Chunked well under SendGrid's
// 1000-personalizations-per-request limit.
export async function sendBulkEmail(params: {
  apiKey: string;
  recipients: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  for (let i = 0; i < params.recipients.length; i += BULK_CHUNK_SIZE) {
    const chunk = params.recipients.slice(i, i + BULK_CHUNK_SIZE);
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: chunk.map(email => ({ to: [{ email }] })),
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: params.subject,
        content: [
          { type: 'text/plain', value: withTextFooter(params.text) },
          { type: 'text/html', value: params.html },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new EmailSendError(`SendGrid error ${response.status}: ${body.slice(0, 500)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Branded email template
//
// The same layout is used by every TrackWyze email. scheduled-emails/index.ts keeps its own
// copy (it is pasted into the Supabase dashboard as one file); a test checks the two stay
// identical, so change both together.
//
// Built from tables with inline styles, which is what Gmail, Outlook and phone mail apps all
// render reliably. The logo is a PNG on trackwyze.com (email apps do not show SVG).
// ---------------------------------------------------------------------------

export const APP_URL = 'https://trackwyze.com';
export const LOGO_URL = `${APP_URL}/logo/email-logo.png`;
const LOGO_WIDTH = 208;
const LOGO_HEIGHT = 48;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface EmailLayoutOptions {
  /** Preview text shown next to the subject in the inbox. */
  preheader?: string;
  /** A call-to-action button under the message. */
  cta?: { label: string; url: string };
  /** Why the person is getting this email; shown in the footer. */
  footerNote?: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** A button that stays a button in Outlook too. */
export function emailButton(label: string, url: string): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
          <tr>
            <td bgcolor="#0a7f56" style="border-radius:10px;">
              <a href="${escapeAttr(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeAttr(label)}</a>
            </td>
          </tr>
        </table>`;
}

/** `title` and `bodyHtml` are HTML; the caller escapes anything that came from a user. */
export function emailLayout(title: string, bodyHtml: string, options: EmailLayoutOptions = {}): string {
  const note = options.footerNote ?? 'You are receiving this email because you have a TrackWyze account.';
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef2f7;font-size:1px;line-height:1px;">${escapeAttr(options.preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>TrackWyze</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="#0f1b2d" style="background-color:#0f1b2d;padding:30px 24px 24px;">
              <a href="${APP_URL}" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="TrackWyze" style="display:block;margin:0 auto;border:0;outline:none;height:auto;font-family:${FONT};font-size:24px;font-weight:700;color:#ffffff;">
              </a>
              <div style="font-family:${FONT};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9fb0c8;margin-top:12px;">Track Smart. Profit Wise.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="78%" height="4" bgcolor="#0e9f6e" style="height:4px;background-color:#0e9f6e;font-size:0;line-height:0;">&nbsp;</td>
                <td height="4" bgcolor="#f5a524" style="height:4px;background-color:#f5a524;font-size:0;line-height:0;">&nbsp;</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 12px;font-family:${FONT};color:#374151;font-size:15px;line-height:1.65;">
              <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;color:#0f1b2d;">${title}</h1>
              ${bodyHtml}
              ${options.cta ? emailButton(options.cta.label, options.cta.url) : ''}
            </td>
          </tr>
          <tr>
            <td bgcolor="#f8fafc" style="background-color:#f8fafc;border-top:1px solid #e5e7eb;padding:22px 32px;font-family:${FONT};font-size:12px;line-height:1.7;color:#6b7280;text-align:center;">
              <strong style="color:#0f1b2d;">TrackWyze</strong> &middot; Track Smart. Profit Wise.<br>
              <a href="${APP_URL}" target="_blank" style="color:#0a7f56;text-decoration:none;font-weight:600;">trackwyze.com</a><br>
              ${note}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The plain-text version gets the same sign-off, so it is never a bare message. */
export function withTextFooter(text: string): string {
  const footer = `--\nTrackWyze - Track Smart. Profit Wise.\n${APP_URL}`;
  return `${text}\n\n${footer}`;
}
