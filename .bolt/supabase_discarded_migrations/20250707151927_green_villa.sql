/*
  # Fix Profiles Policies and Add Helper Functions

  1. Changes
    - Drop all existing policies on profiles table
    - Create simple, non-recursive policies
    - Add helper functions for data access
*/

-- Drop all existing policies on profiles table
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
CREATE POLICY "users_select_own"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Allow users to update their own profile
CREATE POLICY "users_update_own"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 3. Allow users to insert their own profile
CREATE POLICY "users_insert_own"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Allow profile creation during signup
CREATE POLICY "allow_signup_insert"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Service role has full access
CREATE POLICY "service_role_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Admin email has full access
CREATE POLICY "admin_email_access"
  ON profiles
  FOR ALL
  USING (auth.email() = 'admin@trackwyze.com')
  WITH CHECK (auth.email() = 'admin@trackwyze.com');

-- Create helper functions for data access
-- Function to get user profile by ID
CREATE OR REPLACE FUNCTION get_profile_by_id(user_id UUID)
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE id = user_id;
$$;

-- Function to get current user profile
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE id = auth.uid();
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profile_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_profile() TO authenticated;