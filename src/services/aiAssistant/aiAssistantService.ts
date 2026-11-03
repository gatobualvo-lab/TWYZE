import { supabase } from '../../utils/supabase';
import { describeLimitReached, type Quota, type QuotaWindow } from '../subscription/aiLimits';
import { parseQuota } from '../helpAssistant/helpAssistantService';

// Client wrapper for the ai-business-assistant Edge Function. The Anthropic
// API key never appears here or anywhere else in frontend code — the
// browser only ever talks to this Edge Function, which holds the key
// server-side.

export interface AssistantMessage {
  id: string;
  answer: string;
  facts: string[];
  calculatedInsights: string[];
  predictions: string[];
  recommendations: string[];
  confidenceNote: string | null;
  followUpQuestions: string[];
  actionTab: string | null;
}

export interface SendChatMessageResult {
  conversationId: string;
  message: AssistantMessage;
  /** Questions left on this plan, when the server says. */
  quota: Quota | null;
}

export type AssistantErrorCode =
  | 'not_authenticated'
  | 'subscription_required'
  | 'feature_disabled'
  | 'rate_limited'
  | 'invalid_request'
  | 'assistant_unavailable'
  | 'unknown';

export class AssistantRequestError extends Error {
  code: AssistantErrorCode;
  constructor(code: AssistantErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const ERROR_MESSAGES: Record<AssistantErrorCode, string> = {
  not_authenticated: 'Please log in again to use the AI Business Assistant.',
  subscription_required: 'The AI Business Advisor is part of the Business plan. Upgrade to unlock it.',
  feature_disabled: 'The AI Business Assistant is not enabled for this account yet.',
  rate_limited: "You've reached your question limit for now — try again in a little while.",
  invalid_request: 'That message could not be sent — try rephrasing it.',
  assistant_unavailable: 'The AI Business Assistant is temporarily unavailable. Please try again shortly.',
  unknown: 'Something went wrong sending that message.',
};

const isWindow = (value: unknown): value is QuotaWindow => value === 'hour' || value === 'day' || value === 'month';

/** A refused question, with which limit was reached and when to try again, in plain words. */
function limitError(body: { reason?: unknown; retryAfterSeconds?: unknown }): AssistantRequestError {
  if (!isWindow(body.reason)) return new AssistantRequestError('assistant_unavailable', ERROR_MESSAGES.assistant_unavailable);
  const retry = typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : 3600;
  return new AssistantRequestError('rate_limited', describeLimitReached('advisor', 'business', body.reason, retry));
}

export async function sendChatMessage(conversationId: string | null, message: string): Promise<SendChatMessageResult> {
  const { data, error } = await supabase.functions.invoke('ai-business-assistant', {
    body: { conversationId: conversationId ?? undefined, message },
  });

  if (error) {
    // supabase-js surfaces non-2xx Edge Function responses as a generic
    // FunctionsHttpError with the parsed body on `context` in some
    // versions and not others — try to recover the { error: code } shape
    // our own function always returns, falling back to 'unknown'.
    const context = (error as { context?: { json?: () => Promise<{ error?: string; reason?: unknown; retryAfterSeconds?: unknown }> } }).context;
    let code: AssistantErrorCode = 'unknown';
    if (context?.json) {
      try {
        const body = await context.json();
        if (body?.error === 'rate_limited') throw limitError(body);
        if (body?.error && body.error in ERROR_MESSAGES) code = body.error as AssistantErrorCode;
      } catch (caught) {
        if (caught instanceof AssistantRequestError) throw caught;
        // ignore — fall back to 'unknown'
      }
    }
    throw new AssistantRequestError(code, ERROR_MESSAGES[code]);
  }

  if (data?.error === 'rate_limited') throw limitError(data);
  if (data?.error) {
    const code: AssistantErrorCode = data.error in ERROR_MESSAGES ? data.error : 'unknown';
    throw new AssistantRequestError(code, ERROR_MESSAGES[code]);
  }

  return { ...(data as SendChatMessageResult), quota: parseQuota(data?.quota) };
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structuredResponse: Omit<AssistantMessage, 'id'> | null;
  createdAt: string;
}

export async function fetchConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, role, content, structured_response, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    structuredResponse: row.structured_response as StoredMessage['structuredResponse'],
    createdAt: row.created_at,
  }));
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', conversationId);
  if (error) throw new Error(error.message);
}
