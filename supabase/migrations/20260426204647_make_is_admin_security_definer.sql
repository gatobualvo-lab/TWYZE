/*
  # Harden is_admin() and ensure admin RLS coverage on profiles

  ## Why
  Admin role-based access reads `profiles.role`. The helper `is_admin(uuid)` is
  used by existing RLS policies. Without SECURITY DEFINER it executes under
  the caller's RLS, which would otherwise force a recursive lookup on profiles
  for every policy check. Locking it down with SECURITY DEFINER + a fixed
  search_path makes the helper safe and consistent.

  ## Changes
  1. Recreate `public.is_admin(uuid)` as SECURITY DEFINER with
     `search_path = public, pg_temp` and STABLE volatility.
  2. Owner: postgres (BYPASSRLS), so the lookup never re-enters RLS.
  3. Re-grant EXECUTE to authenticated and anon roles (needed by RLS evaluation).
  4. No data is destroyed; existing policies that reference is_admin keep working.
*/

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.role = 'admin'::user_role
  );
$$;

ALTER FUNCTION public.is_admin(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
