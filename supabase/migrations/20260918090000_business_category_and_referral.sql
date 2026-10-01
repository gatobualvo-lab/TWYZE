/*
  # Business category + referral source

  Adds two fields collected at signup:
  - business_category: drives per-category terminology and nav ordering
    across the app (e.g. "Sales" vs "Jobs", "Customers" vs "Clients").
  - referral_source: how the user heard about TrackWyze, for marketing
    attribution.

  Both are nullable (existing users won't have a value) and constrained to
  the fixed option sets the signup form offers, matching
  src/constants/businessCategory.ts exactly.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS referral_source text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_category_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_category_chk
  CHECK (business_category IS NULL OR business_category IN (
    'retail', 'services', 'food_beverage', 'fashion_beauty',
    'construction_hardware', 'agriculture', 'other'
  ));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referral_source_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referral_source_chk
  CHECK (referral_source IS NULL OR referral_source IN (
    'social_media', 'whatsapp', 'friend_referral', 'search_engine',
    'radio_tv', 'agent_representative', 'other'
  ));

-- Pull the two new fields from signup metadata, same pattern as
-- full_name/phone_number already use.
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
      business_category, referral_source,
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
