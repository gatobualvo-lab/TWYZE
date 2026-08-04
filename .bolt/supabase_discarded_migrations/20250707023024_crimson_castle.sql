-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- Create new policies that don't cause recursion, but check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can manage own profiles'
  ) THEN
    CREATE POLICY "Users can manage own profiles"
      ON profiles FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- Service role can manage all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Service role can manage all profiles'
  ) THEN
    CREATE POLICY "Service role can manage all profiles"
      ON profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Admin email can manage profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Admin email can manage profiles'
  ) THEN
    CREATE POLICY "Admin email can manage profiles"
      ON profiles
      FOR ALL
      TO authenticated
      USING (email() = 'admin@trackwyze.com')
      WITH CHECK (email() = 'admin@trackwyze.com');
  END IF;
END
$$;

-- Users with admin role can manage profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users with admin role can manage profiles'
  ) THEN
    CREATE POLICY "Users with admin role can manage profiles"
      ON profiles
      FOR ALL
      TO authenticated
      USING ((jwt() ->> 'role'::text) = 'admin'::text)
      WITH CHECK ((jwt() ->> 'role'::text) = 'admin'::text);
  END IF;
END
$$;

-- Create an index on the audit_log table for better performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);