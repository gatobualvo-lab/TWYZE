import { supabase } from '../../utils/supabase';

// Thin wrappers around the email-sending Edge Functions. Every fire-and-
// forget call site here treats a failure as non-fatal — a missing/
// misconfigured SENDGRID_API_KEY should never block signup, payment
// approval, or the dashboard from loading, it should just mean no email
// goes out. sendBroadcastEmail is the one exception: it's an explicit,
// user-initiated admin action, so its caller needs to see real errors.

export async function sendWelcomeEmail(): Promise<void> {
  try {
    await supabase.functions.invoke('send-transactional-email', { body: { type: 'welcome' } });
  } catch {
    // best-effort
  }
}

export async function sendSubscriptionExpiryWarningEmail(): Promise<void> {
  try {
    await supabase.functions.invoke('send-transactional-email', { body: { type: 'subscription_expiry_warning' } });
  } catch {
    // best-effort
  }
}

export async function sendPaymentApprovedEmail(params: { userId: string; amount: number; currency: string; planLabel: string }): Promise<void> {
  try {
    await supabase.functions.invoke('send-payment-approved-email', { body: params });
  } catch {
    // best-effort
  }
}

export async function sendOpportunityAlertEmail(params: { title: string; body: string }): Promise<void> {
  try {
    await supabase.functions.invoke('send-transactional-email', { body: { type: 'opportunity_alert', ...params } });
  } catch {
    // best-effort
  }
}

export type BroadcastAudience = 'all' | 'active' | 'trial' | 'expired';

export async function sendBroadcastEmail(params: { subject: string; body: string; audience: BroadcastAudience }): Promise<{ recipientCount: number }> {
  const { data, error } = await supabase.functions.invoke('send-broadcast-email', { body: params });
  if (error) throw new Error(error.message);
  return { recipientCount: (data as { recipientCount?: number } | null)?.recipientCount ?? 0 };
}
