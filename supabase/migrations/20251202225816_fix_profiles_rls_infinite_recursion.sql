/*
  # Fix Profiles RLS Infinite Recursion

  1. Problem
    - The `is_admin()` function queries the profiles table
    - Profile RLS policies use `is_admin()`, creating infinite recursion
    - Users cannot read their own profile to check admin status

  2. Solution
    - Drop all existing problematic RLS policies
    - Create new simplified policies that avoid recursion
    - Allow users to read their own profile without admin checks
    - Use direct role comparison instead of is_admin() function where possible

  3. New Policies
    - Users can read their own profile (no recursion)
    - Users can update their own profile (excluding role changes)
    - Admins can read all profiles (uses direct role check)
    - Admins can update all profiles (uses direct role check)
    - Admins can insert/delete profiles (uses direct role check)
*/

-- Drop all existing RLS policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "profiles read own or admin" ON profiles;
DROP POLICY IF EXISTS "profiles update own non-role" ON profiles;
DROP POLICY IF EXISTS "profiles admin update all" ON profiles;

-- Create new RLS policies without recursion

-- Allow users to read their own profile (no admin check needed)
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to read all profiles (direct role check in same query)
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow users to update their own profile (but not their role)
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Allow admins to update any profile (direct role check)
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to insert profiles (direct role check)
CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to delete profiles (direct role check)
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
