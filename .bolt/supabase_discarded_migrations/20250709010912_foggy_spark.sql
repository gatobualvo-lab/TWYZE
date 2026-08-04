/*
  # Add Vendor Fields to Sale Items

  1. New Columns
    - Add vendor and vendor_payment_status columns to sale_items table
  
  2. Changes
    - Allow tracking vendor and payment status per product item
*/

-- Add vendor and vendor_payment_status columns to sale_items table
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vendor_payment_status TEXT CHECK (vendor_payment_status IN ('Paid', 'Unpaid'));

-- Set default values for existing records
UPDATE sale_items
SET 
  vendor = (
    SELECT seller 
    FROM sales 
    WHERE sales.id = sale_items.sale_id
  ),
  vendor_payment_status = (
    SELECT payment_status 
    FROM sales 
    WHERE sales.id = sale_items.sale_id
  )
WHERE vendor IS NULL;