// Developer aid: look at the app as a Free, Starter or Business account without changing the real
// subscription. In the browser console on a local dev server:
//
//   localStorage.setItem('trackwyze_preview_plan', 'free')   // or 'starter', 'business', 'free-month'
//   localStorage.removeItem('trackwyze_preview_plan')         // back to the real plan, then reload
//
// It only exists in development builds: `import.meta.env.DEV` is replaced by `false` when the app is
// built for the live site, so this does nothing there.
import type { SubscriptionProfile } from './entitlements';

const KEY = 'trackwyze_preview_plan';
const DAY_MS = 24 * 60 * 60 * 1000;

export function withPreviewPlan<T extends SubscriptionProfile>(profile: T | null | undefined, now: Date = new Date()): T | null | undefined {
  if (!import.meta.env.DEV || !profile) return profile;
  let choice: string | null = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch {
    return profile;
  }
  const later = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();
  switch (choice) {
    case 'free':
      return { ...profile, subscription_status: 'expired', subscription_expiry: later(-5), trial_end_date: later(-40), current_billing_cycle: 'trial' };
    case 'starter':
      return { ...profile, subscription_status: 'active', subscription_expiry: later(20), current_billing_cycle: 'starter' };
    case 'business':
      return { ...profile, subscription_status: 'active', subscription_expiry: later(20), current_billing_cycle: 'business' };
    case 'free-month':
      return { ...profile, subscription_status: 'trial', trial_end_date: later(6), current_billing_cycle: 'trial' };
    default:
      return profile;
  }
}
