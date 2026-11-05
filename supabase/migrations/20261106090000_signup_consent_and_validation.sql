/*
  # Signup: a record of consent, and only sensible values accepted

  1. Consent records
     - profiles.terms_accepted_at / terms_version   when the person agreed to the Terms of Service and
                                                    Privacy Policy at signup, and which version of them
     - notification_preferences.email_consent_at    when the person ticked "email me" at signup
     The signup form sends terms_accepted / terms_version / email_opt_in in the signup details and the
     signup trigger turns them into these columns. The two profile columns cannot be changed by the
     person afterwards (the same guard that protects role and subscription fields), so the record holds.
     An account created without them (an older copy of the app, or one that already exists) simply has
     no record; nothing is refused for that.

  2. Safer signup values
     The signup API accepts any text for the details, whatever the form allows. The trigger now keeps
     only sensible values: the name is trimmed and cut to 100 characters, the business type and
     "how did you hear" answers must be one of the known options (otherwise left empty), and the terms
     version is cut to 20 characters. The known options are the same lists the form uses
     (src/constants/businessCategory.ts); a test fails if they drift apart.

  This is the same signup trigger as before (the age check from 20261105090000_signup_age_check.sql and
  the email choice from 20261102090000_email_preferences.sql included), with the changes above.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_consent_at timestamptz;

-- The consent record cannot be edited by the person it belongs to.
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
    OR NEW.terms_accepted_at     IS DISTINCT FROM OLD.terms_accepted_at
    OR NEW.terms_version         IS DISTINCT FROM OLD.terms_version
    THEN
      RAISE EXCEPTION 'Not allowed to change role, subscription or consent fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  v_opted_in boolean := lower(COALESCE(NEW.raw_user_meta_data->>'email_opt_in', '')) = 'true';
  v_name text := left(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), 100);
  v_phone text := left(btrim(COALESCE(NEW.raw_user_meta_data->>'phone_number', '')), 20);
  -- Only the options the signup form offers (keep in step with src/constants/businessCategory.ts).
  v_category text := NULLIF(NEW.raw_user_meta_data->>'business_category', '');
  v_referral text := NULLIF(NEW.raw_user_meta_data->>'referral_source', '');
  v_terms_at timestamptz := NULL;
  v_terms_version text := NULL;
BEGIN
  IF lower(COALESCE(NEW.raw_user_meta_data->>'age_group', '')) = 'under_18' THEN
    RAISE EXCEPTION 'Trackwyze is for people aged 18 and above' USING ERRCODE = 'P0001';
  END IF;

  IF v_currency !~ '^[A-Z]{3}$' THEN
    v_currency := 'KES';
  END IF;

  IF v_category IS NOT NULL AND v_category NOT IN (
    'retail', 'services', 'food_beverage', 'fashion_beauty', 'construction_hardware', 'agriculture', 'other'
  ) THEN
    v_category := NULL;
  END IF;

  IF v_referral IS NOT NULL AND v_referral NOT IN (
    'social_media', 'whatsapp', 'friend_referral', 'search_engine', 'radio_tv', 'agent_representative', 'other'
  ) THEN
    v_referral := NULL;
  END IF;

  IF lower(COALESCE(NEW.raw_user_meta_data->>'terms_accepted', '')) = 'true' THEN
    v_terms_at := NOW();
    v_terms_version := NULLIF(left(btrim(COALESCE(NEW.raw_user_meta_data->>'terms_version', '')), 20), '');
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, phone_number, role,
      business_category, referral_source, currency,
      subscription_status, current_billing_cycle,
      terms_accepted_at, terms_version,
      created_at, updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_name,
      v_phone,
      'user'::user_role,
      v_category,
      v_referral,
      v_currency,
      'trial',
      'trial',
      v_terms_at,
      v_terms_version,
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
    INSERT INTO public.notification_preferences (user_id, emails_unsubscribed, emails_unsubscribed_at, email_consent_source, email_consent_at)
    VALUES (
      NEW.id,
      v_opted_out,
      CASE WHEN v_opted_out THEN NOW() ELSE NULL END,
      'signup',
      CASE WHEN v_opted_in THEN NOW() ELSE NULL END
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not save email preference for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$fn$;
