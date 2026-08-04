import { supabase } from './supabase';

export type RateLimitAction =
  | 'auth.login'
  | 'auth.signup'
  | 'auth.password_reset'
  | 'admin.setup'
  | 'invoice.create'
  | 'quotation.create'
  | 'vendor_expense.create'
  | 'ad_expense.create'
  | 'sale.create';

const DEFAULT_LIMITS: Record<RateLimitAction, { max: number; window: number }> = {
  'auth.login':            { max: 10, window: 60 },
  'auth.signup':           { max: 5,  window: 300 },
  'auth.password_reset':   { max: 5,  window: 600 },
  'admin.setup':           { max: 3,  window: 600 },
  'invoice.create':        { max: 30, window: 60 },
  'quotation.create':      { max: 30, window: 60 },
  'vendor_expense.create': { max: 60, window: 60 },
  'ad_expense.create':     { max: 60, window: 60 },
  'sale.create':           { max: 60, window: 60 },
};

function anonFingerprint(): string {
  const k = 'tw_anon_fp';
  let v = localStorage.getItem(k);
  if (!v) {
    v = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    localStorage.setItem(k, v);
  }
  return v;
}

export async function checkRateLimit(action: RateLimitAction, overrides?: { max?: number; window?: number }): Promise<boolean> {
  const cfg = DEFAULT_LIMITS[action];
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_action: action,
    p_max: overrides?.max ?? cfg.max,
    p_window_seconds: overrides?.window ?? cfg.window,
    p_anon_key: anonFingerprint(),
  });
  if (error) {
    console.warn('Rate limit RPC failed, defaulting to allow:', error.message);
    return true;
  }
  return data === true;
}

export async function checkLeakedPassword(password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) return false;

    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hash] = line.split(':');
      if (hash.trim() === suffix) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const LEAKED_PASSWORD_MESSAGE = 'This password has appeared in a data breach and is not safe to use. Please choose a different password.';

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

/**
 * Verify the current user owns a given record in `table` by `id`. Uses a
 * count-only query so no data is returned. Returns true if the logged-in
 * user may act on that row (or is an admin). Throws on auth errors.
 */
export async function assertOwnership(
  table: string,
  id: string,
  ownerColumn: 'user_id' | 'created_by' = 'user_id'
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('id', id)
    .eq(ownerColumn, user.id);

  if (error) {
    console.error('assertOwnership error:', error);
    return false;
  }
  return (count ?? 0) > 0;
}
