/*
  # Security hardening: RLS consolidation, rate limits, storage policies

  Summary:
  1. Force RLS on every public table.
  2. Consolidate duplicate/weak policies on ad_expenses, vendor_expenses.
  3. Add WITH CHECK to UPDATE policies on all user-owned tables.
  4. New rate_limits table + SECURITY DEFINER check_rate_limit() function.
  5. Private storage bucket `user-files` with per-user folder RLS policies.
*/

-- ============================================================
-- 1) Force RLS on every public table
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.schemaname, r.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;',  r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2) ad_expenses: one clean set
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own ad expenses" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx delete own"                   ON public.ad_expenses;
DROP POLICY IF EXISTS "Users can insert own ad expenses" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx insert own"                   ON public.ad_expenses;
DROP POLICY IF EXISTS "Users can read own ad expenses"   ON public.ad_expenses;
DROP POLICY IF EXISTS "adx read own or admin"            ON public.ad_expenses;
DROP POLICY IF EXISTS "Users can update own ad expenses" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx update own"                   ON public.ad_expenses;

CREATE POLICY "ad_expenses select own or admin"
  ON public.ad_expenses FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "ad_expenses insert own"
  ON public.ad_expenses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "ad_expenses update own or admin"
  ON public.ad_expenses FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "ad_expenses delete own or admin"
  ON public.ad_expenses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));

-- ============================================================
-- 3) vendor_expenses: one clean set
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own vendor expenses" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve delete own or admin"               ON public.vendor_expenses;
DROP POLICY IF EXISTS "Users can insert own vendor expenses" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve insert own"                        ON public.vendor_expenses;
DROP POLICY IF EXISTS "Users can read own vendor expenses"   ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve read own or admin"                 ON public.vendor_expenses;
DROP POLICY IF EXISTS "Users can update own vendor expenses" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve update own or admin"               ON public.vendor_expenses;

CREATE POLICY "vendor_expenses select own or admin"
  ON public.vendor_expenses FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "vendor_expenses insert own"
  ON public.vendor_expenses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "vendor_expenses update own or admin"
  ON public.vendor_expenses FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "vendor_expenses delete own or admin"
  ON public.vendor_expenses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));

-- ============================================================
-- 4) Add WITH CHECK to UPDATE policies on user-owned tables
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales','sale_items','suppliers','inventory_items','general_expenses',
    'user_clients','user_delivery_guys','user_expense_types','user_products','user_sellers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own data" ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY "Users can update own data" ON public.%I
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- 5) Rate limits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_bucket_action_idx
  ON public.rate_limits (bucket_key, action, window_start DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits admin read" ON public.rate_limits;
CREATE POLICY "rate_limits admin read"
  ON public.rate_limits FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60,
  p_anon_key text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
    (extract(epoch from now())::bigint / GREATEST(p_window_seconds,1)) * GREATEST(p_window_seconds,1)
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

REVOKE ALL ON FUNCTION public.check_rate_limit(text,int,int,text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,int,int,text) TO authenticated, anon;

-- ============================================================
-- 6) Storage: private bucket + per-user folder policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files','user-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "user-files read own"   ON storage.objects;
DROP POLICY IF EXISTS "user-files insert own" ON storage.objects;
DROP POLICY IF EXISTS "user-files update own" ON storage.objects;
DROP POLICY IF EXISTS "user-files delete own" ON storage.objects;

CREATE POLICY "user-files read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user-files insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user-files update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id='user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user-files delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
