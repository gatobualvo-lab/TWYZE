/*
  # Relax vendor_expenses.vendor_id NOT NULL

  1. Problem
    - `vendor_expenses.vendor_id` is NOT NULL but the application inserts
      rows using `vendor_name` as the vendor identifier. This causes every
      insert to fail with a NOT NULL violation.

  2. Change
    - Drop the NOT NULL constraint on `vendor_id` so existing inserts that
      only provide `vendor_name` succeed.

  3. Safety
    - No data is deleted or altered; the column still exists for any caller
      that chooses to populate it.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_expenses'
      AND column_name = 'vendor_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.vendor_expenses ALTER COLUMN vendor_id DROP NOT NULL;
  END IF;
END $$;
