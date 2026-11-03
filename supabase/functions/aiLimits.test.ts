import { describe, it, expect, vi } from 'vitest';
import { AI_LIMITS as SERVER_LIMITS, consumeQuota, includesAssistant, limitFor, remainingQuestions as serverRemaining, tierOf } from './_shared/aiLimits';
import { AI_LIMITS as APP_LIMITS, remainingQuestions as appRemaining } from '../../src/services/subscription/aiLimits';
import { resolveEntitlements } from '../../src/services/subscription/entitlements';

const NOW = new Date('2026-11-04T10:00:00Z');
const future = '2026-12-01T00:00:00Z';
const past = '2026-10-01T00:00:00Z';

describe('AI question limits', () => {
  it('are the same on the server and in the app', () => {
    expect(APP_LIMITS).toEqual(SERVER_LIMITS);
  });

  it('give every higher plan at least as many questions, and each window is consistent', () => {
    for (const assistant of ['guide', 'advisor'] as const) {
      const { free, starter, business } = SERVER_LIMITS[assistant];
      for (const key of ['perHour', 'perDay', 'perMonth'] as const) {
        expect(starter[key]).toBeGreaterThanOrEqual(free[key]);
        expect(business[key]).toBeGreaterThanOrEqual(starter[key]);
      }
      for (const tier of [free, starter, business]) {
        expect(tier.perDay).toBeGreaterThanOrEqual(tier.perHour);
        expect(tier.perMonth).toBeGreaterThanOrEqual(tier.perDay);
      }
    }
  });

  it('only the Business plan (and the free month) includes the Advisor; every plan includes the Guide', () => {
    expect(includesAssistant('advisor', 'free')).toBe(false);
    expect(includesAssistant('advisor', 'starter')).toBe(false);
    expect(includesAssistant('advisor', 'business')).toBe(true);
    for (const tier of ['free', 'starter', 'business'] as const) expect(includesAssistant('guide', tier)).toBe(true);
  });
});

describe('tierOf (the plan the server uses for the limits)', () => {
  const profiles = [
    null,
    { subscription_status: 'trial', trial_end_date: future },
    { subscription_status: 'trial', trial_end_date: past },
    { subscription_status: 'active', subscription_expiry: future, current_billing_cycle: 'starter' },
    { subscription_status: 'active', subscription_expiry: future, current_billing_cycle: 'business' },
    { subscription_status: 'active', subscription_expiry: future, current_billing_cycle: 'month4+' },
    { subscription_status: 'active', subscription_expiry: past, current_billing_cycle: 'business' },
    { subscription_status: 'suspended', subscription_expiry: future, current_billing_cycle: 'business' },
    { subscription_status: 'expired' },
  ];

  it('always agrees with the app', () => {
    for (const profile of profiles) expect(tierOf(profile, NOW)).toBe(resolveEntitlements(profile, NOW).tier);
  });
});

describe('remainingQuestions', () => {
  it('reports the tightest limit and matches the app', () => {
    const limit = { perHour: 3, perDay: 5, perMonth: 40 };
    const used = { used_hour: 1, used_day: 4, used_month: 10 };
    expect(serverRemaining(limit, used)).toEqual({ remaining: 1, window: 'day' });
    expect(appRemaining(limit, used)).toEqual(serverRemaining(limit, used));
    expect(serverRemaining(limit, { used_hour: 3, used_day: 3, used_month: 3 })).toEqual({ remaining: 0, window: 'hour' });
    expect(serverRemaining(limit, { used_hour: 9, used_day: 9, used_month: 99 }).remaining).toBe(0);
  });
});

describe('consumeQuota', () => {
  const db = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });

  it('refuses without asking the database when the plan does not include the assistant', async () => {
    const client = db({ allowed: true });
    expect(await consumeQuota(client, 'advisor', 'starter')).toEqual({ allowed: false, reason: 'not_included', retryAfterSeconds: 0 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("passes the plan's limits to the database and reports what is left", async () => {
    const client = db({ allowed: true, used_hour: 1, used_day: 1, used_month: 1 });
    const result = await consumeQuota(client, 'guide', 'free');
    expect(client.rpc).toHaveBeenCalledWith('consume_ai_quota', { p_assistant: 'guide', p_per_hour: 3, p_per_day: 5, p_per_month: 40 });
    expect(result).toEqual({ allowed: true, quota: { remaining: 2, window: 'hour' } });
  });

  it('says which limit was hit and when to try again', async () => {
    const result = await consumeQuota(db({ allowed: false, reason: 'day', retry_after_seconds: 7200 }), 'guide', 'free');
    expect(result).toEqual({ allowed: false, reason: 'day', retryAfterSeconds: 7200 });
  });

  it('fails closed when the check itself breaks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const client of [db(null, { message: 'boom' }), db(null), db({ nonsense: true })]) {
      const result = await consumeQuota(client, 'guide', 'business');
      expect(result.allowed).toBe(false);
    }
  });

  it('knows the Business plan limits for the Advisor', () => {
    expect(limitFor('advisor', 'business')).toEqual({ perHour: 4, perDay: 10, perMonth: 120 });
  });
});
