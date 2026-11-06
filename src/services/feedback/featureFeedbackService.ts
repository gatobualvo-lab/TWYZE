import { supabase } from '../../utils/supabase';

export type FeedbackCategory = 'feature' | 'bug' | 'general' | 'problem';
export type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'done' | 'declined';

export interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  created_at: string;
}

export async function submitFeedback(input: { category: FeedbackCategory; message: string; page?: string }): Promise<void> {
  const message = input.message.trim().slice(0, 1000);
  if (!message) throw new Error('Write a message first');
  const { error } = await supabase.from('feature_feedback' as never).insert({
    category: input.category,
    message,
    page: input.page?.slice(0, 60) ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function fetchMyFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('feature_feedback' as never)
    .select('id, category, message, page, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FeedbackEntry[];
}
