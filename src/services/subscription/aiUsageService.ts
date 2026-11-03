import { supabase } from '../../utils/supabase';
import { AI_LIMITS, remainingQuestions, type Assistant, type Quota } from './aiLimits';
import type { Tier } from './entitlements';

/** How many questions the person can still ask the assistant, or null when that cannot be worked out. */
export async function fetchAiQuota(assistant: Assistant, tier: Tier): Promise<Quota | null> {
  const limit = AI_LIMITS[assistant][tier];
  if (limit.perMonth <= 0) return null;
  const { data, error } = await supabase.rpc('ai_usage' as never, { p_assistant: assistant } as never);
  if (error || !data) return null;
  const usage = data as { used_hour?: number; used_day?: number; used_month?: number };
  return remainingQuestions(limit, {
    used_hour: Number(usage.used_hour) || 0,
    used_day: Number(usage.used_day) || 0,
    used_month: Number(usage.used_month) || 0,
  });
}
