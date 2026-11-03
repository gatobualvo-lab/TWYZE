/*
  # Email preferences: one master switch, chosen at signup, honoured by every email

  - notification_preferences.emails_unsubscribed   true once the person has turned TrackWyze emails off
                                                   (from the link in any email, or in the app)
  - notification_preferences.emails_unsubscribed_at  when that happened
  - notification_preferences.email_consent_source  where the choice came from:
                                                   'signup', 'email-link' or 'settings'

  Everything optional (welcome, reminders, business reports, alerts, announcements) is skipped for a
  person who has unsubscribed. Payment receipts and notices about the account itself are still sent,
  and the email says so.

  New accounts: the signup form has a tick box ("Email me ...") that is sent along as
  `email_opt_in` in the signup details. The trigger below turns it into this setting. Accounts that
  already exist stay subscribed (nothing changes for them), and an account created without that
  detail (for example by an older copy of the app) stays subscribed too.

  Unsubscribing from an email link works without logging in: the link carries a signed token, and the
  email-unsubscribe Edge Function (service role) is the only thing that writes the setting that way.
*/

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS emails_unsubscribed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emails_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_consent_source text;

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_consent_source_chk;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_consent_source_chk
  CHECK (email_consent_source IS NULL OR email_consent_source IN ('signup', 'email-link', 'settings'));

-- The same signup trigger as before, now also saving the email choice made on the signup form.
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
