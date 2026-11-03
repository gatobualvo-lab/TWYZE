import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  APP_URL,
  UNSUBSCRIBE_PLACEHOLDER,
  emailLayout,
  isValidUnsubscribeToken,
  sendBulkEmail,
  sendEmail,
  unsubscribeLinks,
  unsubscribeToken,
  withTextFooter,
} from './_shared/sendgrid';
import { handleUnsubscribe, type PreferenceStore } from './_shared/emailPreferences';
import * as scheduled from './scheduled-emails/index';

const SECRET = 'a-long-random-secret-for-tests';
const USER = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

describe('unsubscribe tokens', () => {
  it('are the same every time for the same person, and different for another person or secret', async () => {
    const a = await unsubscribeToken(SECRET, USER);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await unsubscribeToken(SECRET, USER)).toBe(a);
    expect(await unsubscribeToken(SECRET, OTHER)).not.toBe(a);
    expect(await unsubscribeToken('another-secret', USER)).not.toBe(a);
  });

  it('only the real token for that person is accepted', async () => {
    const token = await unsubscribeToken(SECRET, USER);
    expect(await isValidUnsubscribeToken(SECRET, USER, token)).toBe(true);
    expect(await isValidUnsubscribeToken(SECRET, OTHER, token)).toBe(false); // someone else's id
    expect(await isValidUnsubscribeToken(SECRET, USER, token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'))).toBe(false);
    expect(await isValidUnsubscribeToken(SECRET, USER, token.slice(0, 10))).toBe(false);
    expect(await isValidUnsubscribeToken(SECRET, USER, '')).toBe(false);
    expect(await isValidUnsubscribeToken('', USER, token)).toBe(false);
    expect(await isValidUnsubscribeToken('wrong-secret', USER, token)).toBe(false);
  });
});

describe('unsubscribeLinks', () => {
  it('gives a page on the site and a one-click address for the mail app', async () => {
    const links = await unsubscribeLinks({ secret: SECRET, userId: USER, supabaseUrl: 'https://abc.supabase.co/' });
    const token = await unsubscribeToken(SECRET, USER);
    expect(links.pageUrl).toBe(`${APP_URL}/unsubscribe?u=${USER}&t=${token}`);
    expect(links.oneClickUrl).toBe(`https://abc.supabase.co/functions/v1/email-unsubscribe?u=${USER}&t=${token}`);
  });

  it('without the secret set, still offers the in-app settings rather than no option at all', async () => {
    const links = await unsubscribeLinks({ secret: undefined, userId: USER, supabaseUrl: 'https://abc.supabase.co' });
    expect(links.pageUrl).toBe(`${APP_URL}/?tab=notifications`);
    expect(links.oneClickUrl).toBeUndefined();
  });
});

describe('the unsubscribe option in the email', () => {
  it('is a visible link in the footer', () => {
    const html = emailLayout('Title', '<p>Hi</p>', { unsubscribe: { url: 'https://trackwyze.com/unsubscribe?u=1&t=2' } });
    expect(html).toMatch(/<a href="https:\/\/trackwyze\.com\/unsubscribe\?u=1&amp;t=2"[^>]*>Unsubscribe from these emails<\/a>/);
    expect(html).not.toContain('payment receipts');
  });

  it('on a payment receipt it says receipts keep coming and offers email preferences', () => {
    const html = emailLayout('Payment', '<p>Thanks</p>', { unsubscribe: { url: 'https://x.test/u', essential: true } });
    expect(html).toContain('You will still get payment receipts and account notices.');
    expect(html).toContain('>Email preferences</a>');
  });

  it('is left out only when none is given', () => {
    expect(emailLayout('Title', '<p>Hi</p>')).not.toMatch(/nsubscribe/);
  });

  it('can hold the placeholder that SendGrid replaces for each person in an announcement', () => {
    const html = emailLayout('News', '<p>Hi</p>', { unsubscribe: { url: UNSUBSCRIBE_PLACEHOLDER } });
    expect(html).toContain(`href="${UNSUBSCRIBE_PLACEHOLDER}"`);
  });

  it('the plain-text version names the address too', () => {
    expect(withTextFooter('Hello', 'https://x.test/u')).toContain('Unsubscribe: https://x.test/u');
    expect(withTextFooter('Hello')).not.toContain('Unsubscribe');
  });
});

describe('sending', () => {
  afterEach(() => vi.restoreAllMocks());

  const capture = () => {
    const calls: Array<{ body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)) });
      return { ok: true, text: async () => '' } as Response;
    }));
    return calls;
  };

  it('a single email carries the one-click Unsubscribe header', async () => {
    const calls = capture();
    await sendEmail({
      apiKey: 'k', to: 'a@b.test', subject: 'S', html: '<p>x</p>', text: 'x',
      unsubscribe: { pageUrl: 'https://x.test/page', oneClickUrl: 'https://x.test/one' },
    });
    expect(calls[0].body.headers).toEqual({ 'List-Unsubscribe': '<https://x.test/one>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    const text = (calls[0].body.content as Array<{ value: string }>)[0].value;
    expect(text).toContain('Unsubscribe: https://x.test/page');
  });

  it('an announcement gives every recipient their own link', async () => {
    const calls = capture();
    await sendBulkEmail({
      apiKey: 'k',
      subject: 'News',
      html: `<a href="${UNSUBSCRIBE_PLACEHOLDER}">u</a>`,
      text: 'news',
      recipients: [
        { email: 'a@x.test', unsubscribe: { pageUrl: 'https://p/a', oneClickUrl: 'https://o/a' } },
        { email: 'b@x.test', unsubscribe: { pageUrl: 'https://p/b', oneClickUrl: 'https://o/b' } },
        'c@x.test',
      ],
    });
    const people = calls[0].body.personalizations as Array<{ to: Array<{ email: string }>; substitutions: Record<string, string>; headers?: Record<string, string> }>;
    expect(people.map(p => p.substitutions[UNSUBSCRIBE_PLACEHOLDER])).toEqual(['https://p/a', 'https://p/b', `${APP_URL}/?tab=notifications`]);
    expect(people[0].headers?.['List-Unsubscribe']).toBe('<https://o/a>');
    expect(people[1].headers?.['List-Unsubscribe']).toBe('<https://o/b>');
    expect(people[2].headers).toBeUndefined();
    expect(JSON.stringify(calls[0].body)).not.toContain('b@x.test"},{"email":"a@x.test'); // addresses are not shared between recipients
  });
});

