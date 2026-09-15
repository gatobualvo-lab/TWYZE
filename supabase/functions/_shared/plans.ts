// Deno copy of src/utils/subscription.ts's BILLING_PLANS. Kept separate
// because Edge Functions run in Deno and can't import from src/, but the
// two MUST stay in sync — this is the table create-checkout trusts to price
// a checkout (client-supplied amounts are never trusted for billing).

export type BillingPlanKey = 'month2-3' | 'month4+';

export interface BillingPlan {
  key: BillingPlanKey;
  label: string;
  amount: number;
  currency: 'KES';
  durationDays: number;
}

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  'month2-3': { key: 'month2-3', label: 'Early Bird Plan', amount: 500, currency: 'KES', durationDays: 30 },
  'month4+': { key: 'month4+', label: 'Regular Plan', amount: 1000, currency: 'KES', durationDays: 30 },
};

export function isBillingPlanKey(value: unknown): value is BillingPlanKey {
  return value === 'month2-3' || value === 'month4+';
}
