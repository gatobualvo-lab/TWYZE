// Shared with AccountSettings (subscription summary) and PaymentManagement
// (subscription summary + payment history) so the plan/status/cycle wording
// stays identical wherever it's shown instead of drifting between copies.

export type BillingPlanKey = 'month2-3' | 'month4+';

export interface BillingPlan {
  key: BillingPlanKey;
  label: string;
  amount: number;
  currency: 'KES';
  /** How many days a successful payment extends the subscription by. */
  durationDays: number;
}

/**
 * The only source of truth for what a plan actually costs. The
 * create-checkout Edge Function has its own copy of this exact table
 * (supabase/functions/create-checkout/plans.ts) because it runs in Deno and
 * can't import from src/ — keep the two in sync if prices ever change.
 * Client-supplied amounts are never trusted for billing; the Edge Function
 * looks up the price itself from its copy of this table.
 */
export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  'month2-3': { key: 'month2-3', label: 'Early Bird Plan', amount: 500, currency: 'KES', durationDays: 30 },
  'month4+': { key: 'month4+', label: 'Regular Plan', amount: 1000, currency: 'KES', durationDays: 30 },
};

export function getSubscriptionPlanLabel(status?: string, cycle?: string): string {
  if (!status) return 'Unknown';
  switch (status) {
    case 'trial':
      return 'Free Trial';
    case 'active':
      return cycle === 'month2-3' ? 'Early Bird Plan (KES 500/month)' : 'Regular Plan (KES 1000/month)';
    case 'expired':
      return 'Expired';
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
      return 'Trial';
    case 'expired':
      return 'Expired';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Unknown';
  }
}

export function getBillingCycleLabel(cycle?: string): string {
  switch (cycle) {
    case 'trial':
      return 'Free Trial';
    case 'month2-3':
      return 'Months 2-3 (KES 500/month)';
    case 'month4+':
      return 'Month 4+ (KES 1000/month)';
    default:
      return 'Unknown';
  }
}
