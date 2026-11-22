/*
  # Accept "event_planning" as a business category

  src/constants/businessCategory.ts gained an 'event_planning' option (an event organizer
  running festivals/weddings/conferences as their business, not a one-off event tracked by
  someone else's business — see the new Projects "Event" kind in
  20261122110000_event_planning.sql and 20261122120000_event_ticket_sales.sql). The signup
  trigger's allowlist (20261106090000_signup_consent_and_validation.sql) only kept the
  categories the form offered at the time, so it would have silently dropped this one —
  this is the same function, unchanged except for that one value joining the list.
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
    'retail', 'services', 'food_beverage', 'fashion_beauty', 'construction_hardware', 'agriculture', 'event_planning', 'other'
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
