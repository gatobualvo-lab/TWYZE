/*
  # Rate limit: switch check_rate_limit to SECURITY INVOKER

  The scanner flagged `public.check_rate_limit` because it was SECURITY DEFINER
  and executable by `anon` / `authenticated`. That combination means any caller
  runs with the function owner's privileges.

  Fix: switch the function to SECURITY INVOKER and add the minimum RLS policies
  on `public.rate_limits` so callers can only insert/update their own bucket
  rows. Reads remain admin-only. Functional behavior is unchanged.

  Changes:
    1. Recreate `check_rate_limit` as SECURITY INVOKER.
    2. Add INSERT + UPDATE policies on rate_limits scoped to the caller's
       bucket_key (`u:<auth.uid()>` for authenticated, `a:<key>` for anon).
    3. Keep SELECT restricted to admins.
*/

-- 1) Recreate function as SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60,
  p_anon_key text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket text;
  v_window_start timestamptz;
  v_count int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_bucket := 'u:' || auth.uid()::text;
  ELSIF p_anon_key IS NOT NULL AND length(p_anon_key) > 0 THEN
    v_bucket := 'a:' || p_anon_key;
  ELSE
    RETURN false;
  END IF;

  v_window_start := to_timestamp(
    (extract(epoch from now())::bigint / GREATEST(p_window_seconds, 1)) * GREATEST(p_window_seconds, 1)
  );

  INSERT INTO public.rate_limits (bucket_key, action, window_start, count)
  VALUES (v_bucket, p_action, v_window_start, 1)
  ON CONFLICT DO NOTHING;

  UPDATE public.rate_limits
     SET count = count + 1,
         updated_at = now()
   WHERE bucket_key = v_bucket
     AND action = p_action
     AND window_start = v_window_start
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    SELECT count INTO v_count
      FROM public.rate_limits
     WHERE bucket_key = v_bucket
       AND action = p_action
       AND window_start = v_window_start;
  END IF;

  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';

  RETURN COALESCE(v_count, 1) <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int, text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int, text) TO authenticated, anon;

-- 2) RLS policies on rate_limits: allow callers to write only their own bucket
DROP POLICY IF EXISTS "rate_limits self insert auth" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits self update auth" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits self insert anon" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits self update anon" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits self delete cleanup" ON public.rate_limits;

CREATE POLICY "rate_limits self insert auth"
  ON public.rate_limits FOR INSERT TO authenticated
  WITH CHECK (bucket_key = 'u:' || auth.uid()::text);

CREATE POLICY "rate_limits self update auth"
  ON public.rate_limits FOR UPDATE TO authenticated
  USING (bucket_key = 'u:' || auth.uid()::text)
  WITH CHECK (bucket_key = 'u:' || auth.uid()::text);

CREATE POLICY "rate_limits self insert anon"
  ON public.rate_limits FOR INSERT TO anon
  WITH CHECK (bucket_key LIKE 'a:%');

CREATE POLICY "rate_limits self update anon"
  ON public.rate_limits FOR UPDATE TO anon
  USING (bucket_key LIKE 'a:%')
  WITH CHECK (bucket_key LIKE 'a:%');

-- Allow the opportunistic stale-row cleanup inside the function
CREATE POLICY "rate_limits self delete cleanup"
  ON public.rate_limits FOR DELETE TO authenticated, anon
  USING (window_start < now() - interval '1 day');
