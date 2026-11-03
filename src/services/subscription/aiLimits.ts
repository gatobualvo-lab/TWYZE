import type { Tier } from './entitlements';

// How many questions each plan may ask the two AI assistants. The server enforces this (see
// supabase/functions/_shared/aiLimits.ts, which holds the same table; a test fails if they differ). This
// copy is for showing people how many questions they have left.

export type Assistant = 'guide' | 'advisor';
export type QuotaWindow = 'hour' | 'day' | 'month';

export interface AiLimit {
  perHour: number;
  perDay: number;
  perMonth: number;
}

export const AI_LIMITS: Record<Assistant, Record<Tier, AiLimit>> = {
  guide: {
    free: { perHour: 3, perDay: 5, perMonth: 40 },
    starter: { perHour: 8, perDay: 20, perMonth: 300 },
    business: { perHour: 15, perDay: 40, perMonth: 600 },
  },
  advisor: {
    free: { perHour: 0, perDay: 0, perMonth: 0 },
    starter: { perHour: 0, perDay: 0, perMonth: 0 },
    business: { perHour: 4, perDay: 10, perMonth: 120 },
  },
};

export interface Usage {
  used_hour: number;
  used_day: number;
  used_month: number;
}

export interface Quota {
  /** Questions that can still be asked (the tightest of the three limits). */
  remaining: number;
  /** Which limit that is. */
  window: QuotaWindow;
}

export function remainingQuestions(limit: AiLimit, used: Usage): Quota {
  const options: Array<[QuotaWindow, number]> = [
    ['hour', limit.perHour - used.used_hour],
    ['day', limit.perDay - used.used_day],
    ['month', limit.perMonth - used.used_month],
  ];
  const [window, left] = options.reduce((best, next) => (next[1] < best[1] ? next : best));
  return { remaining: Math.max(0, left), window };
}

/** "3 questions left today", "1 question left this month". */
export function describeRemaining(quota: Quota): string {
  const noun = quota.remaining === 1 ? 'question' : 'questions';
  const when = quota.window === 'hour' ? 'this hour' : quota.window === 'day' ? 'today' : 'this month';
  return `${quota.remaining} ${noun} left ${when}`;
}

/** "about 20 minutes", "about 3 hours". */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 90) return 'a minute';
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.round(s / 3600);
  if (hours < 48) return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `about ${Math.round(s / 86400)} days`;
}

/** What to tell someone who has used up their questions. */
export function describeLimitReached(assistant: Assistant, tier: Tier, reason: QuotaWindow, retryAfterSeconds: number): string {
  const wait = formatWait(retryAfterSeconds);
  const name = assistant === 'guide' ? 'the Guide' : 'the Business Advisor';
  const period = reason === 'hour' ? "this hour's" : reason === 'day' ? "today's" : "this month's";
  const upgrade = assistant === 'guide' && tier !== 'business' ? ' Upgrading your plan gives you more questions.' : '';
  return `You have used ${period} questions for ${name}. You can ask again in ${wait}.${upgrade}`;
}
