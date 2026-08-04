-- Harden SECURITY DEFINER functions against PostgREST exposure
-- Drops legacy create_admin_user_sql and get_credentials_by_phone (unused).
-- Moves is_admin and handle_new_user into a private schema PostgREST does
-- not expose, then re-points RLS policies and the auth trigger.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Relocate is_admin
CREATE OR REPLACE FUNCTION private.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.role = 'admin'::user_role
  );
$fn$;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated;

-- Recreate every RLS policy that referenced public.is_admin
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can read own submissions" ON public.payment_submissions;
CREATE POLICY "Users can read own submissions" ON public.payment_submissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update submissions" ON public.payment_submissions;
CREATE POLICY "Admins can update submissions" ON public.payment_submissions
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
CREATE POLICY "Admins can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "adx read own or admin" ON public.ad_expenses;
CREATE POLICY "adx read own or admin" ON public.ad_expenses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ve read own or admin" ON public.vendor_expenses;
CREATE POLICY "ve read own or admin" ON public.vendor_expenses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ve update own or admin" ON public.vendor_expenses;
CREATE POLICY "ve update own or admin" ON public.vendor_expenses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ve delete own or admin" ON public.vendor_expenses;
CREATE POLICY "ve delete own or admin" ON public.vendor_expenses
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Relocate handle_new_user
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, phone_number, role,
      subscription_status, current_billing_cycle, created_at, updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone_number', ''), ''),
      'user'::user_role,
      'trial',
      'trial',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email      = EXCLUDED.email,
      full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop unused / dangerous helpers
DROP FUNCTION IF EXISTS public.create_admin_user_sql(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.get_credentials_by_phone(text);
