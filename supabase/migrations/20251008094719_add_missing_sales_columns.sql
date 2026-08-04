/*
  # Add Missing Columns to Sales and Sale Items Tables

  1. Sales Table Updates
    - Add buying_price column (total buying cost for all items in the sale)
    - Add amount_owed_to_vendor column (total amount owed to vendors)
    - Add delivery_fee_paid column (boolean flag for delivery payment status)
    - Add selling_price column (total selling price)
    - Add delivery_fee column (renamed from delivery_charge for consistency)

  2. Sale Items Table Updates
    - Add buying_price column (buying price per unit)
    - Add selling_price column (selling price per unit)

  3. Reasoning
    - These columns are required by the application components
    - buying_price tracks costs for profit calculation
    - amount_owed_to_vendor tracks outstanding vendor payments
    - delivery_fee_paid tracks delivery payment status
*/

-- Add missing columns to sales table
DO $$
BEGIN
  -- Add buying_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'buying_price'
  ) THEN
    ALTER TABLE sales ADD COLUMN buying_price numeric(10,2) DEFAULT 0;
  END IF;

  -- Add selling_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'selling_price'
  ) THEN
    ALTER TABLE sales ADD COLUMN selling_price numeric(10,2) DEFAULT 0;
  END IF;

  -- Add amount_owed_to_vendor if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'amount_owed_to_vendor'
  ) THEN
    ALTER TABLE sales ADD COLUMN amount_owed_to_vendor numeric(10,2) DEFAULT 0;
  END IF;

  -- Add delivery_fee_paid if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'delivery_fee_paid'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivery_fee_paid boolean DEFAULT false;
  END IF;

  -- Add delivery_fee as alias/alternative to delivery_charge
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivery_fee numeric(10,2) DEFAULT 0;
  END IF;

  -- Add product_name for compatibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN product_name text;
  END IF;

  -- Add location for delivery tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'location'
  ) THEN
    ALTER TABLE sales ADD COLUMN location text;
  END IF;

  -- Add date as alias for sale_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'date'
  ) THEN
    ALTER TABLE sales ADD COLUMN date timestamptz DEFAULT now();
  END IF;
END $$;

-- Add missing columns to sale_items table
DO $$
BEGIN
  -- Add buying_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'buying_price'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN buying_price numeric(10,2) DEFAULT 0;
  END IF;

  -- Add selling_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'selling_price'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN selling_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance on new columns
CREATE INDEX IF NOT EXISTS idx_sales_amount_owed ON sales(amount_owed_to_vendor) WHERE amount_owed_to_vendor > 0;
CREATE INDEX IF NOT EXISTS idx_sales_delivery_fee_paid ON sales(delivery_fee_paid) WHERE delivery_fee_paid = false;
CREATE INDEX IF NOT EXISTS idx_sale_items_vendor_payment_status ON sale_items(vendor_payment_status) WHERE vendor_payment_status = 'pending';
