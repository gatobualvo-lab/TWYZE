/*
  # Add missing columns to sales and sale_items

  ## Summary
  The frontend inserts and reads columns that don't exist on the tables,
  producing `PGRST204` "column not found in schema cache" errors when
  recording a sale. This migration adds the missing columns additively,
  keeping legacy columns in sync via triggers.

  ## Changes
  sales:
    - profit numeric DEFAULT 0
    - tax_type text DEFAULT 'none'
    - vat_amount numeric DEFAULT 0
    - turnover_tax_amount numeric DEFAULT 0
    - seller text (mirrors seller_name)

  sale_items:
    - profit numeric DEFAULT 0
    - tax_type text DEFAULT 'none'
    - vat_amount numeric DEFAULT 0
    - turnover_tax_amount numeric DEFAULT 0
    - vendor text (mirrors vendor_name)

  Triggers keep `seller` <-> `seller_name` and `vendor` <-> `vendor_name`
  in sync so existing readers on either column continue to work.

  ## Safety
  - Additive only, no drops / type changes
  - Defaults set so existing rows remain valid
  - Guarded with IF NOT EXISTS
*/

DO $$
BEGIN
  -- sales columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='profit') THEN
    ALTER TABLE public.sales ADD COLUMN profit numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='tax_type') THEN
    ALTER TABLE public.sales ADD COLUMN tax_type text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='vat_amount') THEN
    ALTER TABLE public.sales ADD COLUMN vat_amount numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='turnover_tax_amount') THEN
    ALTER TABLE public.sales ADD COLUMN turnover_tax_amount numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='seller') THEN
    ALTER TABLE public.sales ADD COLUMN seller text;
    UPDATE public.sales SET seller = seller_name WHERE seller IS NULL;
  END IF;

  -- sale_items columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='profit') THEN
    ALTER TABLE public.sale_items ADD COLUMN profit numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='tax_type') THEN
    ALTER TABLE public.sale_items ADD COLUMN tax_type text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='vat_amount') THEN
    ALTER TABLE public.sale_items ADD COLUMN vat_amount numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='turnover_tax_amount') THEN
    ALTER TABLE public.sale_items ADD COLUMN turnover_tax_amount numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='vendor') THEN
    ALTER TABLE public.sale_items ADD COLUMN vendor text;
    UPDATE public.sale_items SET vendor = vendor_name WHERE vendor IS NULL;
  END IF;
END $$;

-- Sync triggers to keep legacy *_name columns aligned with frontend columns
CREATE OR REPLACE FUNCTION public.sales_sync_seller_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seller IS NOT NULL AND (NEW.seller_name IS DISTINCT FROM NEW.seller) THEN
    NEW.seller_name := NEW.seller;
  ELSIF NEW.seller IS NULL AND NEW.seller_name IS NOT NULL THEN
    NEW.seller := NEW.seller_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_sync_seller_trg ON public.sales;
CREATE TRIGGER sales_sync_seller_trg
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sales_sync_seller_fields();

CREATE OR REPLACE FUNCTION public.sale_items_sync_vendor_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vendor IS NOT NULL AND (NEW.vendor_name IS DISTINCT FROM NEW.vendor) THEN
    NEW.vendor_name := NEW.vendor;
  ELSIF NEW.vendor IS NULL AND NEW.vendor_name IS NOT NULL THEN
    NEW.vendor := NEW.vendor_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_sync_vendor_trg ON public.sale_items;
CREATE TRIGGER sale_items_sync_vendor_trg
BEFORE INSERT OR UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.sale_items_sync_vendor_fields();

-- Supabase/PostgREST caches the schema; force a reload so the new columns
-- are visible to REST clients immediately.
NOTIFY pgrst, 'reload schema';
