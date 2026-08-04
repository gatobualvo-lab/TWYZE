/*
  # Complete Database Schema for TrackWyze Sales Tracker

  1. Extensions
    - citext for case-insensitive usernames
  
  2. Enums
    - user_role: admin, user
    - payment_status: pending, paid
    - subscription_status: trial, active, expired, suspended
  
  3. Tables
    - profiles: User profiles with roles and subscription info
    - user_products: Products available for sale
    - user_clients: Client/customer information
    - user_sellers: Seller/vendor information
    - user_delivery_guys: Delivery personnel
    - user_expense_types: Custom expense categories
    - sales: Sales transactions
    - sale_items: Individual items in each sale
    - suppliers: Supplier information and payments
    - vendor_expenses: Expenses paid to vendors
    - ad_expenses: Advertising expenses
    - general_expenses: General business expenses
    - inventory_items: Inventory tracking
    - payment_submissions: Payment proof submissions
    - email_templates: Email notification templates
    - audit_log: System audit trail
  
  4. Functions
    - handle_new_user(): Auto-create profile on signup
    - is_admin(): Check admin status
    - valid_username(): Validate username format
  
  5. Security
    - RLS enabled on all tables
    - User-based access control
    - Admin privileges for management
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'expired', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username citext UNIQUE,
  full_name text DEFAULT '',
  email text,
  phone_number text,
  role user_role DEFAULT 'user' NOT NULL,
  subscription_status text DEFAULT 'trial',
  trial_start_date timestamptz DEFAULT now(),
  trial_end_date timestamptz DEFAULT (now() + interval '30 days'),
  subscription_expiry timestamptz,
  current_billing_cycle text DEFAULT 'trial',
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Products
CREATE TABLE IF NOT EXISTS user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Clients
CREATE TABLE IF NOT EXISTS user_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Sellers/Vendors
CREATE TABLE IF NOT EXISTS user_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Delivery Personnel
CREATE TABLE IF NOT EXISTS user_delivery_guys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Expense Types
CREATE TABLE IF NOT EXISTS user_expense_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_name text,
  seller_name text,
  delivery_guy text,
  delivery_charge numeric(10,2) DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  sale_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  vendor_name text,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  vendor_payment numeric(10,2) DEFAULT 0,
  vendor_payment_status text DEFAULT 'pending',
  subtotal numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  amount numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vendor Expenses
CREATE TABLE IF NOT EXISTS vendor_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  amount numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ad Expenses
CREATE TABLE IF NOT EXISTS ad_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) DEFAULT 0,
  date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- General Expenses
CREATE TABLE IF NOT EXISTS general_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expense_type text NOT NULL,
  description text,
  amount numeric(10,2) DEFAULT 0,
  date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity numeric(10,2) DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  reorder_level numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment Submissions
CREATE TABLE IF NOT EXISTS payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  transaction_reference text,
  screenshot_url text,
  status text DEFAULT 'pending',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Helper Functions
CREATE OR REPLACE FUNCTION valid_username(username_input text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN username_input ~ '^[A-Za-z0-9_]{3,24}$' AND NOT username_input ~ '^_';
END;
$$;

CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (
    id,
    full_name,
    email,
    phone_number,
    role,
    username,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user'::user_role),
    NEW.raw_user_meta_data->>'username',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_delivery_guys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for User-owned tables (same pattern for all)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'user_products', 'user_clients', 'user_sellers', 
      'user_delivery_guys', 'user_expense_types',
      'sales', 'sale_items', 'suppliers', 'vendor_expenses',
      'ad_expenses', 'general_expenses', 'inventory_items'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can read own data" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Users can read own data" ON %I FOR SELECT TO authenticated USING (user_id = auth.uid())', tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own data" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Users can insert own data" ON %I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own data" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Users can update own data" ON %I FOR UPDATE TO authenticated USING (user_id = auth.uid())', tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own data" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Users can delete own data" ON %I FOR DELETE TO authenticated USING (user_id = auth.uid())', tbl);
  END LOOP;
END $$;

-- RLS Policies for Payment Submissions
DROP POLICY IF EXISTS "Users can read own submissions" ON payment_submissions;
CREATE POLICY "Users can read own submissions"
  ON payment_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own submissions" ON payment_submissions;
CREATE POLICY "Users can insert own submissions"
  ON payment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update submissions" ON payment_submissions;
CREATE POLICY "Admins can update submissions"
  ON payment_submissions FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for Email Templates
DROP POLICY IF EXISTS "Admins can manage email templates" ON email_templates;
CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for Audit Log
DROP POLICY IF EXISTS "Admins can read audit log" ON audit_log;
CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit log" ON audit_log;
CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_user_id ON sale_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_expenses_user_id ON vendor_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_user_id ON payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
