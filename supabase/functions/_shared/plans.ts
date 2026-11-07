// Deno copy of src/utils/subscription.ts's BILLING_PLANS. Kept separate
// because Edge Functions run in Deno and can't import from src/, but the
// two MUST stay in sync — this is the table the payment functions trust to
// price a checkout (client-supplied amounts are never trusted for billing).
//
// Three tiers exist: Free (no payment), Starter and Business. The earlier
// 'month2-3' (KES 500) and 'month4+' (KES 1,000) plans are gone for new
// payments but may still be stored on a payment that was started before the
// change, so they are read as Starter and Business.

export type BillingPlanKey = 'starter' | 'business' | 'starter_yearly' | 'business_yearly';

export interface BillingPlan {
  key: BillingPlanKey;
  label: string;
  amount: number;
  currency: 'KES';
  durationDays: number;
}

// Yearly prices are 10x the monthly price (2 months free, ~17% off) rather than 12x.
export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  starter: { key: 'starter', label: 'Starter Plan', amount: 500, currency: 'KES', durationDays: 30 },
  business: { key: 'business', label: 'Business Plan', amount: 1000, currency: 'KES', durationDays: 30 },
  starter_yearly: { key: 'starter_yearly', label: 'Starter Plan (Yearly)', amount: 5000, currency: 'KES', durationDays: 365 },
  business_yearly: { key: 'business_yearly', label: 'Business Plan (Yearly)', amount: 10000, currency: 'KES', durationDays: 365 },
};

/** For a NEW payment: only the current plans are accepted. */
export function isBillingPlanKey(value: unknown): value is BillingPlanKey {
  return value === 'starter' || value === 'business' || value === 'starter_yearly' || value === 'business_yearly';
}

/** For a payment already on record: also understands the earlier plan keys. Unknown means Starter. */
export function normalizeStoredPlanKey(value: unknown): BillingPlanKey {
  if (isBillingPlanKey(value)) return value;
  if (value === 'month4+') return 'business';
  return 'starter';
}
