/*
  # Align suppliers table with SupplierForm / SupplierDashboard

  ## Problem
  The app treats `suppliers` as a supplier-transaction log (client, product,
  buying/selling price, tax, profit, delivery person) but the table only has
  a minimal schema (name, amount, payment_status, date, notes). Submitting
  the form fails with "Could not find the 'buying_price' column".

  ## Changes
  Add the missing columns expected by the frontend. All columns are
  nullable / have safe defaults, so no existing rows are affected.

  - `client` text
  - `product` text
  - `delivery_guy` text
  - `buying_price` numeric default 0
  - `selling_price` numeric default 0
  - `profit` numeric default 0
  - `tax_type` text default 'none'
  - `vat_amount` numeric
  - `turnover_tax_amount` numeric

  No data is altered or dropped.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='client') THEN
    ALTER TABLE public.suppliers ADD COLUMN client text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='product') THEN
    ALTER TABLE public.suppliers ADD COLUMN product text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='delivery_guy') THEN
    ALTER TABLE public.suppliers ADD COLUMN delivery_guy text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='buying_price') THEN
    ALTER TABLE public.suppliers ADD COLUMN buying_price numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='selling_price') THEN
    ALTER TABLE public.suppliers ADD COLUMN selling_price numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='profit') THEN
    ALTER TABLE public.suppliers ADD COLUMN profit numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='tax_type') THEN
    ALTER TABLE public.suppliers ADD COLUMN tax_type text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='vat_amount') THEN
    ALTER TABLE public.suppliers ADD COLUMN vat_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='turnover_tax_amount') THEN
    ALTER TABLE public.suppliers ADD COLUMN turnover_tax_amount numeric;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
