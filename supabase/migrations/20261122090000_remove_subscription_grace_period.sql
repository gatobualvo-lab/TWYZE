/*
  # Remove the subscription grace period

  ## Why
  Product decision: no grace period at all. A lapsed subscription now reads as Free the
  instant subscription_expiry passes — src/services/subscription/entitlements.ts already
  does this (its 3-day grace branch was removed in the same change that added this
  migration). The one thing kept from the grace-period work is the "ends soon" warning
  email sent 3 days before expiry (scheduled-emails' lifecycle task) — that stays as-is.

  This drops the "promote 'expired' to 'restricted' after N days" step from
  apply_my_subscription_lapse() (20260820150000, last changed by
  20261112090000_subscription_grace_period_emails.sql). 'restricted' is never read
  specially anywhere else (src/services/subscription/subscriptionLapseService.ts only
  treats 'suspended' as restricting access, and src/utils/subscription.ts already shows
  the same "Free plan" label for both 'expired' and 'restricted'), so a lapsed account
  now just stays 'expired' — no second stage, nothing else changes.
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

  IF v_new_status <> v_status THEN
    UPDATE public.profiles
    SET subscription_status = v_new_status, updated_at = now()
    WHERE id = auth.uid();
  END IF;

  RETURN v_new_status;
END;
$$;
