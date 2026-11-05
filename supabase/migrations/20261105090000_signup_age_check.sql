/*
  # Under-18 signups are refused

  The signup form asks for an age group (age_group in the signup details). TrackWyze is for adults, so
  "under_18" cannot sign up. The form already stops it; this makes the database refuse it too, so
  calling the signup API directly does not get around the form.

  An account created without an age_group (for example by an older copy of the app, or an account that
  already exists) is not affected: only an explicit "under_18" is refused.

  This is the same signup trigger as before (including the email choice saved by
  20261102090000_email_preferences.sql), with the age check added at the start.
*/

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_currency text := upper(COALESCE(NULLIF(NEW.raw_user_meta_data->>'currency', ''), 'KES'));
  -- Only an explicit "false" opts out; a missing value keeps the account subscribed.
  v_opted_out boolean := lower(COALESCE(NEW.raw_user_meta_data->>'email_opt_in', 'true')) = 'false';
BEGIN
  IF lower(COALESCE(NEW.raw_user_meta_data->>'age_group', '')) = 'under_18' THEN
    RAISE EXCEPTION 'Trackwyze is for people aged 18 and above' USING ERRCODE = 'P0001';
  END IF;

  IF v_currency !~ '^[A-Z]{3}$' THEN
    v_currency := 'KES';
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, phone_number, role,
      business_category, referral_source, currency,
      subscription_status, current_billing_cycle, created_at, updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone_number', ''), ''),
      'user'::user_role,
      NULLIF(NEW.raw_user_meta_data->>'business_category', ''),
      NULLIF(NEW.raw_user_meta_data->>'referral_source', ''),
      v_currency,
      'trial',
      'trial',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email             = EXCLUDED.email,
      full_name         = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      business_category = COALESCE(EXCLUDED.business_category, public.profiles.business_category),
      referral_source    = COALESCE(EXCLUDED.referral_source, public.profiles.referral_source),
      updated_at        = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  -- Saving the email choice must never stop an account from being created.
  BEGIN
    INSERT INTO public.notification_preferences (user_id, emails_unsubscribed, emails_unsubscribed_at, email_consent_source)
    VALUES (
      NEW.id,
      v_opted_out,
      CASE WHEN v_opted_out THEN NOW() ELSE NULL END,
      'signup'
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not save email preference for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$fn$;
