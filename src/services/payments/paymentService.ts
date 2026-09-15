import { supabase } from '../../utils/supabase';

const SCREENSHOT_BUCKET = 'payment-proofs';

export interface SubscriptionInfo {
  status?: string;
  billingCycle?: string;
  trialEndDate: string | null;
  subscriptionExpiry: string | null;
}

export async function fetchMySubscription(): Promise<SubscriptionInfo> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, current_billing_cycle, trial_end_date, subscription_expiry')
    .eq('id', user.id)
    .single();
  if (error) throw new Error(error.message);

  return {
    status: data?.subscription_status ?? undefined,
    billingCycle: data?.current_billing_cycle ?? undefined,
    trialEndDate: data?.trial_end_date ?? null,
    subscriptionExpiry: data?.subscription_expiry ?? null,
  };
}

export interface MyPaymentSubmission {
  id: string;
  amount: number;
  paymentMethod: string;
  transactionReference: string | null;
  screenshotPath: string | null;
  status: string;
  submittedAt: string | null;
  adminNotes: string | null;
}

export async function listMyPaymentSubmissions(): Promise<MyPaymentSubmission[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(s => ({
    id: s.id,
    amount: Number(s.amount),
    paymentMethod: s.payment_method,
    transactionReference: s.transaction_reference,
    screenshotPath: s.screenshot_url,
    status: s.status ?? 'pending',
    submittedAt: s.submitted_at,
    adminNotes: s.admin_notes,
  }));
}

export interface SubmitPaymentInput {
  amount: number;
  paymentMethod: string;
  transactionReference: string;
  screenshotFile?: File | null;
}

export async function submitPayment(input: SubmitPaymentInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let screenshotPath: string | null = null;
  if (input.screenshotFile) {
    const ext = input.screenshotFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, input.screenshotFile, { upsert: false, contentType: input.screenshotFile.type || undefined });
    if (uploadError) throw new Error(uploadError.message);
    screenshotPath = path;
  }

  const { error } = await supabase.from('payment_submissions').insert({
    user_id: user.id,
    amount: input.amount,
    payment_method: input.paymentMethod,
    transaction_reference: input.transactionReference || null,
    screenshot_url: screenshotPath,
  });
  if (error) throw new Error(error.message);
}

export async function getScreenshotSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(path, 5 * 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export interface CheckoutSession {
  txRef: string;
  amount: number;
  currency: string;
  publicKey: string;
  paymentOptions: 'mpesa' | 'card';
  customer: { email: string; name: string; phone: string };
}

/**
 * Asks the create-checkout Edge Function to price a plan and mint a pending
 * payment_submissions row. The amount is never decided client-side — the
 * function looks it up itself from its own copy of BILLING_PLANS.
 */
export async function createCheckoutSession(
  plan: 'month2-3' | 'month4+',
  method: 'mpesa' | 'card'
): Promise<CheckoutSession> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { plan, method },
  });
  if (error) {
    // supabase-js's FunctionsHttpError puts the raw Response on `.context`,
    // not a parsed body — have to read it ourselves to get our own
    // { error: "..." } message instead of the generic "non-2xx status".
    const context = (error as { context?: Response }).context;
    let message: string | undefined;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.clone().json();
        message = body?.error;
      } catch {
        // response wasn't JSON — fall through to the generic message below
      }
    }
    throw new Error(message || error.message || 'Failed to start checkout');
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data as CheckoutSession;
}

/**
 * Polls a single submission until the webhook has processed it (or a
 * timeout elapses) so the UI can show "verifying..." instead of leaving the
 * user on a row stuck at "Pending" — the actual approval always happens
 * server-side, this just waits for that to land.
 */
export async function waitForSubmissionResolution(
  txRef: string,
  { timeoutMs = 45000, intervalMs = 2000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<MyPaymentSubmission | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('payment_submissions')
      .select('*')
      .eq('gateway_reference', txRef)
      .maybeSingle();
    if (!error && data && data.status !== 'pending') {
      return {
        id: data.id,
        amount: Number(data.amount),
        paymentMethod: data.payment_method,
        transactionReference: data.transaction_reference,
        screenshotPath: data.screenshot_url,
        status: data.status ?? 'pending',
        submittedAt: data.submitted_at,
        adminNotes: data.admin_notes,
      };
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
}
