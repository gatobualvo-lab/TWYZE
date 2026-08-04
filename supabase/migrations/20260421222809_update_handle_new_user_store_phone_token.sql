/*
  # Update handle_new_user trigger to store phone_token

  The passwordless login system requires phone_token to be set at signup.
  This updates the trigger to pull phone_token from raw_user_meta_data
  so it's stored immediately when the user is created.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username citext;
  v_base_username text;
  v_counter int := 0;
BEGIN
  v_base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  v_username := v_base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := (v_base_username || v_counter::text)::citext;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    phone_token,
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
    NEW.raw_user_meta_data->>'phone_token',
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
    phone_token = COALESCE(EXCLUDED.phone_token, profiles.phone_token),
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
