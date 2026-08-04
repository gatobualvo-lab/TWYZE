-- Create function to create dropdown tables dynamically
CREATE OR REPLACE FUNCTION create_dropdown_table(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )', table_name);
  
  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Create policies
  EXECUTE format('
    CREATE POLICY "Users can view their own %1$I"
      ON %1$I FOR SELECT
      USING (auth.uid() = user_id)', table_name);
  
  EXECUTE format('
    CREATE POLICY "Users can insert their own %1$I"
      ON %1$I FOR INSERT
      WITH CHECK (auth.uid() = user_id)', table_name);
  
  EXECUTE format('
    CREATE POLICY "Users can update their own %1$I"
      ON %1$I FOR UPDATE
      USING (auth.uid() = user_id)', table_name);
  
  EXECUTE format('
    CREATE POLICY "Users can delete their own %1$I"
      ON %1$I FOR DELETE
      USING (auth.uid() = user_id)', table_name);
  
  EXECUTE format('
    CREATE POLICY "Admins can view all %1$I"
      ON %1$I FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = ''admin''
        )
      )', table_name);
  
  -- Create index on user_id and name
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS %1$I_user_id_idx ON %1$I (user_id)', table_name);
  
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS %1$I_name_idx ON %1$I (name)', table_name);
  
  -- Create unique constraint on user_id and name
  EXECUTE format('
    ALTER TABLE %1$I ADD CONSTRAINT %1$I_user_id_name_key UNIQUE (user_id, name)', table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create dropdown tables for common data
SELECT create_dropdown_table('user_products');
SELECT create_dropdown_table('user_sellers');
SELECT create_dropdown_table('user_delivery_guys');
SELECT create_dropdown_table('user_clients');
SELECT create_dropdown_table('user_expense_types');

-- Fix the query issue in the profiles table
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
CREATE INDEX IF NOT EXISTS profiles_phone_number_idx ON profiles (phone_number);

-- Fix the query issue in the password_resets table
CREATE INDEX IF NOT EXISTS password_resets_code_idx ON password_resets (code);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);

-- Create a function to properly escape strings for SQL queries
CREATE OR REPLACE FUNCTION escape_like(text) RETURNS text AS $$
BEGIN
    RETURN replace(replace(replace($1, '\', '\\'), '%', '\%'), '_', '\_');
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;