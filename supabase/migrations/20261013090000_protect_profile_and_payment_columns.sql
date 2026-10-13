/*
  # Stop users editing their own role/subscription, or forging payments

  ## 1. profiles: role and subscription fields
  The profiles UPDATE policy lets a user update their own row with no column
  restriction (RLS is row-level, not column-level), so any logged-in user
  could call the API directly and set role = 'admin', or push
  subscription_status / subscription_expiry to get a free plan. Verified
  against the live project with a harmless write to subscription_expiry.

  A BEFORE UPDATE trigger now rejects changes to the privileged columns when
  the statement comes straight from a client (current_user is
  authenticated/anon) and the caller isn't an admin. Still allowed:
  - admins (private.is_admin) editing users from the admin panel
  - Edge Functions using the service role
  - SECURITY DEFINER functions (current_user is the function owner)
  - users editing their own name, phone, business_category, etc.

  apply_my_subscription_lapse() ran as the user and relied on being able to
  write subscription_status, so it becomes SECURITY DEFINER. It still only
  ever touches auth.uid()'s own row.

  ## 2. payment_submissions: forged gateway payments
  The INSERT policy only checked user_id = auth.uid(), so a user could insert
  their own source='gateway' row with any amount/plan_key, and the Flutterwave
  webhook trusts the amount stored on that row (e.g. pay KES 1 for a plan).
  create-checkout now inserts gateway rows with the service key, and users may
  only insert plain pending manual-proof rows.

  ORDER MATTERS: deploy the updated create-checkout Edge Function BEFORE
  running this migration, otherwise checkout would be rejected by the new
  policy until the function is redeployed.
*/

-- 1. profiles ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT private.is_admin(auth.uid()) THEN
    IF NEW.role                  IS DISTINCT FROM OLD.role
    OR NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status
    OR NEW.subscription_expiry   IS DISTINCT FROM OLD.subscription_expiry
    OR NEW.current_billing_cycle IS DISTINCT FROM OLD.current_billing_cycle
    OR NEW.trial_start_date      IS DISTINCT FROM OLD.trial_start_date
    OR NEW.trial_end_date        IS DISTINCT FROM OLD.trial_end_date
    THEN
      RAISE EXCEPTION 'Not allowed to change role or subscription fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_privileged_columns();

CREATE OR REPLACE FUNCTION public.apply_my_subscription_lapse()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_sub_expiry timestamptz;
  v_trial_end timestamptz;
  v_new_status text;
BEGIN
  SELECT subscription_status, subscription_expiry, trial_end_date
    INTO v_status, v_sub_expiry, v_trial_end
    FROM public.profiles
    WHERE id = auth.uid();

  IF v_status IS NULL THEN
    RETURN v_status;
  END IF;

  v_new_status := v_status;

  IF v_status = 'active' AND v_sub_expiry IS NOT NULL AND v_sub_expiry < now() THEN
    v_new_status := 'expired';
  ELSIF v_status = 'trial' AND v_trial_end IS NOT NULL AND v_trial_end < now() THEN
    v_new_status := 'expired';
  END IF;

  IF v_new_status = 'expired' AND COALESCE(v_sub_expiry, v_trial_end) < now() - interval '5 days' THEN
    v_new_status := 'restricted';
  END IF;

  IF v_new_status <> v_status THEN
    UPDATE public.profiles
    SET subscription_status = v_new_status, updated_at = now()
    WHERE id = auth.uid();
  END IF;

  RETURN v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_my_subscription_lapse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_my_subscription_lapse() TO authenticated;

-- 2. payment_submissions -----------------------------------------------------

-- Policies are OR'd together, so every older permissive INSERT policy has to
-- go, whatever it was called in earlier migrations.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_submissions' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.payment_submissions', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "payment_submissions_insert_manual_pending"
  ON public.payment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND source = 'manual'
    AND status = 'pending'
    AND gateway IS NULL
    AND gateway_reference IS NULL
    AND gateway_transaction_id IS NULL
    AND plan_key IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
  );
