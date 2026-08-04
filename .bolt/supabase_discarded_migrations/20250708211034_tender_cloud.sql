/*
  # Add Sale Items Table

  1. New Tables
    - `sale_items` - Stores individual product items for each sale
  
  2. Security
    - Enable RLS on the table
    - Add policies for users to manage their own sale items
    - Add policies for admins to manage all sale items
    
  3. Triggers
    - Add triggers to update sale totals when items are added, updated, or deleted
*/

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  buying_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  profit NUMERIC NOT NULL,
  tax_type TEXT CHECK (tax_type IN ('none', 'vat', 'turnover')),
  vat_amount NUMERIC DEFAULT 0,
  turnover_tax_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
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

-- Create function to calculate sale totals
CREATE OR REPLACE FUNCTION calculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_buying_price NUMERIC;
  total_selling_price NUMERIC;
  total_profit NUMERIC;
  total_vat NUMERIC;
  total_turnover_tax NUMERIC;
  sale_record RECORD;
BEGIN
  -- Get the sale_id based on the operation
  IF TG_OP = 'DELETE' THEN
    sale_record := OLD;
  ELSE
    sale_record := NEW;
  END IF;

  -- Calculate totals from sale_items
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
    sale_id = sale_record.sale_id;

  -- Update the sales record with the new totals
  UPDATE sales
  SET 
    buying_price = total_buying_price,
    selling_price = total_selling_price,
    profit = total_profit - COALESCE(delivery_fee, 0), -- Subtract delivery fee from profit
    vat_amount = total_vat,
    turnover_tax_amount = total_turnover_tax,
    updated_at = now()
  WHERE 
    id = sale_record.sale_id;

  RETURN NULL;
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