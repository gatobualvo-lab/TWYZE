// Public address Safaricom reports STK push results to, so there is no user to trust here. Three
// things gate it:
//   1. the secret in the address (?token=...) must match MPESA_CALLBACK_SECRET;
//   2. the CheckoutRequestID must belong to a payment we created and that is still pending;
//   3. the report is NEVER taken at its word: we ask Daraja directly (STK query) and only act on
//      what it says. A report is just a "go and check" nudge, the same idea as the Flutterwave webhook.
// Deploy this one with "Verify JWT" switched OFF (Safaricom does not send a Supabase token).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseStkCallback, readDarajaConfig, safeEqual, settleStkResult, stkQuery } from '../_shared/mpesa.ts';
import type { PaymentSubmission, StkQueryOutcome } from '../_shared/mpesa.ts';

// Safaricom wants a quick "received" answer whatever happens next; retries would not fix our own
// "unknown payment" cases and could cause duplicates.
function accepted(): Response {
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const config = readDarajaConfig(key => Deno.env.get(key));
  const token = new URL(req.url).searchParams.get('token');
  if (!config || !safeEqual(token, config.callbackSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const report = parseStkCallback(await req.json().catch(() => null));
  if (!report) return accepted();

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: submission } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('gateway', 'mpesa')
    .eq('gateway_transaction_id', report.checkoutRequestId)
    .maybeSingle();

  if (!submission) {
    console.error('stk-callback: no payment for', report.checkoutRequestId);
    return accepted();
  }
  if (submission.status !== 'pending') return accepted();

  // Ask Daraja what really happened. It can briefly say "still processing" right after the
  // report, so try a few times before leaving it for the status check to settle.
  let verdict: StkQueryOutcome = { state: 'pending' };
  for (let attempt = 0; attempt < 3; attempt++) {
    verdict = await stkQuery(config, report.checkoutRequestId);
    if (verdict.state !== 'pending') break;
    await sleep(1500);
  }
  if (verdict.state === 'pending') {
    console.error('stk-callback: could not confirm with Daraja yet', report.checkoutRequestId);
    return accepted();
  }

  try {
    await settleStkResult(
      supabase,
      submission as PaymentSubmission,
      verdict.state === 'success'
        ? { resultCode: 0, resultDesc: verdict.resultDesc, amount: report.amount, receipt: report.receipt }
        : { resultCode: verdict.resultCode, resultDesc: verdict.resultDesc }
    );
  } catch (err) {
    console.error('stk-callback: settle failed', err);
  }
  return accepted();
});
