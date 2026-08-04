/*
  # Create vendor_expenses table with proper schema

  1. New Tables
    - `vendor_expenses`
      - `id` (uuid, primary key)
      - `vendor_id` (uuid, not null) - Reference to vendor
      - `expense_type` (text, not null) - Payment/Refund/Adjustment/Other
      - `amount_kes` (numeric, not null) - Amount in KES, must be positive
      - `occurred_on` (date, not null) - Date expense occurred
      - `notes` (text, optional) - Additional notes
      - `created_by` (uuid, not null) - User who created the expense
      - `created_at` (timestamptz, not null) - Timestamp of creation

  2. Security
    - Enable RLS on `vendor_expenses` table
    - Add policy for users to read their own expenses
    - Add policy for users to insert their own expenses

  3. Indexes
    - Index on vendor_id for fast lookups
    - Index on created_by for user filtering
    - Index on occurred_on for date range queries
*/

-- Drop existing table if present (clean slate)
DROP TABLE IF EXISTS public.vendor_expenses CASCADE;

-- Create vendor_expenses table
CREATE TABLE public.vendor_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  expense_type text NOT NULL CHECK (expense_type IN ('Payment', 'Refund', 'Adjustment', 'Other')),
  amount_kes numeric(14,2) NOT NULL CHECK (amount_kes > 0),
  occurred_on date NOT NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_vendor_expenses_vendor_id ON public.vendor_expenses(vendor_id);
CREATE INDEX idx_vendor_expenses_created_by ON public.vendor_expenses(created_by);
CREATE INDEX idx_vendor_expenses_occurred_on ON public.vendor_expenses(occurred_on);

-- Enable RLS
ALTER TABLE public.vendor_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own expenses
DROP POLICY IF EXISTS "Users can read own vendor expenses" ON public.vendor_expenses;
CREATE POLICY "Users can read own vendor expenses"
  ON public.vendor_expenses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Users can insert their own expenses
DROP POLICY IF EXISTS "Users can insert own vendor expenses" ON public.vendor_expenses;
CREATE POLICY "Users can insert own vendor expenses"
  ON public.vendor_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can update their own expenses
DROP POLICY IF EXISTS "Users can update own vendor expenses" ON public.vendor_expenses;
CREATE POLICY "Users can update own vendor expenses"
  ON public.vendor_expenses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own expenses
DROP POLICY IF EXISTS "Users can delete own vendor expenses" ON public.vendor_expenses;
CREATE POLICY "Users can delete own vendor expenses"
  ON public.vendor_expenses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
