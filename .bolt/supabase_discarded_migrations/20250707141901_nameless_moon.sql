/*
  # Fix infinite recursion in profiles RLS policies

  1. Security Changes
    - Drop all existing conflicting policies on profiles table
    - Create clean, non-recursive policies
    - Ensure proper access control without circular dependencies

  2. Policy Structure
    - Users can read their own profile using auth.uid()
    - Users can update their own profile using auth.uid()
    - Admins can manage all profiles using role check from JWT
    - Service role has full access
    - Allow profile creation during signup
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own users" ON profiles;
DROP POLICY IF EXISTS "Users can select own users" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own data" ON profiles;
DROP POLICY IF EXISTS "Users can insert own data" ON profiles;
DROP POLICY IF EXISTS "Users can update own data" ON profiles;
DROP POLICY IF EXISTS "Users can view own data" ON profiles;
DROP POLICY IF EXISTS "Users can manage own users" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can select all users" ON profiles;
DROP POLICY IF EXISTS "Admins can read all users" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all users" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create clean, non-recursive policies

-- Allow users to read their own profile using auth.uid() directly
CREATE POLICY "users_select_own_profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile using auth.uid() directly
CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile during signup
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow profile creation during signup (for public access during registration)
CREATE POLICY "allow_profile_creation_signup"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admin policies using JWT role claim (no table lookup)
CREATE POLICY "admins_full_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() ->> 'role')::text,
      (auth.jwt() -> 'app_metadata' ->> 'role')::text,
      ''
    ) = 'admin'
  )
  WITH CHECK (
    COALESCE(
      (auth.jwt() ->> 'role')::text,
      (auth.jwt() -> 'app_metadata' ->> 'role')::text,
      ''
    ) = 'admin'
  );

-- Service role full access
CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);