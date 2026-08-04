/*
  # Add Product Price Field with Proper Constraints

  1. Changes
    - Ensure user_products.price column exists with proper constraints
    - Set price to NOT NULL with default 0
    - Add check constraint to ensure price >= 0
    
  2. Notes
    - Price column already exists but may need constraint updates
    - This migration is idempotent and safe to run
*/

-- Ensure price column exists and has correct type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_products' AND column_name = 'price'
  ) THEN
    ALTER TABLE user_products ADD COLUMN price numeric(14,2) DEFAULT 0;
  END IF;
END $$;

-- Set price to NOT NULL if it isn't already
ALTER TABLE user_products ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE user_products ALTER COLUMN price SET NOT NULL;

-- Add check constraint for price >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_products_price_check'
  ) THEN
    ALTER TABLE user_products ADD CONSTRAINT user_products_price_check CHECK (price >= 0);
  END IF;
END $$;