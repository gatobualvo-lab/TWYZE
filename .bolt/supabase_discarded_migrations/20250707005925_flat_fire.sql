-- Create a users table if it doesn't exist (for auth.users reference)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create policies for users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data"
      ON users FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can insert own data'
  ) THEN
    CREATE POLICY "Users can insert own data"
      ON users FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data"
      ON users FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can delete own data'
  ) THEN
    CREATE POLICY "Users can delete own data"
      ON users FOR DELETE
      USING (auth.uid() = id);
  END IF;
END
$$;

-- Create policies for general_expenses
DO $$
BEGIN
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

-- Create policies for inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_items' AND policyname = 'Users can update their own inventory_items'
  ) THEN
    CREATE POLICY "Users can update their own inventory_items"
      ON inventory_items FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_items' AND policyname = 'Users can delete their own inventory_items'
  ) THEN
    CREATE POLICY "Users can delete their own inventory_items"
      ON inventory_items FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_items' AND policyname = 'Admins can view all inventory_items'
  ) THEN
    CREATE POLICY "Admins can view all inventory_items"
      ON inventory_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_items' AND policyname = 'Admins can update all inventory_items'
  ) THEN
    CREATE POLICY "Admins can update all inventory_items"
      ON inventory_items FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_items' AND policyname = 'Admins can delete all inventory_items'
  ) THEN
    CREATE POLICY "Admins can delete all inventory_items"
      ON inventory_items FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for stock_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stock_transactions' AND policyname = 'Admins can view all stock_transactions'
  ) THEN
    CREATE POLICY "Admins can view all stock_transactions"
      ON stock_transactions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for payment_submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_submissions' AND policyname = 'Admins can view all payment_submissions'
  ) THEN
    CREATE POLICY "Admins can view all payment_submissions"
      ON payment_submissions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_submissions' AND policyname = 'Admins can update all payment_submissions'
  ) THEN
    CREATE POLICY "Admins can update all payment_submissions"
      ON payment_submissions FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' AND policyname = 'Admins can view all user_settings'
  ) THEN
    CREATE POLICY "Admins can view all user_settings"
      ON user_settings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for audit_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_log' AND policyname = 'Admins can view all audit_log'
  ) THEN
    CREATE POLICY "Admins can view all audit_log"
      ON audit_log FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_logs' AND policyname = 'Admins can insert email logs'
  ) THEN
    CREATE POLICY "Admins can insert email logs"
      ON email_logs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for sms_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sms_logs' AND policyname = 'Users can view their own sms logs'
  ) THEN
    CREATE POLICY "Users can view their own sms logs"
      ON sms_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sms_logs' AND policyname = 'Admins can view all sms logs'
  ) THEN
    CREATE POLICY "Admins can view all sms logs"
      ON sms_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sms_logs' AND policyname = 'Admins can insert sms logs'
  ) THEN
    CREATE POLICY "Admins can insert sms logs"
      ON sms_logs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for password_resets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'password_resets' AND policyname = 'Users can view their own password resets'
  ) THEN
    CREATE POLICY "Users can view their own password resets"
      ON password_resets FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'password_resets' AND policyname = 'Users can insert their own password resets'
  ) THEN
    CREATE POLICY "Users can insert their own password resets"
      ON password_resets FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'password_resets' AND policyname = 'Users can update their own password resets'
  ) THEN
    CREATE POLICY "Users can update their own password resets"
      ON password_resets FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'password_resets' AND policyname = 'Admins can view all password resets'
  ) THEN
    CREATE POLICY "Admins can view all password resets"
      ON password_resets FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'password_resets' AND policyname = 'Admins can update all password resets'
  ) THEN
    CREATE POLICY "Admins can update all password resets"
      ON password_resets FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Create policies for user_products, user_sellers, user_clients, user_delivery_guys, user_expense_types
DO $$
BEGIN
  -- User sellers policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_sellers' AND policyname = 'Admins can view all user_sellers'
  ) THEN
    CREATE POLICY "Admins can view all user_sellers"
      ON user_sellers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  -- User clients policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_clients' AND policyname = 'Users can view their own user_clients'
  ) THEN
    CREATE POLICY "Users can view their own user_clients"
      ON user_clients FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_clients' AND policyname = 'Users can insert their own user_clients'
  ) THEN
    CREATE POLICY "Users can insert their own user_clients"
      ON user_clients FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_clients' AND policyname = 'Users can update their own user_clients'
  ) THEN
    CREATE POLICY "Users can update their own user_clients"
      ON user_clients FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_clients' AND policyname = 'Users can delete their own user_clients'
  ) THEN
    CREATE POLICY "Users can delete their own user_clients"
      ON user_clients FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_clients' AND policyname = 'Admins can view all user_clients'
  ) THEN
    CREATE POLICY "Admins can view all user_clients"
      ON user_clients FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  -- User delivery guys policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_delivery_guys' AND policyname = 'Users can view their own user_delivery_guys'
  ) THEN
    CREATE POLICY "Users can view their own user_delivery_guys"
      ON user_delivery_guys FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_delivery_guys' AND policyname = 'Users can insert their own user_delivery_guys'
  ) THEN
    CREATE POLICY "Users can insert their own user_delivery_guys"
      ON user_delivery_guys FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_delivery_guys' AND policyname = 'Users can update their own user_delivery_guys'
  ) THEN
    CREATE POLICY "Users can update their own user_delivery_guys"
      ON user_delivery_guys FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_delivery_guys' AND policyname = 'Users can delete their own user_delivery_guys'
  ) THEN
    CREATE POLICY "Users can delete their own user_delivery_guys"
      ON user_delivery_guys FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_delivery_guys' AND policyname = 'Admins can view all user_delivery_guys'
  ) THEN
    CREATE POLICY "Admins can view all user_delivery_guys"
      ON user_delivery_guys FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  -- User expense types policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_expense_types' AND policyname = 'Users can view their own user_expense_types'
  ) THEN
    CREATE POLICY "Users can view their own user_expense_types"
      ON user_expense_types FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_expense_types' AND policyname = 'Users can insert their own user_expense_types'
  ) THEN
    CREATE POLICY "Users can insert their own user_expense_types"
      ON user_expense_types FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_expense_types' AND policyname = 'Users can update their own user_expense_types'
  ) THEN
    CREATE POLICY "Users can update their own user_expense_types"
      ON user_expense_types FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_expense_types' AND policyname = 'Users can delete their own user_expense_types'
  ) THEN
    CREATE POLICY "Users can delete their own user_expense_types"
      ON user_expense_types FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_expense_types' AND policyname = 'Admins can view all user_expense_types'
  ) THEN
    CREATE POLICY "Admins can view all user_expense_types"
      ON user_expense_types FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;