import { supabase } from '../../utils/supabase';
import type { BillingPlanKey } from '../../utils/subscription';
import { prepareImage, uniqueFileStem } from '../storage/imageValidation';

const SCREENSHOT_BUCKET = 'payment-proofs';
/** The most a payment screenshot may weigh when it is picked (it is shrunk before it is stored). */
const MAX_SCREENSHOT_UPLOAD_BYTES = 8 * 1024 * 1024;

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
    // Checked (size, real image type) and redrawn as a clean JPEG; the name and type are chosen here, never
    // taken from the person's file. The bucket also refuses anything that is not a small image.
    const { blob, ext, type } = await prepareImage(input.screenshotFile, { maxBytes: MAX_SCREENSHOT_UPLOAD_BYTES, maxDim: 1600, allowTransparency: false });
    const path = `${user.id}/${uniqueFileStem()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, blob, { upsert: false, contentType: type });
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
  plan: BillingPlanKey,
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

// ---------------------------------------------------------------------------
// M-Pesa STK push (pay for a subscription by a prompt on the phone)
// ---------------------------------------------------------------------------

/** M-Pesa has not been set up on the server yet; the caller can fall back to the card checkout. */
export class MpesaNotConfiguredError extends Error {}

export interface MpesaSession {
  txRef: string;
  checkoutRequestId: string;
  amount: number;
  currency: string;
  message: string;
}

/** Reads the { error, code } body of a failed Edge Function call. */
async function readFunctionError(error: unknown): Promise<{ message?: string; code?: string }> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json();
      return { message: body?.error, code: body?.code };
    } catch {
      // not JSON: fall through to the generic message
    }
  }
  return { message: (error as { message?: string })?.message };
}

/** The phone number saved on the user's profile, to save typing it again. */
export async function fetchMyPhone(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '';
  const { data } = await supabase.from('profiles').select('phone_number').eq('id', user.id).maybeSingle();
  return data?.phone_number ?? '';
}

/**
 * Asks the stk-push Edge Function to send the M-Pesa PIN prompt to `phone` for a plan. The price
 * is looked up on the server; only the plan and the phone number are sent.
 */
export async function startMpesaPayment(plan: BillingPlanKey, phone: string): Promise<MpesaSession> {
  const { data, error } = await supabase.functions.invoke('stk-push', { body: { plan, phone } });
  if (error) {
    const { message, code } = await readFunctionError(error);
    // A function that has not been deployed yet answers 404: treat it like "not set up" so the card/Flutterwave route still works.
    const status = (error as { context?: Response }).context?.status;
    if (status === 404 || code === 'MPESA_NOT_CONFIGURED') throw new MpesaNotConfiguredError(message || 'M-Pesa is not set up yet');
    throw new Error(message || 'Could not send the M-Pesa request');
  }
  if (data?.code === 'MPESA_NOT_CONFIGURED') throw new MpesaNotConfiguredError(data.error);
  if (data?.error) throw new Error(data.error);
  return data as MpesaSession;
}

function toSubmission(data: Record<string, any>): MyPaymentSubmission {
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

/**
 * Waits for an M-Pesa payment to be decided: either the customer paying, cancelling or letting it
 * time out. Safaricom normally reports the result to the server within seconds; if that report is
 * late, the stk-status function is asked to check with Safaricom directly while waiting.
 */
export async function waitForMpesaPayment(
  txRef: string,
  { timeoutMs = 150000, intervalMs = 3000, checkAtMs = [12000, 30000, 55000, 85000, 115000] }: { timeoutMs?: number; intervalMs?: number; checkAtMs?: number[] } = {}
): Promise<MyPaymentSubmission | null> {
  const started = Date.now();
  const pendingChecks = [...checkAtMs];
  const read = async () => {
    const { data, error } = await supabase.from('payment_submissions').select('*').eq('gateway_reference', txRef).maybeSingle();
    return !error && data && data.status !== 'pending' ? toSubmission(data) : null;
  };

  while (Date.now() - started < timeoutMs) {
    const done = await read();
    if (done) return done;
    if (pendingChecks.length && Date.now() - started >= pendingChecks[0]) {
      pendingChecks.shift();
      try {
        await supabase.functions.invoke('stk-status', { body: { txRef } });
        const afterCheck = await read();
        if (afterCheck) return afterCheck;
      } catch {
        // the next round tries again
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return read();
}
