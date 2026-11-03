// The TrackWyze Guide: the floating "ask how to use the app" assistant. Signed-in users only. It is
// deliberately separate from ai-business-assistant: no business data is read here, so the only things
// Claude sees are the conversation, the page the person is on and their plan (see _shared/helpAssistant.ts).
// Costs money per question, so it is rate limited per person (fails closed, like the Business Advisor).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HelpModelError, askHelpModel, parseHelpRequest } from '../_shared/helpAssistant.ts';

const HOURLY_LIMIT = 30;
const DAILY_LIMIT = 120;

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

    // Both limits must pass. A failed check blocks the question rather than risk unbounded spending.
    for (const [action, max, windowSeconds] of [
      ['app_help.hour', HOURLY_LIMIT, 3600],
      ['app_help.day', DAILY_LIMIT, 86400],
    ] as const) {
      const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
        p_action: action,
        p_max: max,
        p_window_seconds: windowSeconds,
        p_anon_key: '',
      });
      if (error) {
        console.error('app-help: check_rate_limit failed (blocking)', error);
        return json({ error: 'rate_limited', retryAfterSeconds: windowSeconds }, 429);
      }
      if (allowed !== true) return json({ error: 'rate_limited', retryAfterSeconds: windowSeconds }, 429);
    }

    const answer = await askHelpModel(apiKey, request);
    return json({ reply: answer.reply, pages: answer.pages, needsHuman: answer.needsHuman });
  } catch (err) {
    console.error('app-help error:', err);
    return json({ error: err instanceof HelpModelError ? 'assistant_unavailable' : 'unknown' }, err instanceof HelpModelError ? 502 : 500);
  }
});
