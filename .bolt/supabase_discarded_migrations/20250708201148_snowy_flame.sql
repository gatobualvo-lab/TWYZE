/*
  # Add Multi-Product Sales Support

  1. New Tables
    - `sale_items` - Stores individual product items within a sale
  
  2. Changes to Existing Tables
    - Update `sales` table to track totals across multiple products
  
  3. Security
    - Enable RLS on new tables
    - Add policies for users to manage their own sale items
    - Add policies for admins to manage all sale items
*/

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  buying_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  profit DECIMAL NOT NULL,
  tax_type TEXT CHECK (tax_type IN ('none', 'vat', 'turnover')),
  vat_amount DECIMAL DEFAULT 0,
  turnover_tax_amount DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_name_idx ON sale_items (product_name);

-- Create policies for sale_items
CREATE POLICY "Users can view their own sale_items"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own sale_items"
  ON sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own sale_items"
  ON sale_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own sale_items"
  ON sale_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all sale_items"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all sale_items"
  ON sale_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete all sale_items"
  ON sale_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to calculate sale totals from items
CREATE OR REPLACE FUNCTION calculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_buying_price DECIMAL := 0;
  total_selling_price DECIMAL := 0;
  total_profit DECIMAL := 0;
  total_vat DECIMAL := 0;
  total_turnover_tax DECIMAL := 0;
BEGIN
  -- Calculate totals from sale items
  SELECT 
    COALESCE(SUM(buying_price * quantity), 0),
    COALESCE(SUM(selling_price * quantity), 0),
    COALESCE(SUM(profit), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(turnover_tax_amount), 0)
  INTO 
    total_buying_price,
    total_selling_price,
    total_profit,
    total_vat,
    total_turnover_tax
  FROM 
    sale_items
  WHERE 
    sale_id = NEW.sale_id;
  
  -- Update the parent sale record
  UPDATE sales
  SET 
    buying_price = total_buying_price,
    selling_price = total_selling_price,
    profit = total_profit - COALESCE(delivery_fee, 0),
    vat_amount = total_vat,
    turnover_tax_amount = total_turnover_tax,
    updated_at = now()
  WHERE 
    id = NEW.sale_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to update sale totals when items change
CREATE TRIGGER update_sale_totals_on_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals();

CREATE TRIGGER update_sale_totals_on_update
  AFTER UPDATE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals();

CREATE TRIGGER update_sale_totals_on_delete
  AFTER DELETE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals();

-- Create a function to get sale items by sale ID
CREATE OR REPLACE FUNCTION get_sale_items(p_sale_id UUID)
RETURNS SETOF sale_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM sale_items WHERE sale_id = p_sale_id ORDER BY created_at;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_sale_items(UUID) TO authenticated;