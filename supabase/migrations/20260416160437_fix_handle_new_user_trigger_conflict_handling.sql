/*
  # Fix handle_new_user trigger function

  ## Problem
  The live handle_new_user trigger function was overwritten with a simpler version
  that lacks:
  1. ON CONFLICT handling (causing failures when username conflicts occur)
  2. Exception handling (causing the entire signup to fail with "Database error saving new user")

  ## Solution
  Restore the full trigger function with:
  - Unique username generation to avoid conflicts
  - ON CONFLICT (id) DO UPDATE for idempotency
  - EXCEPTION handler so trigger never blocks signup
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username extensions.citext;
  v_base_username text;
  v_counter int := 0;
BEGIN
  -- Build a base username from metadata or email prefix
  v_base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  v_username := v_base_username;

  -- Ensure username uniqueness by appending a counter if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := (v_base_username || v_counter::text)::extensions.citext;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    username,
    role,
    subscription_status,
    current_billing_cycle,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    v_username,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user'::user_role),
    'trial',
    'trial',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    username = COALESCE(profiles.username, EXCLUDED.username),
    role = COALESCE(profiles.role, EXCLUDED.role),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
