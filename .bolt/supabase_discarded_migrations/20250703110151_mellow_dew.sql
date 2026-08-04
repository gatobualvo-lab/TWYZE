/*
  # Fix User Queries

  1. Improvements
    - Add indexes to profiles table for email and phone_number columns
    - Add indexes to password_resets table for code and user_id columns
    - Add function to properly escape strings in SQL queries
*/

-- Add indexes to profiles table
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
CREATE INDEX IF NOT EXISTS profiles_phone_number_idx ON profiles (phone_number);

-- Add indexes to password_resets table
CREATE INDEX IF NOT EXISTS password_resets_code_idx ON password_resets (code);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);

-- Create a function to properly escape strings for SQL queries
CREATE OR REPLACE FUNCTION escape_like(text) RETURNS text AS $$
BEGIN
    RETURN replace(replace(replace($1, '\', '\\'), '%', '\%'), '_', '\_');
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Create a function to find user by email or phone
CREATE OR REPLACE FUNCTION find_user_by_email_or_phone(search_term text)
RETURNS TABLE (
  id uuid,
  email text,
  phone_number text,
  full_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.phone_number, p.full_name
  FROM profiles p
  WHERE p.email = search_term OR p.phone_number = search_term;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;