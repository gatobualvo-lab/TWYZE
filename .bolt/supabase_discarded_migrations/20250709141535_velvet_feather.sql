/*
  # Add Vendor Expenses Table

  1. New Tables
    - `vendor_expenses` - Stores expenses paid to vendors
  
  2. Security
    - Enable RLS on the new table
    - Add policies for users to manage their own vendor expenses
    - Add policies for admins to manage all vendor expenses
*/

-- Create vendor_expenses table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE vendor_expenses ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS vendor_expenses_user_id_idx ON vendor_expenses (user_id);
CREATE INDEX IF NOT EXISTS vendor_expenses_vendor_idx ON vendor_expenses (vendor);
CREATE INDEX IF NOT EXISTS vendor_expenses_date_idx ON vendor_expenses (date);

-- Create policies for vendor_expenses
CREATE POLICY "Users can view their own vendor_expenses"
  ON vendor_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vendor_expenses"
  ON vendor_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vendor_expenses"
  ON vendor_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vendor_expenses"
  ON vendor_expenses FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all vendor_expenses"
  ON vendor_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all vendor_expenses"
  ON vendor_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete all vendor_expenses"
  ON vendor_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create a function to calculate vendor balances
CREATE OR REPLACE FUNCTION calculate_vendor_balance(vendor_name TEXT, user_id UUID)
RETURNS TABLE (
  total_owed NUMERIC,
  total_paid NUMERIC,
  balance NUMERIC
) AS $$
DECLARE
  owed NUMERIC;
  paid NUMERIC;
BEGIN
  -- Calculate amount owed to vendor from sales
  SELECT COALESCE(SUM(amount_owed_to_vendor), 0) INTO owed
  FROM sales
  WHERE seller = vendor_name
    AND user_id = $2
    AND is_deleted = false;
  
  -- Calculate amount paid to vendor
  SELECT COALESCE(SUM(amount), 0) INTO paid
  FROM vendor_expenses
  WHERE vendor = vendor_name
    AND user_id = $2
    AND is_deleted = false;
  
  -- Return the results
  RETURN QUERY SELECT 
    owed AS total_owed,
    paid AS total_paid,
    (owed - paid) AS balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_vendor_balance(TEXT, UUID) TO authenticated;