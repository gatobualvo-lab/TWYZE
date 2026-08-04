/*
  # Add expense_type to vendor_expenses table

  1. Changes
    - Add expense_type column to vendor_expenses table
    - Set default value to 'Other'
    - Make column nullable to support existing records
*/

-- Add expense_type column to vendor_expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_expenses' AND column_name = 'expense_type'
  ) THEN
    ALTER TABLE vendor_expenses ADD COLUMN expense_type text DEFAULT 'Other';
  END IF;
END $$;