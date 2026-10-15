/*
  # Account currency

  Each account chooses the currency it works in (at signup, changeable in
  Account Settings). Amounts are recorded and shown in that currency across
  the app; existing accounts stay on KES.

  Users may edit this column themselves (it is not one of the columns the
  protect_profile_privileged_columns trigger locks).
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_currency_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_chk CHECK (currency ~ '^[A-Z]{3}$');

-- Same trigger as before, now also reading `currency` from signup metadata
-- (falls back to KES if it is missing or malformed).
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_currency text := upper(COALESCE(NULLIF(NEW.raw_user_meta_data->>'currency', ''), 'KES'));
BEGIN
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
  RETURN NEW;
END;
$fn$;
