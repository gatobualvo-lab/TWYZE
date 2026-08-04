-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Create policies for password_resets
CREATE POLICY "Users can view their own password resets"
  ON password_resets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own password resets"
  ON password_resets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own password resets"
  ON password_resets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all password resets"
  ON password_resets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all password resets"
  ON password_resets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to clean up expired and used password reset codes
CREATE OR REPLACE FUNCTION clean_expired_password_resets()
RETURNS void AS $$
BEGIN
  DELETE FROM password_resets
  WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to run the cleanup function daily
-- Note: This requires pg_cron extension to be enabled
-- In a real production environment, you would set this up with a proper cron job
-- or use a scheduled function in your application
COMMENT ON FUNCTION clean_expired_password_resets() IS 'Cleans up expired and used password reset codes. Run this daily.';