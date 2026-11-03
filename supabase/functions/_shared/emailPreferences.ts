// What happens when someone follows an unsubscribe link or presses their mail app's Unsubscribe button.
// Kept apart from the Edge Function so it can be tested with a stand-in for the database.
import { isValidUnsubscribeToken } from './sendgrid.ts';

export interface PreferenceStore {
  /** Whether the person is currently unsubscribed, or null if there is no such person. */
  isUnsubscribed(userId: string): Promise<boolean | null>;
  setUnsubscribed(userId: string, unsubscribed: boolean): Promise<void>;
}

export type UnsubscribeAction = 'unsubscribe' | 'resubscribe';

export interface UnsubscribeResult {
  status: number;
  body: { ok?: boolean; subscribed?: boolean; error?: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET  ?u=&t=                    -> says whether the person is subscribed (changes nothing, so link
 *                                   scanners that open every link in an email cannot unsubscribe anyone)
 * POST ?u=&t=  {action}          -> the confirmation button on the page
 * POST ?u=&t=  List-Unsubscribe=One-Click -> the mail app's own Unsubscribe button
 */
export async function handleUnsubscribe(
  req: { method: string; url: string; text: () => Promise<string>; contentType: string | null },
  secret: string | undefined,
  store: PreferenceStore
): Promise<UnsubscribeResult> {
  if (!secret) return { status: 503, body: { error: 'Unsubscribe links are not set up yet.' } };

  const url = new URL(req.url);
  let userId = url.searchParams.get('u') ?? '';
  let token = url.searchParams.get('t') ?? '';
  let action: UnsubscribeAction | null = null;

  if (req.method === 'POST') {
    const raw = await req.text().catch(() => '');
    if ((req.contentType ?? '').includes('application/json')) {
      try {
        const parsed = JSON.parse(raw) as { u?: string; t?: string; action?: string };
        userId = parsed.u ?? userId;
        token = parsed.t ?? token;
        if (parsed.action === 'unsubscribe' || parsed.action === 'resubscribe') action = parsed.action;
      } catch {
        return { status: 400, body: { error: 'Bad request.' } };
      }
    } else if (raw.includes('List-Unsubscribe=One-Click')) {
      action = 'unsubscribe';
    }
    if (!action) return { status: 400, body: { error: 'Bad request.' } };
  } else if (req.method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  // The same answer for a malformed id, a wrong token and a person who does not exist.
  if (!UUID.test(userId) || !(await isValidUnsubscribeToken(secret, userId, token))) {
    return { status: 403, body: { error: 'This unsubscribe link is not valid. Please use the link in the latest email.' } };
  }

  const current = await store.isUnsubscribed(userId);
  if (current === null) return { status: 403, body: { error: 'This unsubscribe link is not valid. Please use the link in the latest email.' } };

  if (action) {
    const unsubscribed = action === 'unsubscribe';
    if (current !== unsubscribed) await store.setUnsubscribed(userId, unsubscribed);
    return { status: 200, body: { ok: true, subscribed: !unsubscribed } };
  }
  return { status: 200, body: { ok: true, subscribed: !current } };
}
