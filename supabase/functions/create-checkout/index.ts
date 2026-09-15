// Mints a pending payment_submissions row server-side (trusted amount, unique
// tx_ref) and hands back what the client needs to open Flutterwave's hosted
// checkout. The client never decides the amount — that would let a tampered
// request pay KES 1 for a KES 1000 plan; this function looks the price up
// itself from BILLING_PLANS.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { BILLING_PLANS, isBillingPlanKey } from '../_shared/plans.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { plan, method } = body as { plan?: string; method?: string };

    if (!isBillingPlanKey(plan)) {
      return json({ error: 'Invalid plan' }, 400);
    }
    if (method !== 'mpesa' && method !== 'card') {
      return json({ error: 'Invalid payment method' }, 400);
    }

    const publicKey = Deno.env.get('FLUTTERWAVE_PUBLIC_KEY');
    if (!publicKey) {
      return json({ error: 'Payment gateway is not configured yet. Ask the admin to add Flutterwave keys.' }, 503);
    }

    const planConfig = BILLING_PLANS[plan];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name, phone_number')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    const txRef = `tw_${user.id.slice(0, 8)}_${Date.now()}`;

    const { error: insertError } = await supabase.from('payment_submissions').insert({
      user_id: user.id,
      amount: planConfig.amount,
      currency: planConfig.currency,
      payment_method: method === 'mpesa' ? 'M-Pesa' : 'Card',
      source: 'gateway',
      gateway: 'flutterwave',
      gateway_reference: txRef,
      plan_key: planConfig.key,
      status: 'pending',
    });
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({
      txRef,
      amount: planConfig.amount,
      currency: planConfig.currency,
      publicKey,
      paymentOptions: method === 'mpesa' ? 'mpesa' : 'card',
      customer: {
        email: profile?.email || user.email || '',
        name: profile?.full_name || '',
        phone: profile?.phone_number || '',
      },
    });
  } catch (err) {
    console.error('create-checkout error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
