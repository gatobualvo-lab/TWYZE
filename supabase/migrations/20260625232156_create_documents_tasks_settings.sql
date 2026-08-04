/*
# Create Business Documents, Tasks, and Settings Tables

1. New Tables
   - `business_settings` - Stores company profile and document settings per user
     - `id` (uuid, primary key)
     - `user_id` (uuid, owner)
     - `business_name` (text)
     - `phone`, `email`, `website` (text)
     - `postal_address`, `physical_address`, `city`, `country` (text)
     - `kra_pin`, `vat_number` (text)
     - `logo_url` (text)
     - `default_currency` (text, default KES)
     - `payment_instructions`, `bank_details` (text)
     - `invoice_footer`, `quotation_footer`, `receipt_footer` (text)
     - `signature_url`, `stamp_url` (text)
     - `invoice_prefix`, `quotation_prefix`, `receipt_prefix` (text)
     - `invoice_next_number`, `quotation_next_number`, `receipt_next_number` (integer)
     - `default_template` (text)
   - `documents` - Unified document table for quotations, invoices, receipts
     - `id` (uuid, primary key)
     - `user_id` (uuid, owner)
     - `document_type` (text: quotation, invoice, receipt)
     - `document_number` (text)
     - `status` (text)
     - `date`, `due_date`, `expiry_date` (date)
     - Customer info fields
     - Financial fields (subtotal, tax, delivery, discount, total)
     - `related_document_id` (uuid, self-reference for linking)
     - `related_sale_id` (uuid, links to sales table)
     - `notes`, `terms` (text)
     - `template` (text)
     - `payment_method`, `amount_paid`, `balance_due` (for receipts/invoices)
   - `document_items` - Line items for documents
     - `id` (uuid, primary key)
     - `document_id` (uuid, FK to documents)
     - `user_id` (uuid, owner)
     - Product info, quantity, unit_price, discount, tax, total
   - `business_tasks` - Simple task list for dashboard
     - `id` (uuid, primary key)
     - `user_id` (uuid, owner)
     - `title` (text)
     - `task_type` (text)
     - `completed` (boolean)
     - `due_date` (date)
   - `dashboard_preferences` - User dashboard customization
     - `id` (uuid, primary key)
     - `user_id` (uuid, owner, unique)
     - `show_kpi_cards`, `show_chart`, `show_recent_sales`, `show_attention`, `show_tasks` (boolean)

2. Security
   - RLS enabled on all tables
   - Owner-scoped CRUD for authenticated users

3. Notes
   - Documents table uses a single unified schema for all document types
   - Status values vary by document_type (quotation/invoice/receipt)
   - related_document_id allows linking quote->invoice->receipt chain
*/

-- Business Settings
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  postal_address text DEFAULT '',
  physical_address text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT 'Kenya',
  kra_pin text DEFAULT '',
  vat_number text DEFAULT '',
  logo_url text DEFAULT '',
  default_currency text DEFAULT 'KES',
  payment_instructions text DEFAULT '',
  bank_details text DEFAULT '',
  invoice_footer text DEFAULT 'Thank you for your business!',
  quotation_footer text DEFAULT 'This quotation is valid for 30 days.',
  receipt_footer text DEFAULT 'Thank you for your payment!',
  signature_url text DEFAULT '',
  stamp_url text DEFAULT '',
  invoice_prefix text DEFAULT 'INV-',
  quotation_prefix text DEFAULT 'QT-',
  receipt_prefix text DEFAULT 'RCPT-',
  invoice_next_number integer DEFAULT 1,
  quotation_next_number integer DEFAULT 1,
  receipt_next_number integer DEFAULT 1,
  default_template text DEFAULT 'professional',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_business_settings" ON business_settings;
CREATE POLICY "select_own_business_settings" ON business_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_business_settings" ON business_settings;
CREATE POLICY "insert_own_business_settings" ON business_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_business_settings" ON business_settings;
CREATE POLICY "update_own_business_settings" ON business_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_business_settings" ON business_settings;
CREATE POLICY "delete_own_business_settings" ON business_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Documents (unified: quotation, invoice, receipt)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('quotation', 'invoice', 'receipt')),
  document_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  date date DEFAULT CURRENT_DATE,
  due_date date,
  expiry_date date,
  customer_name text DEFAULT '',
  customer_phone text DEFAULT '',
  customer_email text DEFAULT '',
  customer_address text DEFAULT '',
  subtotal numeric(12,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  delivery_charge numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2) DEFAULT 0,
  payment_method text DEFAULT '',
  notes text DEFAULT '',
  terms text DEFAULT '',
  template text DEFAULT 'professional',
  related_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  related_sale_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(user_id, date DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Document Items
CREATE TABLE IF NOT EXISTS document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  tax_percent numeric(5,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_items_doc ON document_items(document_id);

ALTER TABLE document_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_document_items" ON document_items;
CREATE POLICY "select_own_document_items" ON document_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_document_items" ON document_items;
CREATE POLICY "insert_own_document_items" ON document_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_document_items" ON document_items;
CREATE POLICY "update_own_document_items" ON document_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_document_items" ON document_items;
CREATE POLICY "delete_own_document_items" ON document_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Business Tasks
CREATE TABLE IF NOT EXISTS business_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  task_type text DEFAULT 'general',
  completed boolean DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_tasks_user ON business_tasks(user_id, completed, created_at DESC);

ALTER TABLE business_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON business_tasks;
CREATE POLICY "select_own_tasks" ON business_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON business_tasks;
CREATE POLICY "insert_own_tasks" ON business_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON business_tasks;
CREATE POLICY "update_own_tasks" ON business_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON business_tasks;
CREATE POLICY "delete_own_tasks" ON business_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Dashboard Preferences
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  show_kpi_cards boolean DEFAULT true,
  show_chart boolean DEFAULT true,
  show_recent_sales boolean DEFAULT true,
  show_attention boolean DEFAULT true,
  show_tasks boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_dashboard_prefs" ON dashboard_preferences;
CREATE POLICY "select_own_dashboard_prefs" ON dashboard_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_dashboard_prefs" ON dashboard_preferences;
CREATE POLICY "insert_own_dashboard_prefs" ON dashboard_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_dashboard_prefs" ON dashboard_preferences;
CREATE POLICY "update_own_dashboard_prefs" ON dashboard_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_dashboard_prefs" ON dashboard_preferences;
CREATE POLICY "delete_own_dashboard_prefs" ON dashboard_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
