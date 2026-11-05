// Starts an M-Pesa STK push for a TrackWyze subscription: the user's phone shows the M-Pesa PIN
// prompt. Signed-in users only. Like create-checkout, the client never decides the price: the plan
// is looked up here, and the pending payment row is created here with the service key.
// The result arrives at stk-callback (and is double-checked there), or via stk-status.
// See _shared/mpesa.ts for the whole picture and the secrets this needs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { BILLING_PLANS, isBillingPlanKey } from '../_shared/plans.ts';
import { normalizeKenyanPhone, readDarajaConfig, stkPush } from '../_shared/mpesa.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** 2547 12 345 678 -> 2547*****678: enough for an admin to recognise, not a full number in notes. */
function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}

const REQUEST_COOLDOWN_MS = 90 * 1000;
const MAX_REQUESTS_PER_HOUR = 6;
const MAX_PROMPTS_PER_PHONE_PER_HOUR = 4;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const { plan, phone } = body as { plan?: string; phone?: string };
    if (!isBillingPlanKey(plan)) return json({ error: 'Invalid plan' }, 400);
    const msisdn = normalizeKenyanPhone(phone);
    if (!msisdn) return json({ error: 'Enter a valid M-Pesa number, for example 0712 345 678.' }, 400);

    const config = readDarajaConfig(key => Deno.env.get(key));
    if (!config) {
      return json({ code: 'MPESA_NOT_CONFIGURED', error: 'M-Pesa payments are not switched on yet.' }, 503);
    }

    const planConfig = BILLING_PLANS[plan];
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // One request at a time, and not an endless stream of prompts to someone's phone.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from('payment_submissions')
      .select('id, status, submitted_at')
      .eq('user_id', user.id)
      .eq('gateway', 'mpesa')
      .gte('submitted_at', hourAgo);
    const rows = recent ?? [];
    if (rows.some(r => r.status === 'pending' && r.submitted_at && Date.now() - new Date(r.submitted_at).getTime() < REQUEST_COOLDOWN_MS)) {
      return json({ error: 'A payment request was just sent to your phone. Enter your PIN, or wait a minute and try again.' }, 429);
    }
    if (rows.length >= MAX_REQUESTS_PER_HOUR) {
      return json({ error: 'Too many payment requests. Please try again in an hour, or contact support.' }, 429);
    }

    // The same phone cannot be sent a stream of prompts from several accounts either (the note holds the masked number).
    const { count: promptsToPhone } = await admin
      .from('payment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('gateway', 'mpesa')
      .eq('admin_notes', `STK push requested for ${maskPhone(msisdn)}`)
      .gte('submitted_at', hourAgo);
    if ((promptsToPhone ?? 0) >= MAX_PROMPTS_PER_PHONE_PER_HOUR) {
      return json({ error: 'Too many payment requests were sent to that number. Please try again in an hour, or contact support.' }, 429);
    }

    const txRef = `mp_${user.id.slice(0, 8)}_${Date.now()}`;
    const { data: inserted, error: insertError } = await admin
      .from('payment_submissions')
      .insert({
        user_id: user.id,
        amount: planConfig.amount,
        currency: planConfig.currency,
        payment_method: 'M-Pesa',
        source: 'gateway',
        gateway: 'mpesa',
        gateway_reference: txRef,
        plan_key: planConfig.key,
        status: 'pending',
        admin_notes: `STK push requested for ${maskPhone(msisdn)}`,
      })
      .select('id')
      .single();
    if (insertError || !inserted) return json({ error: insertError?.message || 'Could not start the payment' }, 500);

    const callbackUrl = `${supabaseUrl}/functions/v1/stk-callback?token=${encodeURIComponent(config.callbackSecret)}`;
    const result = await stkPush(config, {
      phone: msisdn,
      amount: planConfig.amount,
      reference: 'TrackWyze',
      description: 'Subscription',
      callbackUrl,
    }).catch((error: unknown) => ({ ok: false as const, message: error instanceof Error ? error.message : 'M-Pesa is not reachable right now.' }));

    const stamp = new Date().toISOString();
    if (!result.ok) {
      await admin
        .from('payment_submissions')
        .update({ status: 'rejected', reviewed_at: stamp, admin_notes: `M-Pesa request failed: ${result.message}`, updated_at: stamp })
        .eq('id', inserted.id);
      return json({ error: result.message }, 502);
    }

    // The CheckoutRequestID is how the result is matched back to this payment.
    await admin
      .from('payment_submissions')
      .update({ gateway_transaction_id: result.checkoutRequestId, updated_at: stamp })
      .eq('id', inserted.id);

    return json({
      txRef,
      checkoutRequestId: result.checkoutRequestId,
      amount: planConfig.amount,
      currency: planConfig.currency,
      message: result.customerMessage,
    });
  } catch (err) {
    console.error('stk-push error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
