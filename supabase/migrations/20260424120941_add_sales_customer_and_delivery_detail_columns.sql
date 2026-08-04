/*
  # Capture customer and delivery details on sales

  ## Problem
  The Sales Report needs customer phone, payment method, delivery status,
  and delivery date. None of these exist yet on the `sales` table.

  ## Changes
  - `sales.customer_phone` (text, nullable)
  - `sales.payment_method` (text, nullable, one of 'Cash' | 'M-Pesa' | 'Bank' | 'Other')
  - `sales.delivery_status` (text, default 'Pending')
  - `sales.delivery_date` (date, nullable)

  ## Backfill
  - For existing rows where `delivery_fee_paid = true`, set
    `delivery_status = 'Delivered'` and `delivery_date = date` as a
    reasonable default. Other rows keep the default 'Pending'.
  - `payment_method` is left NULL for historical rows; the UI falls back
    to 'Cash' at display time.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_phone') THEN
    ALTER TABLE public.sales ADD COLUMN customer_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='payment_method') THEN
    ALTER TABLE public.sales ADD COLUMN payment_method text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='delivery_status') THEN
    ALTER TABLE public.sales ADD COLUMN delivery_status text DEFAULT 'Pending';
    UPDATE public.sales
       SET delivery_status = CASE WHEN COALESCE(delivery_fee_paid, false) THEN 'Delivered' ELSE 'Pending' END
     WHERE delivery_status IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='delivery_date') THEN
    ALTER TABLE public.sales ADD COLUMN delivery_date date;
    UPDATE public.sales
       SET delivery_date = date
     WHERE delivery_date IS NULL AND COALESCE(delivery_fee_paid, false) = true;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
