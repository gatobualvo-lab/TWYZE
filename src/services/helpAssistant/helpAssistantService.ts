import { supabase } from '../../utils/supabase';

// Client for the app-help Edge Function (the TrackWyze Guide). The Anthropic key lives only on the
// server; the browser sends the conversation, the page the person is on and their plan, never any
// business data.

export interface GuideMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GuideReply {
  reply: string;
  /** Pages in the app worth opening. */
  pages: string[];
  /** The Guide thinks the team should step in. */
  needsHuman: boolean;
}

export type GuideErrorCode = 'offline' | 'not_authenticated' | 'rate_limited' | 'unavailable' | 'unknown';

export class GuideError extends Error {
  code: GuideErrorCode;
  constructor(code: GuideErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MESSAGES: Record<GuideErrorCode, string> = {
  offline: 'You seem to be offline. Please check your internet and try again.',
  not_authenticated: 'Please log in again to use the Guide.',
  rate_limited: 'You have asked a lot of questions in a short time. Please try again a little later, or talk to our team.',
  unavailable: 'The Guide is not available right now. Please try again shortly, or talk to our team.',
  unknown: 'Something went wrong. Please try again, or talk to our team.',
};

const CODES: GuideErrorCode[] = ['not_authenticated', 'rate_limited', 'unavailable'];

export async function askGuide(messages: GuideMessage[], context: { tab?: string; tier?: string }): Promise<GuideReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GuideError('offline', MESSAGES.offline);

  const { data, error } = await supabase.functions.invoke('app-help', { body: { messages, tab: context.tab, tier: context.tier } });

  if (error) {
    const response = (error as { context?: Response }).context;
    let code: GuideErrorCode = 'unknown';
    // No response at all (the function is not deployed, or the network dropped), or a 404, means it is not available.
    if (!response || response.status === 404) code = 'unavailable';
    else if (typeof response.json === 'function') {
      try {
        const body = await response.clone().json();
        if (CODES.includes(body?.error)) code = body.error;
      } catch {
        // not JSON: keep "unknown"
      }
    }
    throw new GuideError(code, MESSAGES[code]);
  }
  if (typeof data?.reply !== 'string') {
    const code = CODES.includes(data?.error) ? (data.error as GuideErrorCode) : 'unknown';
    throw new GuideError(code, MESSAGES[code]);
  }
  return { reply: data.reply, pages: Array.isArray(data.pages) ? data.pages.filter((p: unknown): p is string => typeof p === 'string') : [], needsHuman: data.needsHuman === true };
}

export interface GuideFeedback {
  rating: 'up' | 'down';
  question: string;
  answer: string;
  page?: string;
  tier?: string;
}

/** Records a thumbs up or down so the team can see which answers need fixing. Holds no business data. */
export async function submitGuideFeedback(feedback: GuideFeedback): Promise<void> {
  const { error } = await supabase.from('guide_feedback' as never).insert({
    rating: feedback.rating,
    question: feedback.question.slice(0, 500),
    answer: feedback.answer.slice(0, 1200),
    page: feedback.page?.slice(0, 60) ?? null,
    tier: feedback.tier?.slice(0, 20) ?? null,
  } as never);
  if (error) throw new Error(error.message);
}
