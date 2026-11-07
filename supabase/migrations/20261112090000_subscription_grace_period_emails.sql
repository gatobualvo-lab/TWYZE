/*
  # Subscription grace period: 3 days, plus a log table for lifecycle emails

  ## Why
  apply_my_subscription_lapse() (20260820150000_subscription_lapse_handling.sql) used a 5-day
  grace period. The product decision is now 3 days: a lapsed payment still works for 3 days,
  then the account reads as Free (src/services/subscription/entitlements.ts computes this from
  subscription_expiry directly — this function only keeps profiles.subscription_status in step for
  anything that still reads that column, e.g. admin screens and the scheduled-emails report query).

  ## subscription_lifecycle_emails
  Lets the scheduled-emails Edge Function send, at most once per plan cycle:
    - 'expiry_warning'  — a few days before subscription_expiry
    - 'grace_reminder'  — once the grace period has started
    - 'demoted'         — once the grace period has ended and the account is back on Free
  Keyed by (user_id, subscription_expiry, email_type) rather than a boolean column on profiles,
  so paying again (which moves subscription_expiry forward) naturally allows the same three
  emails to fire again on the next lapse — the same reasoning as period_report_log.
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

  IF v_new_status = 'expired' AND COALESCE(v_sub_expiry, v_trial_end) < now() - interval '3 days' THEN
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

CREATE TABLE IF NOT EXISTS public.subscription_lifecycle_emails (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_expiry timestamptz NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('expiry_warning', 'grace_reminder', 'demoted')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subscription_expiry, email_type)
);

-- No policies on purpose: only the service role (the scheduled function) touches this.
ALTER TABLE public.subscription_lifecycle_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_lifecycle_emails FORCE ROW LEVEL SECURITY;
