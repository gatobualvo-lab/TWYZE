/*
  # Add Vendor Expenses Table and Update Sale Items

  1. New Tables
    - `vendor_expenses` - Stores expenses paid to vendors
  
  2. Changes to Existing Tables
    - Add vendor and vendor_payment_status fields to sale_items table
    
  3. Security
    - Enable RLS on new tables
    - Add policies for users to manage their own vendor expenses
    - Add policies for admins to manage all vendor expenses
*/

-- Create vendor_expenses table
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

-- Add vendor and vendor_payment_status columns to sale_items table if they don't exist
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vendor_payment_status TEXT CHECK (vendor_payment_status IN ('Paid', 'Unpaid'));