/*
  # Add Username Support for Admin System

  1. Extensions
    - Enable citext extension for case-insensitive text

  2. Database Changes
    - Add username column to profiles table (citext, unique, nullable)
    - Create unique index on username
    - Add valid_username() helper function

  3. Functions
    - valid_username() - validates username format (3-24 chars, letters/numbers/underscore)

  4. Security
    - Unique constraint on username
    - Case-insensitive username storage
*/

-- Enable citext extension for case-insensitive text
CREATE EXTENSION IF NOT EXISTS citext;

-- Add username column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username citext;
  END IF;
END $$;

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx 
ON profiles (username) 
WHERE username IS NOT NULL;

-- Create username validation function
CREATE OR REPLACE FUNCTION valid_username(username_input text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if username is between 3 and 24 characters
  IF LENGTH(username_input) < 3 OR LENGTH(username_input) > 24 THEN
    RETURN false;
  END IF;
  
  -- Check if username contains only letters, numbers, and underscores
  IF username_input !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN false;
  END IF;
  
  -- Check if username doesn't start with underscore
  IF LEFT(username_input, 1) = '_' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;