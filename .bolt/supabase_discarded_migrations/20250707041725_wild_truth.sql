/*
  # Fix Login Flow

  1. New Functions
    - Create a function to update last login without causing recursion
    - Create a function to check auth status
    - Create a function to get user profile by ID
  
  2. Security
    - Ensure these functions are security definer
    - Make them accessible to authenticated users
*/

-- Create a function to update user's last login without causing recursion
CREATE OR REPLACE FUNCTION update_last_login(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET last_login = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check auth status
CREATE OR REPLACE FUNCTION check_auth_status()
RETURNS TABLE (
  is_authenticated BOOLEAN,
  user_id UUID,
  user_role TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      NULL::UUID, 
      NULL::TEXT;
  ELSE
    RETURN QUERY SELECT 
      true, 
      auth.uid(), 
      (SELECT role FROM profiles WHERE id = auth.uid());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  subscription_status TEXT,
  trial_end_date TIMESTAMPTZ,
  current_billing_cycle TEXT,
  role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.phone_number,
    p.subscription_status,
    p.trial_end_date,
    p.current_billing_cycle,
    p.role
  FROM 
    profiles p
  WHERE 
    p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;