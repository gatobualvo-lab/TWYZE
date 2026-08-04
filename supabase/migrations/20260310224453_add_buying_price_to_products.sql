/*
  # Add Buying Price to Products

  1. Changes
    - Add `buying_price` column to `user_products` table
      - `buying_price` (numeric, nullable, default 0)
      - Stores the purchase/buying price for each product

  2. Notes
    - Using numeric type for precise decimal handling
    - Nullable to support existing products without breaking changes
    - Default value of 0 for backward compatibility
*/

-- Add buying_price column to user_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_products' AND column_name = 'buying_price'
  ) THEN
    ALTER TABLE user_products ADD COLUMN buying_price numeric DEFAULT 0;
  END IF;
END $$;