function fakeStore(initial: Record<string, boolean>) {
  const data = { ...initial };
  const writes: Array<[string, boolean]> = [];
  const store: PreferenceStore = {
    isUnsubscribed: async (id) => (id in data ? data[id] : null),
    setUnsubscribed: async (id, value) => {
      data[id] = value;
      writes.push([id, value]);
    },
  };
  return { store, data, writes };
}

const request = (method: string, query: string, body = '', contentType: string | null = null) => ({
  method,
  url: `https://x.supabase.co/functions/v1/email-unsubscribe${query}`,
  text: async () => body,
  contentType,
});

describe('handleUnsubscribe', () => {
  const link = async (id = USER) => `?u=${id}&t=${await unsubscribeToken(SECRET, id)}`;

  it('opening the link only reports the state; it changes nothing (link scanners open links)', async () => {
    const { store, writes } = fakeStore({ [USER]: false });
    const result = await handleUnsubscribe(request('GET', await link()), SECRET, store);
    expect(result).toEqual({ status: 200, body: { ok: true, subscribed: true } });
    expect(writes).toEqual([]);
  });

  it('the confirm button unsubscribes, and Resubscribe undoes it', async () => {
    const { store, data } = fakeStore({ [USER]: false });
    const out = await handleUnsubscribe(request('POST', await link(), JSON.stringify({ action: 'unsubscribe' }), 'application/json'), SECRET, store);
    expect(out).toEqual({ status: 200, body: { ok: true, subscribed: false } });
    expect(data[USER]).toBe(true);
    const back = await handleUnsubscribe(request('POST', await link(), JSON.stringify({ action: 'resubscribe' }), 'application/json'), SECRET, store);
    expect(back.body.subscribed).toBe(true);
    expect(data[USER]).toBe(false);
  });

  it('the details can come in the body instead of the address', async () => {
    const { store, data } = fakeStore({ [USER]: false });
    const token = await unsubscribeToken(SECRET, USER);
    await handleUnsubscribe(request('POST', '', JSON.stringify({ u: USER, t: token, action: 'unsubscribe' }), 'application/json'), SECRET, store);
    expect(data[USER]).toBe(true);
  });

  it('the mail app\'s one-click button unsubscribes', async () => {
    const { store, data } = fakeStore({ [USER]: false });
    const out = await handleUnsubscribe(request('POST', await link(), 'List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded'), SECRET, store);
    expect(out.status).toBe(200);
    expect(data[USER]).toBe(true);
  });

  it('doing it twice is fine and does not write twice', async () => {
    const { store, writes } = fakeStore({ [USER]: true });
    const out = await handleUnsubscribe(request('POST', await link(), JSON.stringify({ action: 'unsubscribe' }), 'application/json'), SECRET, store);
    expect(out.body.subscribed).toBe(false);
    expect(writes).toEqual([]);
  });

  it('refuses a wrong, missing or someone else\'s token, and a person who does not exist', async () => {
    const { store, writes } = fakeStore({ [USER]: false, [OTHER]: false });
    const stolen = `?u=${OTHER}&t=${await unsubscribeToken(SECRET, USER)}`;
    for (const query of [`?u=${USER}&t=bad`, `?u=${USER}`, '', stolen, `?u=not-a-uuid&t=x`]) {
      const out = await handleUnsubscribe(request('POST', query, JSON.stringify({ action: 'unsubscribe' }), 'application/json'), SECRET, store);
      expect(out.status).toBe(403);
    }
    const ghost = '00000000-0000-4000-8000-000000000000';
    expect((await handleUnsubscribe(request('GET', await link(ghost)), SECRET, store)).status).toBe(403);
    expect(writes).toEqual([]);
  });

  it('a POST that does not say what to do is rejected, other methods too', async () => {
    const { store } = fakeStore({ [USER]: false });
    expect((await handleUnsubscribe(request('POST', await link(), '{}', 'application/json'), SECRET, store)).status).toBe(400);
    expect((await handleUnsubscribe(request('POST', await link(), 'nonsense', 'text/plain'), SECRET, store)).status).toBe(400);
    expect((await handleUnsubscribe(request('POST', await link(), 'not json', 'application/json'), SECRET, store)).status).toBe(400);
    expect((await handleUnsubscribe(request('DELETE', await link()), SECRET, store)).status).toBe(405);
  });

  it('says so plainly when the secret is not set up', async () => {
    const { store } = fakeStore({ [USER]: false });
    expect((await handleUnsubscribe(request('GET', await link()), undefined, store)).status).toBe(503);
  });
});

