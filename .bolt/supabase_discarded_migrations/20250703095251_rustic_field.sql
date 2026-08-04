/*
  # Email System Setup

  1. New Tables
    - `email_logs` - Stores all sent emails with status and content
    - `sms_logs` - Stores all sent SMS messages with status
  
  2. Security
    - Enable RLS on both tables
    - Add policies for users to view their own logs
    - Add policies for admins to view all logs
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  type TEXT NOT NULL,
  delivery_attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  type TEXT NOT NULL,
  delivery_attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for email_logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all email logs"
  ON email_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create policies for sms_logs
CREATE POLICY "Users can view their own sms logs"
  ON sms_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sms logs"
  ON sms_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert sms logs"
  ON sms_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to clean up old email logs (older than 90 days)
CREATE OR REPLACE FUNCTION clean_old_email_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM email_logs
  WHERE sent_at < now() - INTERVAL '90 days';
  
  DELETE FROM sms_logs
  WHERE sent_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to run the cleanup function monthly
-- Note: This requires pg_cron extension to be enabled
-- In a real production environment, you would set this up with a proper cron job
-- or use a scheduled function in your application
COMMENT ON FUNCTION clean_old_email_logs() IS 'Cleans up email and SMS logs older than 90 days. Run this monthly.';