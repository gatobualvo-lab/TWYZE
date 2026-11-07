// Shared with AccountSettings (subscription summary), PaymentManagement (plans + payment history),
// the landing page and the admin screens, so the plan names and prices read the same everywhere.
// What each tier includes lives in services/subscription/entitlements.ts.

export type BillingPlanKey = 'starter' | 'business' | 'starter_yearly' | 'business_yearly';

export interface BillingPlan {
  key: BillingPlanKey;
  label: string;
  amount: number;
  currency: 'KES';
  /** How many days a successful payment extends the subscription by. */
  durationDays: number;
}

/**
 * The only source of truth for what a plan costs. The payment Edge Functions have their own copy of
 * this exact table (supabase/functions/_shared/plans.ts) because they run in Deno and can't import
 * from src/ — keep the two in sync if prices ever change. Client-supplied amounts are never trusted
 * for billing; the Edge Functions look the price up themselves.
 *
 * There are three tiers: Free (no payment), Starter and Business, each payable monthly or yearly
 * (yearly is 10x the monthly price — 2 months free). The earlier 'month2-3' and 'month4+' plans no
 * longer exist; anyone still on one keeps their features until their paid month ends.
 */
export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  starter: { key: 'starter', label: 'Starter Plan', amount: 500, currency: 'KES', durationDays: 30 },
  business: { key: 'business', label: 'Business Plan', amount: 1000, currency: 'KES', durationDays: 30 },
  starter_yearly: { key: 'starter_yearly', label: 'Starter Plan (Yearly)', amount: 5000, currency: 'KES', durationDays: 365 },
  business_yearly: { key: 'business_yearly', label: 'Business Plan (Yearly)', amount: 10000, currency: 'KES', durationDays: 365 },
};

/** The plan a stored billing-cycle value stands for, including the two earlier plans. */
export function normalizePlanKey(value?: string | null): BillingPlanKey | null {
  if (value === 'starter' || value === 'business' || value === 'starter_yearly' || value === 'business_yearly') return value;
  if (value === 'month2-3') return 'starter';
  if (value === 'month4+') return 'business';
  return null;
}

export function getSubscriptionPlanLabel(status?: string, cycle?: string): string {
  if (!status) return 'Unknown';
  switch (status) {
    case 'trial':
      return 'Free month';
    case 'active':
      if (cycle === 'starter') return 'Starter (KES 500/month)';
      if (cycle === 'business') return 'Business (KES 1,000/month)';
      if (cycle === 'starter_yearly') return 'Starter (KES 5,000/year)';
      if (cycle === 'business_yearly') return 'Business (KES 10,000/year)';
      return 'Business features (earlier plan)';
    case 'expired':
    case 'restricted':
      return 'Free';
    case 'suspended':
      return 'Suspended';
    default:
      return status;
  }
}

export function getSubscriptionStatusLabel(status?: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trial':
      return 'Free month';
    case 'expired':
    case 'restricted':
      return 'Free plan';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Unknown';
  }
}

export function getBillingCycleLabel(cycle?: string): string {
  switch (cycle) {
    case 'trial':
      return 'Free month';
    case 'starter':
      return 'Starter (KES 500/month)';
    case 'business':
      return 'Business (KES 1,000/month)';
    case 'starter_yearly':
      return 'Starter (KES 5,000/year)';
    case 'business_yearly':
      return 'Business (KES 10,000/year)';
    case 'month2-3':
    case 'month4+':
      return 'Earlier plan';
    default:
      return 'Unknown';
  }
}
