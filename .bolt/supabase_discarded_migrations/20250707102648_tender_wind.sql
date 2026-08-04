/*
  # Fix Database Schema and Policies

  1. Changes
    - Add checks before creating policies to prevent "already exists" errors
    - Maintain all the same tables and policies but with existence checks
    - Keep all indexes and constraints
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'pending_approval', 'active', 'inactive', 'expired')),
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  subscription_expiry TIMESTAMPTZ,
  current_billing_cycle TEXT NOT NULL DEFAULT 'trial' CHECK (current_billing_cycle IN ('trial', 'month2-3', 'month4+')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  last_login TIMESTAMPTZ
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  seller TEXT NOT NULL,
  buying_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  delivery_guy TEXT NOT NULL,
  delivery_fee DECIMAL NOT NULL,
  delivery_fee_paid BOOLEAN NOT NULL DEFAULT false,
  location TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Unpaid')),
  date DATE NOT NULL,
  profit DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  tax_type TEXT CHECK (tax_type IN ('none', 'vat', 'turnover')),
  vat_amount DECIMAL,
  turnover_tax_amount DECIMAL,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client TEXT NOT NULL,
  product TEXT NOT NULL,
  delivery_guy TEXT NOT NULL,
  buying_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Not Paid')),
  date DATE NOT NULL,
  profit DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  tax_type TEXT CHECK (tax_type IN ('none', 'vat', 'turnover')),
  vat_amount DECIMAL,
  turnover_tax_amount DECIMAL,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create ad_expenses table
CREATE TABLE IF NOT EXISTS ad_expenses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ad_type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create general_expenses table
CREATE TABLE IF NOT EXISTS general_expenses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  current_stock INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL,
  cost_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  unit TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create stock_transactions table
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return')),
  quantity INTEGER NOT NULL,
  date DATE NOT NULL,
  related_record_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Create payment_submissions table
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  amount_paid DECIMAL NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('month2-3', 'month4+'))
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sales_notifications BOOLEAN NOT NULL DEFAULT true,
  payment_reminders BOOLEAN NOT NULL DEFAULT true,
  profit_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_reports BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  device_info TEXT
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  type TEXT NOT NULL,
  delivery_attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  type TEXT NOT NULL,
  delivery_attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create user dropdown tables
CREATE TABLE IF NOT EXISTS user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_delivery_guys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_expense_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_delivery_guys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expense_types ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can manage own profiles'
  ) THEN
    CREATE POLICY "Users can manage own profiles"
      ON profiles FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Service role can manage all profiles'
  ) THEN
    CREATE POLICY "Service role can manage all profiles"
      ON profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Admin email can manage profiles'
  ) THEN
    CREATE POLICY "Admin email can manage profiles"
      ON profiles
      FOR ALL
      TO authenticated
      USING (email() = 'admin@trackwyze.com')
      WITH CHECK (email() = 'admin@trackwyze.com');
  END IF;
END
$$;

-- Create policies for sales with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Users can view their own sales'
  ) THEN
    CREATE POLICY "Users can view their own sales"
      ON sales FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Users can insert their own sales'
  ) THEN
    CREATE POLICY "Users can insert their own sales"
      ON sales FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Users can update their own sales'
  ) THEN
    CREATE POLICY "Users can update their own sales"
      ON sales FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Users can delete their own sales'
  ) THEN
    CREATE POLICY "Users can delete their own sales"
      ON sales FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Admins can view all sales'
  ) THEN
    CREATE POLICY "Admins can view all sales"
      ON sales FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Admins can update all sales'
  ) THEN
    CREATE POLICY "Admins can update all sales"
      ON sales FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Admins can delete all sales'
  ) THEN
    CREATE POLICY "Admins can delete all sales"
      ON sales FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create similar policies for suppliers with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Users can view their own suppliers'
  ) THEN
    CREATE POLICY "Users can view their own suppliers"
      ON suppliers FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Users can insert their own suppliers'
  ) THEN
    CREATE POLICY "Users can insert their own suppliers"
      ON suppliers FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Users can update their own suppliers'
  ) THEN
    CREATE POLICY "Users can update their own suppliers"
      ON suppliers FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Users can delete their own suppliers'
  ) THEN
    CREATE POLICY "Users can delete their own suppliers"
      ON suppliers FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Admins can view all suppliers'
  ) THEN
    CREATE POLICY "Admins can view all suppliers"
      ON suppliers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Admins can update all suppliers'
  ) THEN
    CREATE POLICY "Admins can update all suppliers"
      ON suppliers FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'Admins can delete all suppliers'
  ) THEN
    CREATE POLICY "Admins can delete all suppliers"
      ON suppliers FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create similar policies for ad_expenses with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Users can view their own ad_expenses'
  ) THEN
    CREATE POLICY "Users can view their own ad_expenses"
      ON ad_expenses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Users can insert their own ad_expenses'
  ) THEN
    CREATE POLICY "Users can insert their own ad_expenses"
      ON ad_expenses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Users can update their own ad_expenses'
  ) THEN
    CREATE POLICY "Users can update their own ad_expenses"
      ON ad_expenses FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Users can delete their own ad_expenses'
  ) THEN
    CREATE POLICY "Users can delete their own ad_expenses"
      ON ad_expenses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Admins can view all ad_expenses'
  ) THEN
    CREATE POLICY "Admins can view all ad_expenses"
      ON ad_expenses FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Admins can update all ad_expenses'
  ) THEN
    CREATE POLICY "Admins can update all ad_expenses"
      ON ad_expenses FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_expenses' AND policyname = 'Admins can delete all ad_expenses'
  ) THEN
    CREATE POLICY "Admins can delete all ad_expenses"
      ON ad_expenses FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create similar policies for general_expenses with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Users can view their own general_expenses'
  ) THEN
    CREATE POLICY "Users can view their own general_expenses"
      ON general_expenses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Users can insert their own general_expenses'
  ) THEN
    CREATE POLICY "Users can insert their own general_expenses"
      ON general_expenses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Users can update their own general_expenses'
  ) THEN
    CREATE POLICY "Users can update their own general_expenses"
      ON general_expenses FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Users can delete their own general_expenses'
  ) THEN
    CREATE POLICY "Users can delete their own general_expenses"
      ON general_expenses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Admins can view all general_expenses'
  ) THEN
    CREATE POLICY "Admins can view all general_expenses"
      ON general_expenses FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Admins can update all general_expenses'
  ) THEN
    CREATE POLICY "Admins can update all general_expenses"
      ON general_expenses FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'general_expenses' AND policyname = 'Admins can delete all general_expenses'
  ) THEN
    CREATE POLICY "Admins can delete all general_expenses"
      ON general_expenses FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  trial_days INTEGER := 30;
  trial_end TIMESTAMPTZ;
  user_full_name TEXT;
  user_phone TEXT;
  user_role TEXT := 'user';
BEGIN
  -- Calculate trial end date (30 days from now)
  trial_end := now() + (trial_days || ' days')::INTERVAL;
  
  -- Extract user metadata
  user_full_name := NEW.raw_user_meta_data->>'full_name';
  user_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', 'Unknown');
  
  -- Check if this is an admin account
  IF NEW.email = 'admin@trackwyze.com' THEN
    user_role := 'admin';
  END IF;
  
  -- Create a profile for the new user
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone_number,
    created_at,
    subscription_status,
    trial_start_date,
    trial_end_date,
    current_billing_cycle,
    role
  ) VALUES (
    NEW.id,
    user_full_name,
    NEW.email,
    user_phone,
    now(),
    CASE WHEN user_role = 'admin' THEN 'active' ELSE 'trial' END,
    now(),
    CASE WHEN user_role = 'admin' THEN NULL ELSE trial_end END,
    CASE WHEN user_role = 'admin' THEN 'month4+' ELSE 'trial' END,
    user_role
  );
  
  -- Create default user settings
  INSERT INTO public.user_settings (
    user_id,
    sales_notifications,
    payment_reminders,
    profit_alerts,
    weekly_reports
  ) VALUES (
    NEW.id,
    true,
    true,
    true,
    false
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Create a function to update user's last login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Trigger the function every time a user logs in
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();

-- Create a function to verify reset code
CREATE OR REPLACE FUNCTION verify_reset_code(reset_code TEXT, user_identifier TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_id UUID,
  error_message TEXT
) AS $$
DECLARE
  user_record UUID;
  reset_record RECORD;
BEGIN
  -- Find user by email or phone
  SELECT id INTO user_record
  FROM profiles
  WHERE email = user_identifier OR phone_number = user_identifier;
  
  IF user_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if reset code exists and is valid
  SELECT * INTO reset_record
  FROM password_resets
  WHERE user_id = user_record
    AND code = reset_code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF reset_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid or expired reset code'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, user_record, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to mark reset code as used
CREATE OR REPLACE FUNCTION mark_reset_code_used(reset_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  UPDATE password_resets
  SET used = true
  WHERE code = reset_code
  RETURNING true INTO code_exists;
  
  RETURN COALESCE(code_exists, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get email template by type
CREATE OR REPLACE FUNCTION get_email_template(template_type TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  subject TEXT,
  html_content TEXT,
  type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    et.id,
    et.name,
    et.subject,
    et.html_content,
    et.type
  FROM 
    email_templates et
  WHERE 
    et.type = template_type
    AND et.is_active = true
  ORDER BY 
    et.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to clean up expired password reset codes
CREATE OR REPLACE FUNCTION clean_expired_password_resets()
RETURNS void AS $$
BEGIN
  DELETE FROM password_resets
  WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to clean up old email logs (older than 90 days)
CREATE OR REPLACE FUNCTION clean_old_email_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM email_logs
  WHERE sent_at < now() - INTERVAL '90 days';
  
  DELETE FROM sms_logs
  WHERE sent_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
CREATE INDEX IF NOT EXISTS profiles_phone_number_idx ON profiles (phone_number);
CREATE INDEX IF NOT EXISTS sales_user_id_idx ON sales (user_id);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (date);
CREATE INDEX IF NOT EXISTS suppliers_user_id_idx ON suppliers (user_id);
CREATE INDEX IF NOT EXISTS suppliers_date_idx ON suppliers (date);
CREATE INDEX IF NOT EXISTS ad_expenses_user_id_idx ON ad_expenses (user_id);
CREATE INDEX IF NOT EXISTS ad_expenses_date_idx ON ad_expenses (date);
CREATE INDEX IF NOT EXISTS general_expenses_user_id_idx ON general_expenses (user_id);
CREATE INDEX IF NOT EXISTS general_expenses_date_idx ON general_expenses (date);
CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx ON inventory_items (user_id);
CREATE INDEX IF NOT EXISTS inventory_items_product_name_idx ON inventory_items (product_name);
CREATE INDEX IF NOT EXISTS stock_transactions_inventory_item_id_idx ON stock_transactions (inventory_item_id);
CREATE INDEX IF NOT EXISTS stock_transactions_user_id_idx ON stock_transactions (user_id);
CREATE INDEX IF NOT EXISTS password_resets_code_idx ON password_resets (code);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS user_products_user_id_idx ON user_products (user_id);
CREATE INDEX IF NOT EXISTS user_products_name_idx ON user_products (name);
CREATE INDEX IF NOT EXISTS user_sellers_user_id_idx ON user_sellers (user_id);
CREATE INDEX IF NOT EXISTS user_sellers_name_idx ON user_sellers (name);
CREATE INDEX IF NOT EXISTS user_clients_user_id_idx ON user_clients (user_id);
CREATE INDEX IF NOT EXISTS user_clients_name_idx ON user_clients (name);
CREATE INDEX IF NOT EXISTS user_delivery_guys_user_id_idx ON user_delivery_guys (user_id);
CREATE INDEX IF NOT EXISTS user_delivery_guys_name_idx ON user_delivery_guys (name);
CREATE INDEX IF NOT EXISTS user_expense_types_user_id_idx ON user_expense_types (user_id);
CREATE INDEX IF NOT EXISTS user_expense_types_name_idx ON user_expense_types (name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);

-- Create unique constraints for dropdown tables (with existence checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_products_user_id_name_key'
  ) THEN
    ALTER TABLE user_products ADD CONSTRAINT user_products_user_id_name_key UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_sellers_user_id_name_key'
  ) THEN
    ALTER TABLE user_sellers ADD CONSTRAINT user_sellers_user_id_name_key UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_clients_user_id_name_key'
  ) THEN
    ALTER TABLE user_clients ADD CONSTRAINT user_clients_user_id_name_key UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_delivery_guys_user_id_name_key'
  ) THEN
    ALTER TABLE user_delivery_guys ADD CONSTRAINT user_delivery_guys_user_id_name_key UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_expense_types_user_id_name_key'
  ) THEN
    ALTER TABLE user_expense_types ADD CONSTRAINT user_expense_types_user_id_name_key UNIQUE (user_id, name);
  END IF;
END
$$;

-- Insert default email templates if they don't exist
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM email_templates;
  
  IF template_count = 0 THEN
    INSERT INTO email_templates (name, subject, html_content, type, is_active)
    VALUES
      ('Sale Confirmation', 'Sale Recorded: {{productName}}', 
       E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #1e40af; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Sale Recorded</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>A new sale has been successfully recorded in your Trackwyze account:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #1e40af;"><p><strong>Product:</strong> {{productName}}</p><p><strong>Amount:</strong> KES {{amount}}</p><p><strong>Profit:</strong> KES {{profit}}</p><p><strong>Date:</strong> {{date}}</p></div><p>You can view the complete details of this sale in your Trackwyze dashboard.</p><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
       'sale_confirmation', true),
       
      ('Payment Confirmation', 'Payment to {{supplierName}} Recorded',
       E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #15803d; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Payment Recorded</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>A payment to supplier has been successfully recorded in your Trackwyze account:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #15803d;"><p><strong>Supplier:</strong> {{supplierName}}</p><p><strong>Product:</strong> {{productName}}</p><p><strong>Amount Paid:</strong> KES {{amount}}</p><p><strong>Date:</strong> {{date}}</p></div><p>You can view the complete details of this payment in your Trackwyze dashboard.</p><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #15803d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
       'payment_confirmation', true),
       
      ('Weekly Summary', 'Your Weekly Business Summary',
       E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Weekly Business Summary</h1><p style="margin-top: 5px;">{{startDate}} - {{endDate}}</p></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>Here is your weekly business summary from Trackwyze:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Sales Summary</h3><p><strong>Total Sales:</strong> {{totalSales}}</p><p><strong>Total Revenue:</strong> KES {{totalRevenue}}</p><p><strong>Total Profit:</strong> KES {{totalProfit}}</p></div><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Expenses Summary</h3><p><strong>Ad Expenses:</strong> KES {{adExpenses}}</p><p><strong>General Expenses:</strong> KES {{generalExpenses}}</p><p><strong>Total Expenses:</strong> KES {{totalExpenses}}</p></div><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Net Profit</h3><p><strong>Net Profit:</strong> KES {{netProfit}}</p></div><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Full Report</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
       'weekly_summary', true),
       
      ('Test Email', 'TrackWyze Email System Test',
       E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #1e40af; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Email System Test</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>This is a test email from your TrackWyze application.</p><p>If you\'re receiving this email, it means your email notification system is working correctly!</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #1e40af;"><p><strong>Email:</strong> {{userEmail}}</p><p><strong>Time:</strong> {{timestamp}}</p></div><p>You can now configure your application to send automated emails for sales and supplier payments.</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
       'test', true);
  END IF;
END
$$;