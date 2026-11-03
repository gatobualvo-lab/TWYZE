// M-Pesa (Safaricom Daraja) STK push for TrackWyze subscriptions.
//
// How a payment goes:
//   1. stk-push      the signed-in user picks a plan and a phone number. The server looks up the
//                    price itself, saves a PENDING payment row, and asks Daraja to pop the M-Pesa
//                    PIN prompt on that phone.
//   2. stk-callback  Daraja reports the result to a secret web address. A report is never taken at
//                    its word: the payment is only approved after Daraja itself confirms it when
//                    asked directly (STK query), and the amount must match what was asked for.
//   3. stk-status    if the report is late or never arrives, the app asks again while the user waits
//                    and the same check settles the payment.
//
// Everything that decides whether a subscription is activated lives in settleStkResult(), and it
// claims the pending row first so a report and a status check arriving together cannot activate
// (or extend) the subscription twice.

import { BILLING_PLANS, normalizeStoredPlanKey } from './plans.ts';
import { sendEmail, emailLayout, APP_URL, unsubscribeLinks } from './sendgrid.ts';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Turns what a person types (0712 345 678, +254 712 345 678, 712345678, 0112...) into the
 * 2547XXXXXXXX / 2541XXXXXXXX form Daraja needs, or null if it is not a Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: unknown): string | null {
  const digits = String(input ?? '').replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  let national = digits.startsWith('254') ? digits.slice(3) : digits;
  if (national.startsWith('0')) national = national.slice(1);
  return /^[17]\d{8}$/.test(national) ? `254${national}` : null;
}

/** Daraja timestamp (YYYYMMDDHHmmss) in Nairobi time. */
export function darajaTimestamp(now: Date = new Date()): string {
  const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`;
}

/** base64(shortcode + passkey + timestamp), the "Password" Daraja asks for on every request. */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/** Compares two secrets without stopping at the first different character. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Plain-language reason for a Daraja result code, shown to the person who tried to pay. */
export function friendlyResultMessage(code: number | string | null | undefined, description?: string | null): string {
  switch (Number(code)) {
    case 0:
      return 'Payment received.';
    case 1:
      return 'There was not enough money in the M-Pesa account.';
    case 1001:
      return 'Another M-Pesa request is already open on that phone. Wait a minute and try again.';
    case 1019:
    case 1025:
    case 1037:
      return 'The M-Pesa request timed out because no PIN was entered. Please try again.';
    case 1032:
      return 'The request was cancelled on the phone.';
    case 2001:
      return 'The wrong M-Pesa PIN was entered.';
    default:
      return description ? `M-Pesa could not complete the payment: ${description}` : 'M-Pesa could not complete the payment.';
  }
}

export interface StkCallbackResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount: number | null;
  receipt: string | null;
  phone: string | null;
}

/** Reads Daraja's callback body. Returns null if it is not a callback we can use. */
export function parseStkCallback(body: unknown): StkCallbackResult | null {
  // deno-lint-ignore no-explicit-any
  const cb = (body as any)?.Body?.stkCallback;
  if (!cb || typeof cb !== 'object' || typeof cb.CheckoutRequestID !== 'string' || !cb.CheckoutRequestID) return null;
  const items: Array<{ Name?: string; Value?: unknown }> = Array.isArray(cb.CallbackMetadata?.Item) ? cb.CallbackMetadata.Item : [];
  const pick = (name: string) => items.find(i => i?.Name === name)?.Value;
  const amount = Number(pick('Amount'));
  const receipt = pick('MpesaReceiptNumber');
  const phone = pick('PhoneNumber');
  return {
    merchantRequestId: String(cb.MerchantRequestID ?? ''),
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: String(cb.ResultDesc ?? ''),
    amount: Number.isFinite(amount) && pick('Amount') !== undefined ? amount : null,
    receipt: typeof receipt === 'string' && receipt ? receipt : null,
    phone: phone === undefined || phone === null ? null : String(phone),
  };
}

/** A subscription extends from its current end if still running, otherwise from today. */
export function nextExpiry(currentExpiryIso: string | null | undefined, durationDays: number, now: Date = new Date()): Date {
  const current = currentExpiryIso ? new Date(currentExpiryIso) : null;
  const start = current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  const result = new Date(start);
  result.setDate(result.getDate() + durationDays);
  return result;
}

// ---------------------------------------------------------------------------
// Daraja API
// ---------------------------------------------------------------------------

export interface DarajaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  /** The Paybill (or, for Buy Goods, the head-office number) the request is made under. */
  shortcode: string;
  passkey: string;
  transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  /** Who receives the money: the Paybill itself, or the Till number for Buy Goods. */
  partyB: string;
  callbackSecret: string;
}

/** Reads the configuration from secrets. Null when anything required is missing. */
export function readDarajaConfig(get: (key: string) => string | undefined): DarajaConfig | null {
  // Secrets pasted into a dashboard often carry a stray space or line break; ignore those.
  const read = (key: string) => get(key)?.trim() || undefined;
  const consumerKey = read('MPESA_CONSUMER_KEY');
  const consumerSecret = read('MPESA_CONSUMER_SECRET');
  const shortcode = read('MPESA_SHORTCODE');
  const passkey = read('MPESA_PASSKEY');
  const callbackSecret = read('MPESA_CALLBACK_SECRET');
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackSecret) return null;
  const production = (read('MPESA_ENV') ?? 'sandbox').toLowerCase() === 'production';
  // The Daraja sandbox only understands Paybill requests; Buy Goods is for a real Till in production.
  const transactionType =
    production && read('MPESA_TRANSACTION_TYPE')?.toLowerCase() === 'customerbuygoodsonline' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
  return {
    baseUrl: production ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    transactionType,
    partyB: production ? read('MPESA_PARTY_B') || shortcode : shortcode,
    callbackSecret,
  };
}

type FetchLike = typeof fetch;

export async function getAccessToken(cfg: DarajaConfig, fetchFn: FetchLike = fetch): Promise<string> {
  const response = await fetchFn(`${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`)}` },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) throw new Error('Could not sign in to M-Pesa. Check the consumer key and secret.');
  return json.access_token as string;
}

