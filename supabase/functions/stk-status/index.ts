// Lets the app settle an M-Pesa payment itself while the user waits, in case Safaricom's report is
// late or never arrives. Signed-in users only, and only for their own payments. It asks Daraja
// what happened (STK query) and applies the same settle step as stk-callback, so the two can
// never double-activate a subscription.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { readDarajaConfig, settleStkResult, stkQuery } from '../_shared/mpesa.ts';
import type { PaymentSubmission } from '../_shared/mpesa.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Requests still undecided after this long are treated as timed out. */
const GIVE_UP_AFTER_MS = 10 * 60 * 1000;
/** Do not query Daraja in the first seconds; the customer has not had time to answer. */
const MIN_AGE_MS = 8 * 1000;

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

    const { txRef } = (await req.json().catch(() => ({}))) as { txRef?: string };
    if (!txRef || typeof txRef !== 'string') return json({ error: 'txRef is required' }, 400);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const read = () =>
      admin
        .from('payment_submissions')
        .select('*')
        .eq('gateway', 'mpesa')
        .eq('gateway_reference', txRef)
        .eq('user_id', user.id)
        .maybeSingle();

    const { data: submission } = await read();
    if (!submission) return json({ error: 'Payment not found' }, 404);
    if (submission.status !== 'pending') {
      return json({ status: submission.status, message: submission.admin_notes ?? null });
    }

    const ageMs = Date.now() - new Date(submission.submitted_at ?? Date.now()).getTime();
    const config = readDarajaConfig(key => Deno.env.get(key));
    if (!config || !submission.gateway_transaction_id || ageMs < MIN_AGE_MS) {
      return json({ status: 'pending', message: null });
    }

    const verdict = await stkQuery(config, submission.gateway_transaction_id);
    if (verdict.state === 'success') {
      await settleStkResult(admin, submission as PaymentSubmission, { resultCode: 0, resultDesc: verdict.resultDesc });
    } else if (verdict.state === 'failed') {
      await settleStkResult(admin, submission as PaymentSubmission, { resultCode: verdict.resultCode, resultDesc: verdict.resultDesc });
    } else if (ageMs > GIVE_UP_AFTER_MS) {
      // 1037 = "no response from the customer"
      await settleStkResult(admin, submission as PaymentSubmission, { resultCode: 1037, resultDesc: 'Timed out waiting for the customer' });
    }

    const { data: latest } = await read();
    return json({ status: latest?.status ?? 'pending', message: latest?.admin_notes ?? null });
  } catch (err) {
    console.error('stk-status error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
