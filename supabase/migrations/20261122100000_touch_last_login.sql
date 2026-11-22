/*
  # Wire up profiles.last_login

  ## Why
  profiles.last_login has existed since the original schema and the admin User Management
  screen already reads it (src/components/admin/UserManagement.tsx shows "Never" when it's
  null) — but nothing in the live app ever sets it. The only code that did
  (an update_last_login() function) only ever existed in .bolt/supabase_discarded_migrations,
  which were never applied. This adds a self-scoped function in the same style as
  apply_my_subscription_lapse(): it only ever touches the CALLING user's own row, so no
  elevated trust is needed and RLS on profiles already prevents it touching anyone else's.
*/

CREATE OR REPLACE FUNCTION public.touch_my_last_login()
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles SET last_login = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_my_last_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_my_last_login() TO authenticated;
