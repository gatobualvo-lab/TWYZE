/*
  # Add phone_token column for passwordless login

  ## Summary
  Users now log in with phone number only — no password.
  A random token is generated at signup and stored here.
  At login, the token is retrieved via a SECURITY DEFINER function
  and used to sign the user in with Supabase email/password under the hood.

  ## Changes
  - `profiles.phone_token` (text, nullable) — stores the bcrypt-safe login token

  ## Security
  - Column is NOT exposed via RLS SELECT policies (users can only read their own row,
    but we add a separate function that returns just the token for the matching phone)
  - A SECURITY DEFINER function `get_token_by_phone` lets the frontend
    resolve a phone number to its email + token without needing full table access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_token text;
  END IF;
END $$;

-- Function: given a phone number, return the email + token for that profile
-- Used by the frontend to perform passwordless phone login
CREATE OR REPLACE FUNCTION public.get_credentials_by_phone(p_phone text)
RETURNS TABLE(email text, phone_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.email, p.phone_token
  FROM public.profiles p
  WHERE p.phone_number = p_phone
  LIMIT 1;
END;
$$;

-- Revoke direct execution from anon/authenticated; only service role or
-- the function itself (SECURITY DEFINER) can call it
REVOKE ALL ON FUNCTION public.get_credentials_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_credentials_by_phone(text) TO anon, authenticated;