export type StkPushOutcome =
  | { ok: true; checkoutRequestId: string; merchantRequestId: string; customerMessage: string }
  | { ok: false; message: string };

export async function stkPush(
  cfg: DarajaConfig,
  params: { phone: string; amount: number; reference: string; description: string; callbackUrl: string; now?: Date },
  fetchFn: FetchLike = fetch
): Promise<StkPushOutcome> {
  const token = await getAccessToken(cfg, fetchFn);
  const timestamp = darajaTimestamp(params.now);
  const response = await fetchFn(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: cfg.transactionType,
      Amount: Math.round(params.amount),
      PartyA: params.phone,
      PartyB: cfg.partyB,
      PhoneNumber: params.phone,
      CallBackURL: params.callbackUrl,
      AccountReference: params.reference.slice(0, 12),
      TransactionDesc: params.description.slice(0, 13),
    }),
  });
  const json = await response.json().catch(() => null);
  if (response.ok && String(json?.ResponseCode) === '0' && json?.CheckoutRequestID) {
    return {
      ok: true,
      checkoutRequestId: String(json.CheckoutRequestID),
      merchantRequestId: String(json.MerchantRequestID ?? ''),
      customerMessage: String(json.CustomerMessage ?? 'Check your phone to enter your M-Pesa PIN.'),
    };
  }
  const reason = json?.errorMessage || json?.CustomerMessage || json?.ResponseDescription || 'M-Pesa did not accept the request.';
  // Which settings were used, to make a wrong setting easy to spot.
  const used = `${cfg.transactionType} on ${cfg.baseUrl.includes('sandbox') ? 'sandbox' : 'production'}, shortcode ${cfg.shortcode}`;
  return { ok: false, message: `${reason} (sent as: ${used})` };
}

export type StkQueryOutcome =
  | { state: 'success'; resultCode: 0; resultDesc: string }
  | { state: 'failed'; resultCode: number; resultDesc: string }
  | { state: 'pending' };

