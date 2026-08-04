/*
  # Fix Infinite Recursion in Policies

  1. Changes
    - Drop all existing policies on profiles table
    - Create simple, non-recursive policies that don't reference themselves
    - Fix the trigger functions to avoid recursion
*/

-- Drop all existing policies on profiles table to start fresh
DO $$
DECLARE
    policy_name text;
    policy_names text[] := ARRAY(
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles'
    );
BEGIN
    FOREACH policy_name IN ARRAY policy_names
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_name);
    END LOOP;
END
$$;

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

-- 6. Admin access based on email
CREATE POLICY "admin_email_full_access"
  ON profiles
  FOR ALL
  USING (auth.email() = 'admin@trackwyze.com')
  WITH CHECK (auth.email() = 'admin@trackwyze.com');

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