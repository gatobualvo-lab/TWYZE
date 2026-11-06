import { supabase } from '../../utils/supabase';
import { submitFeedback } from '../feedback/featureFeedbackService';

/**
 * Saves the report as a `problem` category row in feature_feedback (the durable record an admin
 * will see — same table, same admin view as feature suggestions and bug reports) and, best-effort,
 * asks the send-support-request-email function to notify the team. The save is what matters — if
 * the email fails, the admin still sees it in the Admin Panel, so that failure is swallowed here
 * rather than surfaced as a submission error.
 */
export async function submitSupportRequest(input: { message: string; page?: string }): Promise<void> {
  await submitFeedback({ category: 'problem', message: input.message, page: input.page });

  try {
    await supabase.functions.invoke('send-support-request-email', {
      body: { message: input.message.trim().slice(0, 1000), page: input.page?.slice(0, 60) },
    });
  } catch {
    // best-effort — the row above is the record of truth
  }
}