/** Asks Daraja directly what happened to a request. "pending" also covers "could not find out". */
export async function stkQuery(cfg: DarajaConfig, checkoutRequestId: string, fetchFn: FetchLike = fetch, now?: Date): Promise<StkQueryOutcome> {
  try {
    const token = await getAccessToken(cfg, fetchFn);
    const timestamp = darajaTimestamp(now);
    const response = await fetchFn(`${cfg.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const json = await response.json().catch(() => null);
    // While the customer is still deciding, Daraja answers with an error ("being processed").
    if (!json || json.errorCode || json.ResultCode === undefined || json.ResultCode === null || json.ResultCode === '') return { state: 'pending' };
    const code = Number(json.ResultCode);
    const desc = String(json.ResultDesc ?? '');
    return code === 0 ? { state: 'success', resultCode: 0, resultDesc: desc } : { state: 'failed', resultCode: code, resultDesc: desc };
  } catch {
    return { state: 'pending' };
  }
}

// ---------------------------------------------------------------------------
// Settling a payment
// ---------------------------------------------------------------------------

export interface PaymentSubmission {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string | null;
  plan_key: string | null;
  status: string | null;
  gateway_reference: string | null;
  gateway_transaction_id: string | null;
}

export interface StkOutcome {
  resultCode: number;
  resultDesc: string;
  /** Amount Daraja reports having taken, when known (callbacks include it; queries do not). */
  amount?: number | null;
  receipt?: string | null;
}

export type SettleResult = 'approved' | 'rejected' | 'ignored';

const escapeHtml = (input: string) =>
  input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Applies the final result of an STK push to its payment row, and activates the subscription when
 * it was paid. Safe to call more than once for the same payment.
 */
// deno-lint-ignore no-explicit-any
export async function settleStkResult(supabase: any, submission: PaymentSubmission, outcome: StkOutcome, now: Date = new Date()): Promise<SettleResult> {
  if (submission.status !== 'pending') return 'ignored';
  const stamp = now.toISOString();

  const reject = async (note: string, action: string): Promise<SettleResult> => {
    // Only a row that is still pending can be rejected, so a payment that was approved in the
    // meantime is never overwritten.
    const { data: claimed } = await supabase
      .from('payment_submissions')
      .update({ status: 'rejected', reviewed_at: stamp, admin_notes: note, updated_at: stamp })
      .eq('id', submission.id)
      .eq('status', 'pending')
      .select('id');
    if (!claimed?.length) return 'ignored';
    await supabase.from('audit_log').insert({
      user_id: submission.user_id,
      action,
      table_name: 'payment_submissions',
      record_id: submission.id,
      new_data: { checkout_request_id: submission.gateway_transaction_id, result_code: outcome.resultCode },
    });
    return 'rejected';
  };

  if (outcome.resultCode !== 0) {
    return reject(`M-Pesa: ${friendlyResultMessage(outcome.resultCode, outcome.resultDesc)}`, 'gateway_payment_failed');
  }

  // The amount must be exactly what was asked for.
  if (outcome.amount !== undefined && outcome.amount !== null && Number(outcome.amount) !== Number(submission.amount)) {
    return reject(`Auto-rejected: M-Pesa reported ${outcome.amount} but ${submission.amount} was expected.`, 'gateway_payment_failed');
  }

  const planKey = normalizeStoredPlanKey(submission.plan_key);
  const plan = BILLING_PLANS[planKey];

  // Claim the row first: whoever flips it from pending owns activating the subscription.
  const { data: claimed } = await supabase
    .from('payment_submissions')
    .update({
      status: 'approved',
      reviewed_at: stamp,
      admin_notes: 'Auto-approved via M-Pesa',
      transaction_reference: outcome.receipt ?? null,
      updated_at: stamp,
    })
    .eq('id', submission.id)
    .eq('status', 'pending')
    .select('id');
  if (!claimed?.length) return 'ignored';

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_expiry, email, full_name')
      .eq('id', submission.user_id)
      .maybeSingle();

    const expiry = nextExpiry(profile?.subscription_expiry, plan.durationDays, now);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ subscription_status: 'active', subscription_expiry: expiry.toISOString(), current_billing_cycle: planKey, updated_at: stamp })
      .eq('id', submission.user_id);
    if (profileError) throw profileError;

    await supabase.from('audit_log').insert({
      user_id: submission.user_id,
      action: 'gateway_payment_approved',
      table_name: 'payment_submissions',
      record_id: submission.id,
      new_data: { gateway: 'mpesa', amount: submission.amount, planKey, durationDays: plan.durationDays, receipt: outcome.receipt ?? null },
    });

    await sendConfirmationEmail(profile, submission, plan.label);
    return 'approved';
  } catch (error) {
    // Paid but not activated: put the row back to pending so the next status check retries.
    await supabase
      .from('payment_submissions')
      .update({ status: 'pending', reviewed_at: null, admin_notes: 'M-Pesa payment confirmed; activation will be retried.', updated_at: stamp })
      .eq('id', submission.id);
    throw error;
  }
}

async function sendConfirmationEmail(
  profile: { email?: string | null; full_name?: string | null } | null,
  submission: PaymentSubmission,
  planLabel: string
): Promise<void> {
  // Best effort: a failed email must never undo a confirmed payment.
  // deno-lint-ignore no-explicit-any
  const apiKey = (globalThis as any).Deno?.env?.get?.('SENDGRID_API_KEY');
  if (!apiKey || !profile?.email) return;
  const amountLabel = `${submission.currency ?? 'KES'} ${Number(submission.amount).toLocaleString()}`;
  const subject = 'Payment confirmed — TrackWyze';
  try {
    // deno-lint-ignore no-explicit-any
    const env = (globalThis as any).Deno?.env;
    const links = await unsubscribeLinks({ secret: env?.get?.('UNSUBSCRIBE_SECRET'), userId: submission.user_id, supabaseUrl: env?.get?.('SUPABASE_URL') });
    await sendEmail({
      apiKey,
      to: profile.email,
      subject,
      unsubscribe: links,
      html: emailLayout(
        subject,
        `<p style="margin:0 0 14px;">Hi ${escapeHtml(profile.full_name || 'there')},</p><p style="margin:0 0 6px;">We've confirmed your M-Pesa payment of ${escapeHtml(amountLabel)} for the ${escapeHtml(planLabel)}. Your TrackWyze subscription is active. Thank you for staying with us.</p>`,
        { preheader: 'Your subscription is active. Thank you.', cta: { label: 'Open TrackWyze', url: APP_URL }, unsubscribe: { url: links.pageUrl, essential: true } }
      ),
      text: `Hi ${profile.full_name || 'there'},\n\nWe've confirmed your M-Pesa payment of ${amountLabel} for the ${planLabel}. Your TrackWyze subscription is active.\n\nOpen TrackWyze: ${APP_URL}`,
    });
  } catch (error) {
    console.error('stk: confirmation email failed', error);
  }
}
