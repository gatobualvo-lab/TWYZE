import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendBulkEmail } from './_shared/sendgrid';

// Regression coverage: notifications@trackwyze.com only sends, it was never set up to receive mail —
// a reply to it bounces. Every send must carry a Reply-To that actually works.

function mockFetch(ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 202 : 400, text: () => Promise.resolve('') });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => mockFetch());
afterEach(() => vi.unstubAllGlobals());

describe('sendEmail', () => {
  it('sends from notifications@ but asks for replies at a real support address', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await sendEmail({ apiKey: 'k', to: 'customer@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from.email).toBe('notifications@trackwyze.com');
    expect(body.reply_to).toEqual({ email: 'support@trackwyze.com', name: 'TrackWyze' });
  });
});

describe('sendBulkEmail', () => {
  it('also carries the Reply-To on a bulk send', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await sendBulkEmail({ apiKey: 'k', recipients: ['a@example.com', 'b@example.com'], subject: 'News', html: '<p>hi</p>', text: 'hi' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_to).toEqual({ email: 'support@trackwyze.com', name: 'TrackWyze' });
  });
});
