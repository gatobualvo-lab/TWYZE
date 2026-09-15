import { supabase } from '../../utils/supabase';

// Detects and records subscription lapses for the current user, then
// derives what the app should show them. See migration
// 20260820150000_subscription_lapse_handling.sql for why this is called
// once per session rather than run as a cron job.

export type AccessLevel = 'full' | 'grace' | 'restricted';

/** Calls the self-scoped lapse-detection RPC and returns the (possibly just-updated) subscription_status. Fails safe: any error is swallowed and null returned, so a transient network issue never blocks the app from loading. */
export async function applyMySubscriptionLapse(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('apply_my_subscription_lapse');
    if (error) return null;
    return (data as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * 'full' — trial or active, everything works normally.
 * 'grace' — expired but still within the grace period: full functionality,
 *   but should nag the owner to renew.
 * 'restricted' — grace period elapsed (or an admin suspended the account):
 *   view-only, creation flows should redirect to a renewal prompt instead.
 */
export function computeAccessLevel(status: string | null | undefined): AccessLevel {
  if (status === 'restricted' || status === 'suspended') return 'restricted';
  if (status === 'expired') return 'grace';
  return 'full';
}
