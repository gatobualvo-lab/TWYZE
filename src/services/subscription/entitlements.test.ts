import { describe, it, expect } from 'vitest';
import {
  BUSINESS_USER_LIMIT,
  FEATURE_MIN_TIER,
  FEATURE_NAMES,
  FREE_LIMITS,
  checkLimit,
  describeEntitlements,
  limitFor,
  resolveEntitlements,
  tierForPlanKey,
  tierIncludes,
  tierToLiftLimit,
  type Feature,
} from './entitlements';

const NOW = new Date('2026-11-10T09:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString();

describe('the free month', () => {
  it('gives every feature while the trial runs', () => {
    const e = resolveEntitlements({ subscription_status: 'trial', trial_end_date: inDays(12) }, NOW);
    expect(e).toMatchObject({ tier: 'business', source: 'free-month', freeMonthDaysLeft: 12 });
  });

  it('counts a part-day as a day left, and never shows zero while it is still running', () => {
    expect(resolveEntitlements({ subscription_status: 'trial', trial_end_date: new Date(NOW.getTime() + 3600000).toISOString() }, NOW).freeMonthDaysLeft).toBe(1);
  });

  it('ends on the day: a finished trial is the Free tier even before the status is updated', () => {
    const e = resolveEntitlements({ subscription_status: 'trial', trial_end_date: inDays(-1) }, NOW);
    expect(e).toMatchObject({ tier: 'free', source: 'free' });
  });
});

describe('paid plans', () => {
  it.each([
    ['starter', 'starter'],
    ['business', 'business'],
  ])('%s -> %s while the paid month runs', (cycle, tier) => {
    const e = resolveEntitlements({ subscription_status: 'active', current_billing_cycle: cycle, subscription_expiry: inDays(10) }, NOW);
    expect(e).toMatchObject({ tier, source: 'paid' });
    expect(e.paidUntil).toBe(inDays(10));
  });

  it('drops to Free when the paid month ends', () => {
    expect(resolveEntitlements({ subscription_status: 'active', current_billing_cycle: 'business', subscription_expiry: inDays(-1) }, NOW).tier).toBe('free');
  });

  it('keeps every feature for someone who paid under the old 500 or 1,000 plan, until their month ends', () => {
    for (const cycle of ['month2-3', 'month4+']) {
      const e = resolveEntitlements({ subscription_status: 'active', current_billing_cycle: cycle, subscription_expiry: inDays(20) }, NOW);
      expect(e).toMatchObject({ tier: 'business', source: 'earlier-plan' });
    }
    expect(resolveEntitlements({ subscription_status: 'active', current_billing_cycle: 'month2-3', subscription_expiry: inDays(-2) }, NOW).tier).toBe('free');
  });

  it('active with no end date or an unknown plan is not trusted beyond what is known', () => {
    expect(resolveEntitlements({ subscription_status: 'active', current_billing_cycle: 'starter', subscription_expiry: null }, NOW).tier).toBe('free');
    expect(resolveEntitlements({ subscription_status: 'active', current_billing_cycle: 'mystery', subscription_expiry: inDays(5) }, NOW).tier).toBe('business');
  });
});

describe('everyone else is on Free', () => {
  it.each(['expired', 'restricted', 'suspended', undefined, null, 'whatever'])('status %s', (status) => {
    expect(resolveEntitlements({ subscription_status: status as string | null }, NOW).tier).toBe('free');
  });

  it('copes with no profile at all', () => {
    expect(resolveEntitlements(null, NOW).tier).toBe('free');
    expect(resolveEntitlements(undefined, NOW).tier).toBe('free');
  });

  it('knows an admin suspended the account', () => {
    expect(resolveEntitlements({ subscription_status: 'suspended' }, NOW).suspended).toBe(true);
    expect(resolveEntitlements({ subscription_status: 'expired' }, NOW).suspended).toBe(false);
  });

  it('junk dates do not crash', () => {
    expect(resolveEntitlements({ subscription_status: 'trial', trial_end_date: 'nope' }, NOW).tier).toBe('free');
    expect(resolveEntitlements({ subscription_status: 'active', subscription_expiry: 'nope' }, NOW).tier).toBe('free');
  });
});

describe('features by tier', () => {
  it('Free has none of the paid features, Starter has the Starter ones, Business has all', () => {
    for (const feature of Object.keys(FEATURE_MIN_TIER) as Feature[]) {
      expect(tierIncludes('business', feature)).toBe(true);
      expect(tierIncludes('starter', feature)).toBe(FEATURE_MIN_TIER[feature] === 'starter');
      expect(tierIncludes('free', feature)).toBe(false);
    }
  });

  it('puts the things agreed for each tier in the right place', () => {
    expect(FEATURE_MIN_TIER['daily-closing']).toBe('starter');
    expect(FEATURE_MIN_TIER['document-appearance']).toBe('starter');
    expect(FEATURE_MIN_TIER['no-document-watermark']).toBe('starter');
    expect(FEATURE_MIN_TIER['profit-analytics']).toBe('business');
    expect(FEATURE_MIN_TIER.team).toBe('business');
    expect(FEATURE_MIN_TIER['emailed-reports']).toBe('business');
  });

  it('every feature has a name for the upgrade message', () => {
    for (const feature of Object.keys(FEATURE_MIN_TIER) as Feature[]) expect(FEATURE_NAMES[feature]).toBeTruthy();
  });
});

describe('limits', () => {
  it('Free is 40 sales a month, 20 products, 15 customers and 1 user', () => {
    expect(FREE_LIMITS).toEqual({ salesPerMonth: 40, products: 20, customers: 15, users: 1 });
    expect(limitFor('free', 'sales')).toBe(40);
    expect(limitFor('free', 'products')).toBe(20);
    expect(limitFor('free', 'customers')).toBe(15);
    expect(limitFor('free', 'users')).toBe(1);
  });

  it('Starter and Business have no cap on sales, products or customers', () => {
    for (const tier of ['starter', 'business'] as const) {
      for (const resource of ['sales', 'products', 'customers'] as const) expect(limitFor(tier, resource)).toBeNull();
    }
  });

  it('users: 1 on Free and Starter, up to 5 on Business', () => {
    expect(limitFor('starter', 'users')).toBe(1);
    expect(limitFor('business', 'users')).toBe(BUSINESS_USER_LIMIT);
  });

  it('checkLimit allows up to the cap and stops at it', () => {
    expect(checkLimit('free', 'sales', 39)).toEqual({ allowed: true, limit: 40, used: 39, remaining: 1 });
    expect(checkLimit('free', 'sales', 40)).toEqual({ allowed: false, limit: 40, used: 40, remaining: 0 });
    expect(checkLimit('free', 'products', 55).remaining).toBe(0); // already over: nothing is removed, nothing new is added
    expect(checkLimit('starter', 'sales', 100000)).toEqual({ allowed: true, limit: null, used: 100000, remaining: null });
  });

  it('suggests the right upgrade', () => {
    expect(tierToLiftLimit('free', 'sales')).toBe('starter');
    expect(tierToLiftLimit('free', 'users')).toBe('business');
    expect(tierToLiftLimit('starter', 'users')).toBe('business');
  });
});

describe('plan keys', () => {
  it('maps new and earlier plan keys to a tier', () => {
    expect(tierForPlanKey('starter')).toBe('starter');
    expect(tierForPlanKey('business')).toBe('business');
    expect(tierForPlanKey('month2-3')).toBe('business');
    expect(tierForPlanKey('month4+')).toBe('business');
    expect(tierForPlanKey('trial')).toBeNull();
    expect(tierForPlanKey(undefined)).toBeNull();
  });
});

describe('describeEntitlements', () => {
  it('reads naturally', () => {
    expect(describeEntitlements(resolveEntitlements({ subscription_status: 'trial', trial_end_date: inDays(1) }, NOW))).toBe('Free month · 1 day left');
    expect(describeEntitlements(resolveEntitlements({ subscription_status: 'trial', trial_end_date: inDays(9) }, NOW))).toBe('Free month · 9 days left');
    expect(describeEntitlements(resolveEntitlements({ subscription_status: 'active', current_billing_cycle: 'starter', subscription_expiry: inDays(5) }, NOW))).toBe('Starter');
    expect(describeEntitlements(resolveEntitlements({ subscription_status: 'expired' }, NOW))).toBe('Free');
  });
});
