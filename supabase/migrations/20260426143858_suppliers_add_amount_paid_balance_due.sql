/*
  # Add payment tracking columns to suppliers

  The Supplier Sales workflow now tracks partial payments per supply
  transaction. We add `amount_paid` and `balance_due` so the form can
  persist Paid / Partial / Pending state with proper amounts.

  ## Changes
  - Add `amount_paid` numeric, default 0
  - Add `balance_due` numeric, default 0
  - Backfill from existing rows so legacy data stays consistent:
    - Paid rows: amount_paid = selling_price, balance_due = 0
    - Not Paid rows: amount_paid = 0, balance_due = selling_price

  No data is dropped.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers' AND column_name='amount_paid'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN amount_paid numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers' AND column_name='balance_due'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN balance_due numeric DEFAULT 0;
  END IF;
END $$;

UPDATE public.suppliers
SET amount_paid = COALESCE(selling_price, 0),
    balance_due = 0
WHERE payment_status = 'Paid'
  AND amount_paid IS NULL;

UPDATE public.suppliers
SET amount_paid = 0,
    balance_due = COALESCE(selling_price, 0)
WHERE payment_status = 'Not Paid'
  AND amount_paid IS NULL;

NOTIFY pgrst, 'reload schema';
