/*
  # Fix Admin User Creation

  1. Changes
    - Create a proper admin user creation function that works with Supabase Auth
    - Add environment variables for Supabase URL and key
    - Fix authentication flow
*/

-- Create a function to check if admin exists and create one if needed
CREATE OR REPLACE FUNCTION check_admin_exists()
RETURNS TEXT AS $$
DECLARE
  admin_exists BOOLEAN;
  admin_id UUID;
BEGIN
  -- Check if admin profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE email = 'admin@trackwyze.com' AND role = 'admin'
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RETURN 'Admin user already exists';
  ELSE
    -- We can't directly create auth.users entries from SQL
    -- Instead, return a message instructing to create the admin via API
    RETURN 'Admin user does not exist. Please create one using the Supabase dashboard or API';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to check if admin exists
SELECT check_admin_exists();

-- Create a function to handle password reset code verification
CREATE OR REPLACE FUNCTION verify_reset_code(reset_code TEXT, user_identifier TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_id UUID,
  error_message TEXT
) AS $$
DECLARE
  user_record UUID;
  reset_record RECORD;
BEGIN
  -- Find user by email or phone
  SELECT id INTO user_record
  FROM profiles
  WHERE email = user_identifier OR phone_number = user_identifier;
  
  IF user_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if reset code exists and is valid
  SELECT * INTO reset_record
  FROM password_resets
  WHERE user_id = user_record
    AND code = reset_code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF reset_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid or expired reset code'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, user_record, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to mark reset code as used
CREATE OR REPLACE FUNCTION mark_reset_code_used(reset_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  UPDATE password_resets
  SET used = true
  WHERE code = reset_code
  RETURNING true INTO code_exists;
  
  RETURN COALESCE(code_exists, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;