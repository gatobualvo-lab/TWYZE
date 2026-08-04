/*
  # Fix Database Issues

  1. New Tables
    - Add missing `users` table reference in profiles foreign key
  
  2. Security
    - Fix any missing RLS policies
    - Ensure proper constraints and references
*/

-- Create users table if it doesn't exist (this is the auth.users reference table)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix the foreign key reference in profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS sales_user_id_idx ON sales (user_id);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (date);
CREATE INDEX IF NOT EXISTS suppliers_user_id_idx ON suppliers (user_id);
CREATE INDEX IF NOT EXISTS suppliers_date_idx ON suppliers (date);
CREATE INDEX IF NOT EXISTS ad_expenses_user_id_idx ON ad_expenses (user_id);
CREATE INDEX IF NOT EXISTS ad_expenses_date_idx ON ad_expenses (date);
CREATE INDEX IF NOT EXISTS general_expenses_user_id_idx ON general_expenses (user_id);
CREATE INDEX IF NOT EXISTS general_expenses_date_idx ON general_expenses (date);
CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx ON inventory_items (user_id);
CREATE INDEX IF NOT EXISTS inventory_items_product_name_idx ON inventory_items (product_name);

-- Fix any missing RLS policies
DO $$
BEGIN
  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Admins can insert profiles'
  ) THEN
    CREATE POLICY "Admins can insert profiles"
      ON profiles FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create a function to handle admin creation if needed
CREATE OR REPLACE FUNCTION create_admin_if_needed()
RETURNS TEXT AS $$
DECLARE
  admin_exists BOOLEAN;
  admin_auth_exists BOOLEAN;
BEGIN
  -- Check if admin profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE email = 'admin@trackwyze.com' AND role = 'admin'
  ) INTO admin_exists;
  
  -- Check if admin auth user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = 'admin@trackwyze.com'
  ) INTO admin_auth_exists;
  
  IF admin_exists AND admin_auth_exists THEN
    RETURN 'Admin user already exists';
  ELSE
    RETURN 'Admin user needs to be created via the API';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to check admin status
SELECT create_admin_if_needed();

-- Create a function to handle connection testing
CREATE OR REPLACE FUNCTION test_connection()
RETURNS TEXT AS $$
BEGIN
  RETURN 'Connection successful';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;