// Talks to the email-unsubscribe Edge Function from the page an email's "Unsubscribe" link opens.
// Nobody is logged in there; the signed token in the link (u = person, t = token) is the proof.

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-unsubscribe`;

export type UnsubscribeOutcome =
  | { kind: 'ok'; subscribed: boolean }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string };

const headers = (): Record<string, string> => {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return {
    'Content-Type': 'application/json',
    // Accepted whether or not the function checks for a login.
    ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}),
  };
};

async function read(response: Response): Promise<UnsubscribeOutcome> {
  const body = await response.json().catch(() => null);
  if (response.ok && body?.ok) return { kind: 'ok', subscribed: !!body.subscribed };
  const message = body?.error ?? 'Something went wrong. Please try again.';
  return response.status === 403 ? { kind: 'invalid', message } : { kind: 'error', message };
}

/** Whether the person is currently subscribed. Changes nothing. */
export async function checkEmailSubscription(userId: string, token: string): Promise<UnsubscribeOutcome> {
  try {
    const response = await fetch(`${BASE}?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`, { headers: headers() });
    return await read(response);
  } catch {
    return { kind: 'error', message: 'We could not reach TrackWyze. Check your connection and try again.' };
  }
}

export async function setEmailSubscription(userId: string, token: string, action: 'unsubscribe' | 'resubscribe'): Promise<UnsubscribeOutcome> {
  try {
    const response = await fetch(BASE, { method: 'POST', headers: headers(), body: JSON.stringify({ u: userId, t: token, action }) });
    return await read(response);
  } catch {
    return { kind: 'error', message: 'We could not reach TrackWyze. Check your connection and try again.' };
  }
}
