/*
  # Align inventory_items table with frontend schema

  ## Summary
  The frontend reads/writes fields that never existed on inventory_items,
  causing inserts/updates/reads to silently lose data or fail.

  ## Changes
  Adds the following columns (all nullable / defaulted, no data loss):
  - product_name text (mirrors existing `name`)
  - sku text
  - category text
  - current_stock numeric DEFAULT 0 (mirrors existing `quantity`)
  - cost_price numeric DEFAULT 0
  - selling_price numeric DEFAULT 0 (mirrors existing `unit_price`)
  - unit text
  - description text

  Existing columns `name`, `quantity`, `unit_price`, `notes` are left in place.
  We backfill the new columns from existing columns so existing data is visible.

  ## Safety
  - Idempotent (guarded by IF NOT EXISTS)
  - Additive only
  - Backfill is one-time SELECT-based, no destructive operation
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='product_name') THEN
    ALTER TABLE public.inventory_items ADD COLUMN product_name text;
    UPDATE public.inventory_items SET product_name = name WHERE product_name IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='sku') THEN
    ALTER TABLE public.inventory_items ADD COLUMN sku text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='category') THEN
    ALTER TABLE public.inventory_items ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='current_stock') THEN
    ALTER TABLE public.inventory_items ADD COLUMN current_stock numeric DEFAULT 0;
    UPDATE public.inventory_items SET current_stock = COALESCE(quantity, 0) WHERE current_stock IS NULL OR current_stock = 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='cost_price') THEN
    ALTER TABLE public.inventory_items ADD COLUMN cost_price numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='selling_price') THEN
    ALTER TABLE public.inventory_items ADD COLUMN selling_price numeric DEFAULT 0;
    UPDATE public.inventory_items SET selling_price = COALESCE(unit_price, 0) WHERE selling_price IS NULL OR selling_price = 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='unit') THEN
    ALTER TABLE public.inventory_items ADD COLUMN unit text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='description') THEN
    ALTER TABLE public.inventory_items ADD COLUMN description text;
  END IF;

  -- Make legacy columns nullable so inserts from the frontend (that omit them) work
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='name' AND is_nullable='NO') THEN
    ALTER TABLE public.inventory_items ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

-- Keep legacy `name` column in sync with `product_name` via a trigger so
-- any existing code reading `name` keeps working.
CREATE OR REPLACE FUNCTION public.inventory_items_sync_legacy_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.product_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.product_name;
  ELSIF NEW.name IS NOT NULL AND NEW.product_name IS NULL THEN
    NEW.product_name := NEW.name;
  END IF;

  IF NEW.current_stock IS NOT NULL AND NEW.quantity IS DISTINCT FROM NEW.current_stock THEN
    NEW.quantity := NEW.current_stock;
  END IF;

  IF NEW.selling_price IS NOT NULL AND NEW.unit_price IS DISTINCT FROM NEW.selling_price THEN
    NEW.unit_price := NEW.selling_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_items_sync_legacy_trg ON public.inventory_items;
CREATE TRIGGER inventory_items_sync_legacy_trg
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.inventory_items_sync_legacy_fields();
