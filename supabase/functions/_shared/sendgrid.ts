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
        { type: 'text/plain', value: params.text },
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
          { type: 'text/plain', value: params.text },
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

export function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <div style="padding: 24px 0; text-align: center; border-bottom: 2px solid #f3f4f6;">
        <h1 style="font-size: 20px; margin: 0; color: #1e40af;">TrackWyze</h1>
      </div>
      <div style="padding: 24px 4px;">
        <h2 style="font-size: 18px; margin: 0 0 12px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding: 16px 4px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">
        TrackWyze — Track Smart. Profit Wise.
      </div>
    </div>
  `;
}
