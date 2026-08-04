/*
  # Add Amount Owed to Vendor Field

  1. Changes
    - Add amount_owed_to_vendor column to sales table
    - Update existing sales records to set the field based on payment_status
    - Add index for better query performance
*/

-- Add amount_owed_to_vendor column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_owed_to_vendor DECIMAL DEFAULT 0;

-- Update existing sales records
UPDATE sales 
SET amount_owed_to_vendor = CASE 
  WHEN payment_status = 'Unpaid' THEN buying_price 
  ELSE 0 
END;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS sales_amount_owed_to_vendor_idx ON sales (amount_owed_to_vendor);