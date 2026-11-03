// The TrackWyze Guide: the floating "ask how to use the app" assistant. Signed-in users only. It is
// deliberately separate from ai-business-assistant: no business data is read here, so the only things
// Claude sees are the conversation, the page the person is on and their plan (see _shared/helpAssistant.ts).
// Costs money per question, so each plan has its own limits per hour, day and month (_shared/aiLimits.ts;
// fails closed, like the Business Advisor).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HelpModelError, askHelpModel, parseHelpRequest } from '../_shared/helpAssistant.ts';
import { consumeQuota, tierOf } from '../_shared/aiLimits.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'invalid_request' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'not_authenticated' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'not_authenticated' }, 401);

    const request = parseHelpRequest(await req.json().catch(() => null));
    if (!request) return json({ error: 'invalid_request' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'assistant_unavailable' }, 503);

    // The plan comes from the account itself, never from what the browser says.
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_expiry, trial_end_date, current_billing_cycle')
      .eq('id', user.id)
      .maybeSingle();
    const tier = tierOf(profile);

    const quota = await consumeQuota(supabase, 'guide', tier);
    if (!quota.allowed) {
      return json({ error: 'rate_limited', reason: quota.reason, retryAfterSeconds: quota.retryAfterSeconds }, 429);
    }

    const answer = await askHelpModel(apiKey, { ...request, tier });
    return json({ reply: answer.reply, pages: answer.pages, needsHuman: answer.needsHuman, quota: quota.quota });
  } catch (err) {
    console.error('app-help error:', err);
    return json({ error: err instanceof HelpModelError ? 'assistant_unavailable' : 'unknown' }, err instanceof HelpModelError ? 502 : 500);
  }
});
