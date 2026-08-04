-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "users_select_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_profile_creation_signup" ON profiles;
DROP POLICY IF EXISTS "admins_full_access" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- 1. Allow users to view their own profile
CREATE POLICY "users_select_own_profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Allow users to update their own profile
CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 3. Allow users to insert their own profile
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Allow profile creation during signup
CREATE POLICY "allow_profile_creation_signup"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 5. Service role has full access
CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Admin access based on role field in JWT
CREATE POLICY "admins_full_access"
  ON profiles
  FOR ALL
  USING (
    COALESCE((auth.jwt() ->> 'role'::text), ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'role'::text), ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text
  );

-- Fix the handle_new_user_signup function to avoid recursion
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  trial_days INTEGER := 30;
  trial_end TIMESTAMPTZ;
  user_full_name TEXT;
  user_phone TEXT;
  user_role TEXT := 'user';
BEGIN
  -- Calculate trial end date (30 days from now)
  trial_end := now() + (trial_days || ' days')::INTERVAL;
  
  -- Extract user metadata
  user_full_name := NEW.raw_user_meta_data->>'full_name';
  user_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', 'Unknown');
  
  -- Check if this is an admin account
  IF NEW.email = 'admin@trackwyze.com' THEN
    user_role := 'admin';
  END IF;
  
  -- Create a profile for the new user
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone_number,
    created_at,
    subscription_status,
    trial_start_date,
    trial_end_date,
    current_billing_cycle,
    role
  ) VALUES (
    NEW.id,
    user_full_name,
    NEW.email,
    user_phone,
    now(),
    CASE WHEN user_role = 'admin' THEN 'active' ELSE 'trial' END,
    now(),
    CASE WHEN user_role = 'admin' THEN NULL ELSE trial_end END,
    CASE WHEN user_role = 'admin' THEN 'month4+' ELSE 'trial' END,
    user_role
  );
  
  -- Create default user settings
  INSERT INTO public.user_settings (
    user_id,
    sales_notifications,
    payment_reminders,
    profit_alerts,
    weekly_reports
  ) VALUES (
    NEW.id,
    true,
    true,
    true,
    false
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Fix the handle_user_login function
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Trigger the function every time a user logs in
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();