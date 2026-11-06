import { supabase } from '../../utils/supabase';

/**
 * Saves the report (the durable record an admin will see) and, best-effort, asks the
 * send-support-request-email function to notify the team. The save is what matters — if the
 * email fails, the admin still sees it in the Admin Panel, so that failure is swallowed here
 * rather than surfaced as a submission error.
 */
export async function submitSupportRequest(input: { message: string; page?: string }): Promise<void> {
  const message = input.message.trim().slice(0, 1000);
  if (!message) throw new Error('Describe the problem first');
  const page = input.page?.slice(0, 60) ?? null;

  const { error } = await supabase.from('support_requests' as never).insert({ message, page } as never);
  if (error) throw new Error(error.message);

  try {
    await supabase.functions.invoke('send-support-request-email', { body: { message, page } });
  } catch {
    // best-effort — the row above is the record of truth
  }
}