describe('scheduled-emails keeps an identical copy of the unsubscribe code', () => {
  it('layout, footer text and tokens match', async () => {
    const options = { unsubscribe: { url: 'https://x.test/u?a=1&b=2' }, cta: { label: 'Go', url: APP_URL } };
    expect(scheduled.emailLayout('T', '<p>x</p>', options)).toBe(emailLayout('T', '<p>x</p>', options));
    const essential = { unsubscribe: { url: 'https://x.test/u', essential: true } };
    expect(scheduled.emailLayout('T', '<p>x</p>', essential)).toBe(emailLayout('T', '<p>x</p>', essential));
    expect(scheduled.withTextFooter('Hi', 'https://x.test/u')).toBe(withTextFooter('Hi', 'https://x.test/u'));
    expect(await scheduled.unsubscribeToken(SECRET, USER)).toBe(await unsubscribeToken(SECRET, USER));
    const params = { secret: SECRET, userId: USER, supabaseUrl: 'https://abc.supabase.co' };
    expect(await scheduled.unsubscribeLinks(params)).toEqual(await unsubscribeLinks(params));
  });

  it('the reminder and report emails carry the option', () => {
    const reminder = scheduled.buildReminderEmail('Amina', [{ title: 'Call', due_date: '2026-11-02', due_time: null }], 'https://x.test/u');
    expect(reminder.html).toContain('Unsubscribe from these emails');
    expect(reminder.html).toContain('https://x.test/u');
  });
});
