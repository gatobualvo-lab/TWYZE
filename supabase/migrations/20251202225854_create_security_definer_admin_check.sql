/*
  # Create Security Definer Admin Check Function

  1. Problem
    - Profiles table RLS has infinite recursion
    - Can't drop is_admin() because other tables depend on it
    
  2. Solution
    - Keep existing is_admin() function for other tables
    - Create new check_user_role() SECURITY DEFINER function
    - Update only profiles table policies to use new function
    
  3. Changes
    - Create check_user_role() with SECURITY DEFINER
    - Update profiles policies to avoid recursion
*/

-- Create new security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION check_user_role(user_id uuid, required_role user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = required_role
  );
$$;

-- Drop existing profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own or admin reads all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role" ON profiles;

-- Recreate profiles policies using the new security definer function

-- Allow users to read their own profile OR if they are admin
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR check_user_role(auth.uid(), 'admin')
  );

-- Allow users to update their own profile (but not role field)
CREATE POLICY "profiles_update_own_non_role"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Allow admins to update any profile
CREATE POLICY "profiles_admin_update_all"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (check_user_role(auth.uid(), 'admin'))
  WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Allow admins to insert profiles
CREATE POLICY "profiles_admin_insert"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Allow admins to delete profiles
CREATE POLICY "profiles_admin_delete"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (check_user_role(auth.uid(), 'admin'));

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION check_user_role(uuid, user_role) TO authenticated;
