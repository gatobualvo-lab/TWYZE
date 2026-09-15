// Public webhook — Flutterwave calls this directly, so there's no user JWT
// to trust. Two independent checks gate everything below:
//   1. The `verif-hash` header must match a secret only we and Flutterwave
//      know (set in the Flutterwave dashboard's webhook config).
//   2. The webhook body itself is NEVER trusted for the outcome — we always
//      re-fetch the transaction from Flutterwave's server-to-server verify
//      endpoint and check status/amount/currency/tx_ref match what we
//      expected before touching anyone's subscription. A webhook body is
//      just a "go check" notification, not proof of payment.
// Uses the service_role key because there is no authenticated end user in
// this request — Flutterwave's servers are calling us, not the client app.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BILLING_PLANS, isBillingPlanKey } from '../_shared/plans.ts';
import { sendEmail, emailLayout } from '../_shared/sendgrid.ts';

function ok(): Response {
  // Always 200 once the signature check passes, even on business-logic
  // failures below — a non-200 makes Flutterwave retry indefinitely, and
  // retries won't fix "we don't recognize this tx_ref" or "amount mismatch".
  return new Response('OK', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');
  const receivedHash = req.headers.get('verif-hash');
  if (!expectedHash || !receivedHash || receivedHash !== expectedHash) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || payload.event !== 'charge.completed') {
    return ok();
  }

  const txRef: string | undefined = payload?.data?.tx_ref;
  const flwId: number | string | undefined = payload?.data?.id;
  if (!txRef || !flwId) {
    return ok();
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: submission, error: fetchError } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('gateway_reference', txRef)
    .maybeSingle();

  if (fetchError || !submission) {
    console.error('webhook: no submission for tx_ref', txRef, fetchError);
    return ok();
  }

  // Idempotency — Flutterwave can and does deliver the same webhook more
  // than once. Only a still-pending row should ever be processed.
  if (submission.status !== 'pending') {
    return ok();
  }

  const secretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!secretKey) {
    console.error('webhook: FLUTTERWAVE_SECRET_KEY not configured');
    return ok();
  }

  const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verifyJson = await verifyRes.json().catch(() => null);
  const txData = verifyJson?.data;

  const succeeded = verifyRes.ok && verifyJson?.status === 'success' && txData?.status === 'successful';
  const amountMatches = Number(txData?.amount) === Number(submission.amount);
  const currencyMatches = txData?.currency === submission.currency;
  const refMatches = txData?.tx_ref === txRef;

  if (!succeeded || !amountMatches || !currencyMatches || !refMatches) {
    await supabase.from('payment_submissions').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_notes: `Auto-rejected: gateway verification failed (status=${txData?.status ?? 'unknown'}, amount/currency/ref mismatch=${!(amountMatches && currencyMatches && refMatches)}).`,
      gateway_transaction_id: String(flwId),
      updated_at: new Date().toISOString(),
    }).eq('id', submission.id);

    await supabase.from('audit_log').insert({
      user_id: submission.user_id,
      action: 'gateway_payment_failed',
      table_name: 'payment_submissions',
      record_id: submission.id,
      new_data: { tx_ref: txRef, flw_status: txData?.status ?? null },
    });

    return ok();
  }

  const planKey = isBillingPlanKey(submission.plan_key) ? submission.plan_key : 'month2-3';
  const durationDays = BILLING_PLANS[planKey].durationDays;

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_expiry, email, full_name')
    .eq('id', submission.user_id)
    .maybeSingle();

  const base = profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date()
    ? new Date(profile.subscription_expiry)
    : new Date();
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + durationDays);

  await supabase.from('payment_submissions').update({
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    admin_notes: 'Auto-approved via Flutterwave',
    gateway_transaction_id: String(flwId),
    updated_at: new Date().toISOString(),
  }).eq('id', submission.id);

  await supabase.from('profiles').update({
    subscription_status: 'active',
    subscription_expiry: newExpiry.toISOString(),
    current_billing_cycle: planKey,
    updated_at: new Date().toISOString(),
  }).eq('id', submission.user_id);

  await supabase.from('audit_log').insert({
    user_id: submission.user_id,
    action: 'gateway_payment_approved',
    table_name: 'payment_submissions',
    record_id: submission.id,
    new_data: { tx_ref: txRef, amount: submission.amount, planKey, durationDays },
  });

  // Best-effort — a failed confirmation email must never fail the actual
  // payment processing above, and this webhook always returns 200 to
  // Flutterwave regardless (see the `ok()` comment at the top of this file).
  const sendGridKey = Deno.env.get('SENDGRID_API_KEY');
  if (sendGridKey && profile?.email) {
    const amountLabel = `${submission.currency ?? 'KES'} ${Number(submission.amount).toLocaleString()}`;
    const subject = 'Payment confirmed — TrackWyze';
    try {
      await sendEmail({
        apiKey: sendGridKey,
        to: profile.email,
        subject,
        html: emailLayout(subject, `<p>Hi ${profile.full_name || 'there'},</p><p>We've confirmed ${amountLabel} for the ${BILLING_PLANS[planKey].label}. Your TrackWyze subscription is active — thank you for staying with us.</p>`),
        text: `Hi ${profile.full_name || 'there'},\n\nWe've confirmed ${amountLabel} for the ${BILLING_PLANS[planKey].label}. Your TrackWyze subscription is active.`,
      });
    } catch (err) {
      console.error('flutterwave-webhook: confirmation email failed', err);
    }
  }

  return ok();
});
