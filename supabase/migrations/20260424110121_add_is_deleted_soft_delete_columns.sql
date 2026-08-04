/*
  # Add is_deleted soft-delete column to data tables

  ## Summary
  The frontend uses soft-delete semantics (`.eq('is_deleted', false)` on reads,
  `.update({ is_deleted: true })` on deletes) but the column doesn't exist
  on any table. This causes 400 errors on all fetches.

  ## Changes
  Adds `is_deleted boolean NOT NULL DEFAULT false` to:
  - sales
  - general_expenses
  - inventory_items
  - suppliers
  - vendor_expenses
  - sale_items
  - ad_expenses

  ## Safety
  - Additive change only (no drops, renames, or type changes)
  - Default false so existing rows remain visible
  - Idempotent (IF NOT EXISTS guards)
*/

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['sales','general_expenses','inventory_items','suppliers','vendor_expenses','sale_items','ad_expenses'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t AND column_name = 'is_deleted'
       )
    THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted boolean NOT NULL DEFAULT false', t);
    END IF;
  END LOOP;
END $$;
