-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new policies that don't cause recursion
-- Users can view their own profile (this one is fine as-is)
-- Users can update their own profile (this one is fine as-is)

-- For admin functionality, we'll use a different approach
-- Option 1: Use service role key for admin operations in the application
-- Option 2: Create a simpler policy that doesn't self-reference

-- Simple policy for admin operations - this avoids the recursion
-- by not checking the profiles table within the policy
CREATE POLICY "Service role can manage all profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alternative: If you need authenticated admin access, use a simpler approach
-- This checks if the user's email is the admin email
CREATE POLICY "Admin email can manage profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    auth.email() = 'admin@trackwyze.com'
  )
  WITH CHECK (
    auth.email() = 'admin@trackwyze.com'
  );

-- Create a policy for users with admin role in their metadata
-- This is a safer approach that doesn't cause recursion
CREATE POLICY "Users with admin role can manage profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );