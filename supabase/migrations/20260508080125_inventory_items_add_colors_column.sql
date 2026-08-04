/*
  # Add colors to inventory items

  1. Problem
    - Inventory items currently cannot record color variants. Users want to
      mark an item as available in multiple colors (similar to how products
      in the dropdown-management screen support color options).

  2. Change
    - Add a `colors` column (text[]) to `public.inventory_items`. Each entry
      is a free-form color name (e.g. "Red", "Navy Blue"). Defaults to an
      empty array so existing rows remain valid.

  3. Safety
    - Additive change only: no data is deleted, no NOT NULL tightening, no
      policy changes. Existing reads and writes that ignore the column
      continue to work unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_items'
      AND column_name = 'colors'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD COLUMN colors text[] NOT NULL DEFAULT '{}'::text[];
  END IF;
END $$;
