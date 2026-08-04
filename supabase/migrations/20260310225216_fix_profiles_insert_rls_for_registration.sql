/*
  # Fix Profiles Insert RLS for User Registration

  1. Issue
    - New users cannot register because the INSERT policy on profiles table only allows admins
    - The handle_new_user() trigger fails when trying to create a profile for new users
    
  2. Solution
    - Drop the restrictive admin-only INSERT policy
    - The trigger function is SECURITY DEFINER and handles profile creation automatically
    - Profile creation should only happen through the trigger, not directly by users
    
  3. Security
    - Users cannot manually insert profiles (no INSERT policy for regular users)
    - Profiles are only created through the auth trigger (SECURITY DEFINER)
    - Admins retain all other permissions
*/

-- Drop the restrictive INSERT policy that blocks new user registration
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- No new INSERT policy is needed because:
-- 1. Regular users should never manually insert profiles
-- 2. The trigger function (SECURITY DEFINER) bypasses RLS
-- 3. This prevents manual profile manipulation while allowing automatic creation