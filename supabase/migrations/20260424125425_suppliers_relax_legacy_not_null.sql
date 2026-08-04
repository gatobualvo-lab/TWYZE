/*
  # Relax legacy NOT NULL constraints on suppliers

  The `suppliers` table has legacy columns (`name`, `amount`) from an earlier
  schema that are NOT NULL, but the current SupplierForm records
  client/product/selling_price instead. Inserts fail with
  "null value in column \"name\" violates not-null constraint".

  ## Changes
  - Drop NOT NULL on `suppliers.name`
  - Drop NOT NULL on `suppliers.amount`

  No data is altered or dropped; existing rows keep their values.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers'
      AND column_name='name' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.suppliers ALTER COLUMN name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers'
      AND column_name='amount' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.suppliers ALTER COLUMN amount DROP NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
