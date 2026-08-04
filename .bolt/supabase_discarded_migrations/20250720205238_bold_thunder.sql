/*
  # Add is_reimbursed column to vendor_expenses table

  1. Changes
    - Add is_reimbursed boolean column to vendor_expenses table
    - Set default value to false for existing records
    - Add index for better query performance
*/

-- Add is_reimbursed column to vendor_expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_expenses' AND column_name = 'is_reimbursed'
  ) THEN
    ALTER TABLE vendor_expenses ADD COLUMN is_reimbursed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add index for better query performance on is_reimbursed column
CREATE INDEX IF NOT EXISTS vendor_expenses_is_reimbursed_idx ON vendor_expenses (is_reimbursed);

-- Add comment to document the column purpose
COMMENT ON COLUMN vendor_expenses.is_reimbursed IS 'Tracks whether the vendor expense has been reimbursed or settled';