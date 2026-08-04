/*
  # Fix Auth Triggers and User Creation

  1. Updates
    - Fix the user signup trigger function
    - Remove direct admin user creation that was causing errors
    - Improve metadata handling
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the function to handle new user signups
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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Create a function to update user's last login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user logs in
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();

-- Create a function to check if admin exists and create one if needed
CREATE OR REPLACE FUNCTION check_admin_exists()
RETURNS TEXT AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Check if admin profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE email = 'admin@trackwyze.com' AND role = 'admin'
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RETURN 'Admin user already exists';
  ELSE
    RETURN 'Admin user does not exist. Please create one using the Supabase dashboard or API';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to check if admin exists
SELECT check_admin_exists();

-- Note: To create an admin user, use the Supabase Auth API or dashboard to create a user
-- with email 'admin@trackwyze.com' and then the trigger will automatically set the role to 'admin'