/*
  # Add color options to products and sales

  1. Schema Changes
    - Add `colors` (text[]) column to `user_products` so each catalog product can
      store a list of available color variants.
    - Add `color` (text) column to `sale_items` so a color choice can be captured
      per item when recording a sale.

  2. Notes
    - Both columns default to NULL/empty to preserve existing rows.
    - No data is modified or removed.

  3. Security
    - Existing RLS policies continue to apply; no policy changes needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_products'
      AND column_name = 'colors'
  ) THEN
    ALTER TABLE public.user_products
      ADD COLUMN colors text[] DEFAULT '{}'::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sale_items'
      AND column_name = 'color'
  ) THEN
    ALTER TABLE public.sale_items
      ADD COLUMN color text;
  END IF;
END $$;
