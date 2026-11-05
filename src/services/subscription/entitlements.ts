// What an account may do, worked out in one place.
//
//   Month 1            completely free, every feature (the 30-day trial)
//   After that         three tiers that always exist:
//                        Free      KES 0      a small shop; limited, never locked out
//                        Starter   KES 500    run the shop day to day
//                        Business  KES 1,000  grow and control the business
//
// Anyone who paid under the old 500/1,000 plans keeps every feature until the month they paid
// for ends, then chooses a tier. A lapsed subscription drops to Free; nothing is ever deleted.

export type Tier = 'free' | 'starter' | 'business';

export const TIER_ORDER: Tier[] = ['free', 'starter', 'business'];

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  starter: 'Starter',
  business: 'Business',
};

export const TIER_PRICES: Record<Tier, number> = {
  free: 0,
  starter: 500,
  business: 1000,
};

/** The caps on the Free tier. Starter and Business have none of these (except users). */
export const FREE_LIMITS = {
  salesPerMonth: 40,
  products: 20,
  customers: 15,
  users: 1,
} as const;

export const BUSINESS_USER_LIMIT = 5;

export type LimitedResource = 'sales' | 'products' | 'customers' | 'users';

/** The lowest tier that includes each feature. Anything not listed is available on every tier. */
export const FEATURE_MIN_TIER = {
  // Starter: run the shop day to day
  'ad-expenses': 'starter',
  'expense-overview': 'starter',
  'customer-timeline': 'starter',
  'daily-closing': 'starter',
  'tax-report': 'starter',
  calendar: 'starter',
  'document-appearance': 'starter',
  'document-signature': 'starter',
  'no-document-watermark': 'starter',
  // Business: grow and control the business
  opportunities: 'business',
  advisor: 'business',
  goals: 'business',
  'monthly-dashboard': 'business',
  'profit-analytics': 'business',
  'data-export': 'business',
  'add-supplier': 'business',
  'view-suppliers': 'business',
  'vendor-transactions': 'business',
  'delivery-payments': 'business',
  'recurring-expenses': 'business',
  'recurring-invoices': 'business',
  services: 'business',
  'inventory-predictions': 'business',
  projects: 'business',
  team: 'business',
  'barcode-camera': 'business',
  'multi-currency': 'business',
  'product-performance': 'business',
  'emailed-reports': 'business',
  'ai-features': 'business',
} as const satisfies Record<string, Tier>;

export type Feature = keyof typeof FEATURE_MIN_TIER;

/** Short, plain-language names for the "upgrade" messages. */
export const FEATURE_NAMES: Record<Feature, string> = {
  'ad-expenses': 'Ad expenses',
  'expense-overview': 'Expense overview',
  'customer-timeline': 'Customer timeline',
  'daily-closing': 'Daily closing report',
  'tax-report': 'Tax report',
  calendar: 'Business calendar and reminders',
  'document-appearance': 'Document colours and layout',
  'document-signature': 'Signature and stamp on documents',
  'no-document-watermark': 'Documents without the TrackWyze line',
  opportunities: 'Opportunity centre',
  advisor: 'Business advisor',
  goals: 'Business goals',
  'monthly-dashboard': 'Monthly dashboard',
  'profit-analytics': 'Profit analytics',
  'data-export': 'Data export',
  'add-supplier': 'Wholesale sales',
  'view-suppliers': 'Wholesale dashboard',
  'vendor-transactions': 'Vendor transactions',
  'delivery-payments': 'Delivery payments',
  'recurring-expenses': 'Recurring expenses',
  'recurring-invoices': 'Recurring invoices',
  services: 'Services',
  'inventory-predictions': 'Smart inventory',
  projects: 'Projects',
  team: 'Team members',
  'barcode-camera': 'Camera barcode scanning',
  'multi-currency': 'Documents in other currencies',
  'product-performance': 'Performance by product and category',
  'emailed-reports': 'Emailed business reports',
  'ai-features': 'AI features',
};

/** What each tier is for, and what it adds, for the pricing and upgrade screens. */
export const TIER_PITCH: Record<Tier, { tagline: string; highlights: string[] }> = {
  free: {
    tagline: 'For a new or very small shop',
    highlights: [
      `Up to ${FREE_LIMITS.salesPerMonth} sales a month`,
      `Up to ${FREE_LIMITS.products} products`,
      `Up to ${FREE_LIMITS.customers} customers`,
      'Receipts, invoices and quotations',
      'Expenses and cash position',
      '1 user',
    ],
  },
  starter: {
    tagline: 'For a shop selling every day',
    highlights: [
      'Unlimited sales, products and customers',
      'Your own colours, logo and signature on documents',
      'No TrackWyze line on documents',
      'Daily closing report and calendar reminders',
      'Ad expenses and expense overview',
      'Tax report (VAT and Turnover Tax)',
    ],
  },
  business: {
    tagline: 'For a growing business with staff and suppliers',
    highlights: [
      'Everything in Starter',
      'Profit analytics and performance by product',
      'AI business advisor and receipt scanning',
      'Wholesale, vendor and delivery tracking',
      'Recurring invoices and expenses, emailed reports',
      'Up to 5 users',
    ],
  },
};

