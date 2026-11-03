// How many questions each plan may ask the two AI assistants. The Guide and the Business Advisor both
// cost money per question, so the limits are enforced here, on the server, before Claude is called.
// src/services/subscription/aiLimits.ts holds the same table for showing "questions left" in the app; a
// test fails if the two differ. To change a limit, change it in both files.
//
// The windows are rolling: the last hour, the last 24 hours and the last 30 days. A limit of 0 means the
// plan does not include that assistant.

export type AiTier = 'free' | 'starter' | 'business';
export type Assistant = 'guide' | 'advisor';

export interface AiLimit {
  perHour: number;
  perDay: number;
  perMonth: number;
}

export const AI_LIMITS: Record<Assistant, Record<AiTier, AiLimit>> = {
  // The Guide is a small, cheap model with a short prompt.
  guide: {
    free: { perHour: 3, perDay: 5, perMonth: 40 },
    starter: { perHour: 8, perDay: 20, perMonth: 300 },
    business: { perHour: 15, perDay: 40, perMonth: 600 },
  },
  // The Advisor reads the business's own numbers and uses a larger model, so it costs more per question.
  advisor: {
    free: { perHour: 0, perDay: 0, perMonth: 0 },
    starter: { perHour: 0, perDay: 0, perMonth: 0 },
    business: { perHour: 4, perDay: 10, perMonth: 120 },
  },
};

export const limitFor = (assistant: Assistant, tier: AiTier): AiLimit => AI_LIMITS[assistant][tier];

export const includesAssistant = (assistant: Assistant, tier: AiTier): boolean => limitFor(assistant, tier).perMonth > 0;

export interface PlanProfile {
  subscription_status?: string | null;
  subscription_expiry?: string | null;
  trial_end_date?: string | null;
  current_billing_cycle?: string | null;
}

/**
 * The plan an account is on right now. Same rules as the app (src/services/subscription/entitlements.ts):
 * the free month has every feature, a paid month that has not ended gives its plan (the two earlier plans
 * count as Business), and anything else is Free.
 */
export function tierOf(profile: PlanProfile | null | undefined, now: Date = new Date()): AiTier {
  const status = profile?.subscription_status ?? null;
  const trialEnd = profile?.trial_end_date ? new Date(profile.trial_end_date) : null;
  if (status === 'trial' && trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd > now) return 'business';
  const paidUntil = profile?.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  if (status === 'active' && paidUntil && !Number.isNaN(paidUntil.getTime()) && paidUntil > now) {
    return profile?.current_billing_cycle === 'starter' ? 'starter' : 'business';
  }
  return 'free';
}

export type QuotaWindow = 'hour' | 'day' | 'month';

export interface Quota {
  /** Questions this person can still ask today (the tightest of the three limits). */
  remaining: number;
  /** Which limit that is. */
  window: QuotaWindow;
}

export interface Usage {
  used_hour: number;
  used_day: number;
  used_month: number;
}

/** How many more questions can be asked, and which limit will stop them first. */
export function remainingQuestions(limit: AiLimit, used: Usage): Quota {
  const options: Array<[QuotaWindow, number]> = [
    ['hour', limit.perHour - used.used_hour],
    ['day', limit.perDay - used.used_day],
    ['month', limit.perMonth - used.used_month],
  ];
  const [window, left] = options.reduce((best, next) => (next[1] < best[1] ? next : best));
  return { remaining: Math.max(0, left), window };
}

export type QuotaResult =
  | { allowed: true; quota: Quota }
  | { allowed: false; reason: QuotaWindow | 'not_included' | 'unavailable'; retryAfterSeconds: number };

// The slice of the Supabase client used here, so this file needs no imports and can be tested.
interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Counts a question against the person's limits and, when they are within them, records it. Fails
 * closed: if the check itself breaks, the question is refused rather than risking unbounded spending.
 */
export async function consumeQuota(db: RpcClient, assistant: Assistant, tier: AiTier): Promise<QuotaResult> {
  const limit = limitFor(assistant, tier);
  if (limit.perMonth <= 0) return { allowed: false, reason: 'not_included', retryAfterSeconds: 0 };

  const { data, error } = await db.rpc('consume_ai_quota', {
    p_assistant: assistant,
    p_per_hour: limit.perHour,
    p_per_day: limit.perDay,
    p_per_month: limit.perMonth,
  });
  const result = data as
    | (Partial<Usage> & { allowed?: boolean; reason?: string; retry_after_seconds?: number })
    | null;
  if (error || !result || typeof result.allowed !== 'boolean') {
    console.error('consume_ai_quota failed (blocking)', error);
    return { allowed: false, reason: 'unavailable', retryAfterSeconds: 60 };
  }
  if (!result.allowed) {
    const reason: QuotaWindow = result.reason === 'hour' || result.reason === 'month' ? result.reason : 'day';
    return { allowed: false, reason, retryAfterSeconds: Math.max(1, Number(result.retry_after_seconds) || 60) };
  }
  return {
    allowed: true,
    quota: remainingQuestions(limit, {
      used_hour: Number(result.used_hour) || 0,
      used_day: Number(result.used_day) || 0,
      used_month: Number(result.used_month) || 0,
    }),
  };
}
