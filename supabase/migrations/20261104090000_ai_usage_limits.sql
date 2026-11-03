/*
  # Question limits for the two AI assistants, by plan

  The TrackWyze Guide ('guide') and the AI Business Advisor ('advisor') cost money for every question,
  so each plan gets a limit per hour, per day and per month (the numbers live in the Edge Functions,
  in _shared/aiLimits.ts, and are passed in here). The windows are rolling: the last hour, the last 24
  hours and the last 30 days.

  - ai_usage_events        one row per question that was allowed. Nobody can read it directly except an
                           admin; people see their own counts through ai_usage().
  - consume_ai_quota(...)  called by the Edge Function before it asks Claude. Counts, and only when the
                           person is within all three limits records the question. Returns what was
                           used and, when refused, which limit was hit and when a slot frees up.
  - ai_usage(assistant)    the person's own counts, so the app can show "7 questions left today".

  Old events are removed as new ones arrive (anything older than 35 days).
*/

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant text NOT NULL CHECK (assistant IN ('guide', 'advisor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_lookup_idx
  ON public.ai_usage_events (user_id, assistant, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_events_admin_read" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_admin_read" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

REVOKE ALL ON public.ai_usage_events FROM anon, authenticated;
GRANT SELECT ON public.ai_usage_events TO authenticated; -- limited to admins by the policy above

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_assistant text,
  p_per_hour integer,
  p_per_day integer,
  p_per_month integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_hour integer;
  v_day integer;
  v_month integer;
  v_reason text;
  v_limit integer;
  v_window interval;
  v_free_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;
  IF p_assistant NOT IN ('guide', 'advisor') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid');
  END IF;

  -- Two questions at once from the same person must not both slip through.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || ':' || p_assistant));

  DELETE FROM public.ai_usage_events WHERE user_id = v_user AND created_at < now() - interval '35 days';

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    count(*)
  INTO v_hour, v_day, v_month
  FROM public.ai_usage_events
  WHERE user_id = v_user AND assistant = p_assistant AND created_at > now() - interval '30 days';

  IF v_hour >= p_per_hour THEN
    v_reason := 'hour'; v_limit := p_per_hour; v_window := interval '1 hour';
  ELSIF v_day >= p_per_day THEN
    v_reason := 'day'; v_limit := p_per_day; v_window := interval '24 hours';
  ELSIF v_month >= p_per_month THEN
    v_reason := 'month'; v_limit := p_per_month; v_window := interval '30 days';
  END IF;

  IF v_reason IS NOT NULL THEN
    -- The limit frees up when the question that is "limit" places back ages out of the window.
    SELECT created_at + v_window INTO v_free_at
    FROM public.ai_usage_events
    WHERE user_id = v_user AND assistant = p_assistant AND created_at > now() - v_window
    ORDER BY created_at DESC
    OFFSET GREATEST(v_limit - 1, 0) LIMIT 1;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', v_reason,
      'retry_after_seconds', GREATEST(1, COALESCE(ceil(extract(epoch FROM (v_free_at - now())))::integer, 1)),
      'used_hour', v_hour, 'used_day', v_day, 'used_month', v_month
    );
  END IF;

  INSERT INTO public.ai_usage_events (user_id, assistant) VALUES (v_user, p_assistant);

  RETURN jsonb_build_object(
    'allowed', true,
    'used_hour', v_hour + 1, 'used_day', v_day + 1, 'used_month', v_month + 1
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.ai_usage(p_assistant text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'used_hour',  count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    'used_day',   count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    'used_month', count(*)
  )
  FROM public.ai_usage_events
  WHERE user_id = auth.uid() AND assistant = p_assistant AND created_at > now() - interval '30 days';
$fn$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(text, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_usage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage(text) TO authenticated;