/** The small credit line on documents made on the Free plan. */
export const WATERMARK_TEXT = 'Created with TrackWyze · trackwyze.com';

export interface SubscriptionProfile {
  subscription_status?: string | null;
  subscription_expiry?: string | null;
  trial_end_date?: string | null;
  current_billing_cycle?: string | null;
}

export type TierSource = 'free-month' | 'paid' | 'earlier-plan' | 'free';

export interface Entitlements {
  tier: Tier;
  /** Why the account is on this tier. */
  source: TierSource;
  /** Whole days left of the free month, when that is what is giving access. */
  freeMonthDaysLeft: number | null;
  /** When a paid plan or an earlier plan's paid month ends, if there is one running. */
  paidUntil: string | null;
  /** An admin suspended the account: everything can be seen, nothing can be added. */
  suspended: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parse = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** The tier a plan key stands for. The two earlier plans (500 and 1,000) both keep every feature. */
export function tierForPlanKey(key?: string | null): Tier | null {
  if (key === 'starter') return 'starter';
  if (key === 'business') return 'business';
  if (key === 'month2-3' || key === 'month4+') return 'business';
  return null;
}

export function resolveEntitlements(profile: SubscriptionProfile | null | undefined, now: Date = new Date()): Entitlements {
  const status = profile?.subscription_status ?? null;
  const suspended = status === 'suspended';
  const free: Entitlements = { tier: 'free', source: 'free', freeMonthDaysLeft: null, paidUntil: null, suspended };

  // The free month: everything, for as long as the trial runs.
  const trialEnd = parse(profile?.trial_end_date);
  if (status === 'trial' && trialEnd && trialEnd > now) {
    return {
      tier: 'business',
      source: 'free-month',
      freeMonthDaysLeft: Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / DAY_MS)),
      paidUntil: null,
      suspended,
    };
  }

  // A paid month that has not ended yet.
  const paidUntil = parse(profile?.subscription_expiry);
  if (status === 'active' && paidUntil && paidUntil > now) {
    const cycle = profile?.current_billing_cycle ?? null;
    const tier = tierForPlanKey(cycle) ?? 'business';
    return {
      tier,
      source: cycle === 'starter' || cycle === 'business' ? 'paid' : 'earlier-plan',
      freeMonthDaysLeft: null,
      paidUntil: paidUntil.toISOString(),
      suspended,
    };
  }

  return free;
}

export const tierRank = (tier: Tier): number => TIER_ORDER.indexOf(tier);

export function tierIncludes(tier: Tier, feature: Feature): boolean {
  return tierRank(tier) >= tierRank(FEATURE_MIN_TIER[feature]);
}

/** The usage cap for a resource on a tier, or null when there is none. */
export function limitFor(tier: Tier, resource: LimitedResource): number | null {
  switch (resource) {
    case 'sales':
      return tier === 'free' ? FREE_LIMITS.salesPerMonth : null;
    case 'products':
      return tier === 'free' ? FREE_LIMITS.products : null;
    case 'customers':
      return tier === 'free' ? FREE_LIMITS.customers : null;
    case 'users':
      return tier === 'business' ? BUSINESS_USER_LIMIT : FREE_LIMITS.users;
  }
}

export interface LimitCheck {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

/** Whether one more of a resource can be added. Never blocks anything that already exists. */
export function checkLimit(tier: Tier, resource: LimitedResource, used: number): LimitCheck {
  const limit = limitFor(tier, resource);
  if (limit === null) return { allowed: true, limit: null, used, remaining: null };
  return { allowed: used < limit, limit, used, remaining: Math.max(0, limit - used) };
}

/** The lowest tier that lifts a limit, for the "Upgrade to ..." button. */
export function tierToLiftLimit(tier: Tier, resource: LimitedResource): Tier {
  if (resource === 'users') return 'business';
  return tier === 'free' ? 'starter' : 'business';
}

/** What an account sees under its name: "Free month · 12 days left", "Starter", and so on. */
export function describeEntitlements(e: Entitlements): string {
  if (e.source === 'free-month') return `Free month · ${e.freeMonthDaysLeft} day${e.freeMonthDaysLeft === 1 ? '' : 's'} left`;
  if (e.source === 'earlier-plan') return 'Business features (your paid month)';
  return TIER_LABELS[e.tier];
}
