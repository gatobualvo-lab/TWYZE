/*
  # Add RPC Functions for Safer Data Access

  1. New Functions
    - Add get_user_profile RPC function to fetch profile data safely
    - Add check_auth_status function to check authentication status
    - Add update_last_login function to update login timestamp
*/

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
) SECURITY DEFINER AS $$
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
$$ LANGUAGE plpgsql;

-- Create a function to check auth status
CREATE OR REPLACE FUNCTION check_auth_status()
RETURNS TABLE (
  is_authenticated BOOLEAN,
  user_id UUID,
  user_role TEXT
) SECURITY DEFINER AS $$
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
$$ LANGUAGE plpgsql;

-- Create a function to update user's last login
CREATE OR REPLACE FUNCTION update_last_login(user_id UUID)
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET last_login = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_auth_status() TO authenticated;
GRANT EXECUTE ON FUNCTION update_last_login(UUID) TO authenticated;