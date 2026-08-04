/*
  # Add Product Color Options

  1. New Table
    - `product_color_options`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to user_products)
      - `user_id` (uuid, foreign key to auth.users)
      - `color_name` (text, not null)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on product_id for fast lookups
    - Index on user_id for RLS performance

  3. Security (RLS)
    - Enable RLS on the table
    - Users can manage their own product colors
    - All operations restricted to authenticated users

  4. Triggers
    - Auto-update updated_at timestamp
*/

-- Create product_color_options table
CREATE TABLE IF NOT EXISTS product_color_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES user_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color_name text NOT NULL CHECK (length(color_name) > 0 AND length(color_name) <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_color_options_product_id ON product_color_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_color_options_user_id ON product_color_options(user_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_product_color_options_updated
  BEFORE UPDATE ON product_color_options
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE product_color_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage their own product colors
CREATE POLICY "product_color_options_select" ON product_color_options
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "product_color_options_insert" ON product_color_options
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM user_products
      WHERE user_products.id = product_color_options.product_id
      AND user_products.user_id = (select auth.uid())
    )
  );

CREATE POLICY "product_color_options_update" ON product_color_options
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "product_color_options_delete" ON product_color_options
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));