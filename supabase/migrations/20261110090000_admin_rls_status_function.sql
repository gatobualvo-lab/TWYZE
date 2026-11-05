/*
  # A live RLS status check for the Admin Panel

  The Admin Panel's "RLS Policies" tab was a hand-written, hard-coded description of which
  tables have row level security and what the rules roughly are. It had already drifted out of
  date (it named about 20 tables; the app now has many more) and, worse, presented stale text as
  if it were live fact — exactly the wrong thing to trust when checking whether a table is
  actually protected.

  This replaces it with a real function the admin UI can call: for every table in the public
  schema, whether RLS is actually turned on and how many policies exist. A table with RLS off,
  or RLS on with zero policies (which blocks every row, not none — also worth flagging), is real,
  current information instead of a guess.
*/

CREATE OR REPLACE FUNCTION public.admin_list_rls_status()
RETURNS TABLE (table_name text, rls_enabled boolean, policy_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.relname::text,
    c.relrowsecurity,
    COUNT(p.polname)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_rls_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_rls_status() TO authenticated;
