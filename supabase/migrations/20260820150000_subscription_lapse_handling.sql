/*
  # Subscription lapse handling

  ## Why
  Nothing in this codebase ever transitioned `profiles.subscription_status`
  away from 'active'/'trial' once `subscription_expiry`/`trial_end_date`
  passed — the only way a profile became 'expired' was an admin manually
  setting it via the admin panel. This adds automatic lapse detection with
  a 5-day grace period, landing in a new 'restricted' status (view-only in
  the app — see the client-side gating in Dashboard.tsx) rather than any
  destructive action. No data is ever deleted by this.

  ## Why a self-scoped function, not a cron job
  Same constraint noted in the recurring-expenses migration: no Edge
  Function/cron infrastructure exists in this project. Rather than a
  cross-user batch job (which would need SECURITY DEFINER and elevated
  trust), this function only ever reads/writes the CALLING user's own
  profile row, exactly like run_due_recurring_expenses(). It's called once
  per session on Dashboard mount, so a lapse is detected the next time that
  specific user opens the app — no scheduler needed, and RLS on `profiles`
  already prevents it from touching anyone else's row even if called
  directly.

  ## Scope note (deliberate, not an oversight)
  This migration only handles *detecting and recording* the lapse
  (updating subscription_status). Restricting what a 'restricted' account
  can actually do is enforced client-side (hiding the create-flow screens)
  for this pass, not via RLS on every table — turning this into full
  RLS-level enforcement across every table would be a much larger, riskier
  change than the "simple stand-in" scope this was asked to be.
*/

CREATE OR REPLACE FUNCTION public.apply_my_subscription_lapse()
RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
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
