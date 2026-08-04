/*
  # Fix ad_expenses table schema

  1. Changes
    - Add `ad_platform` column (e.g., "TikTok Ads", "Facebook Ads")
    - Add `ad_type` column (e.g., "Boost", "Leads", "Other")
    - Rename `amount` to `amount_kes` with proper constraint
    - Rename `date` to `occurred_on` as date type (not timestamptz)
    - Rename `user_id` to `created_by` for consistency
    - Remove `is_deleted`, `updated_at`, `description` columns

  2. Security
    - Enable RLS on `ad_expenses` table
    - Add policy for users to read their own ad expenses
    - Add policy for users to insert their own ad expenses
    - Add policy for users to update their own ad expenses
    - Add policy for users to delete their own ad expenses

  3. Indexes
    - Index on created_by for user filtering
    - Index on occurred_on for date range queries
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add ad_platform column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_expenses' AND column_name = 'ad_platform'
  ) THEN
    ALTER TABLE public.ad_expenses ADD COLUMN ad_platform text NOT NULL DEFAULT 'Other';
  END IF;

  -- Add ad_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_expenses' AND column_name = 'ad_type'
  ) THEN
    ALTER TABLE public.ad_expenses ADD COLUMN ad_type text NOT NULL DEFAULT 'Other';
  END IF;

  -- Add amount_kes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_expenses' AND column_name = 'amount_kes'
  ) THEN
    ALTER TABLE public.ad_expenses ADD COLUMN amount_kes numeric(14,2);
    -- Copy data from old amount column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ad_expenses' AND column_name = 'amount'
    ) THEN
      UPDATE public.ad_expenses SET amount_kes = amount;
    END IF;
    -- Add constraint
    ALTER TABLE public.ad_expenses ALTER COLUMN amount_kes SET NOT NULL;
    ALTER TABLE public.ad_expenses ADD CONSTRAINT ad_expenses_amount_kes_check CHECK (amount_kes > 0);
  END IF;

  -- Add occurred_on column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_expenses' AND column_name = 'occurred_on'
  ) THEN
    ALTER TABLE public.ad_expenses ADD COLUMN occurred_on date;
    -- Copy data from old date column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ad_expenses' AND column_name = 'date'
    ) THEN
      UPDATE public.ad_expenses SET occurred_on = date::date;
    END IF;
    ALTER TABLE public.ad_expenses ALTER COLUMN occurred_on SET NOT NULL;
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_expenses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.ad_expenses ADD COLUMN created_by uuid;
    -- Copy data from old user_id column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ad_expenses' AND column_name = 'user_id'
    ) THEN
      UPDATE public.ad_expenses SET created_by = user_id;
    END IF;
    ALTER TABLE public.ad_expenses ALTER COLUMN created_by SET NOT NULL;
    ALTER TABLE public.ad_expenses ALTER COLUMN created_by SET DEFAULT auth.uid();
    ALTER TABLE public.ad_expenses ADD CONSTRAINT ad_expenses_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old columns if they exist
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS amount CASCADE;
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS date CASCADE;
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS is_deleted CASCADE;
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS updated_at CASCADE;
ALTER TABLE public.ad_expenses DROP COLUMN IF EXISTS description CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ad_expenses_created_by ON public.ad_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_ad_expenses_occurred_on ON public.ad_expenses(occurred_on);

-- Enable RLS
ALTER TABLE public.ad_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own ad expenses
DROP POLICY IF EXISTS "Users can read own ad expenses" ON public.ad_expenses;
CREATE POLICY "Users can read own ad expenses"
  ON public.ad_expenses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Users can insert their own ad expenses
DROP POLICY IF EXISTS "Users can insert own ad expenses" ON public.ad_expenses;
CREATE POLICY "Users can insert own ad expenses"
  ON public.ad_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can update their own ad expenses
DROP POLICY IF EXISTS "Users can update own ad expenses" ON public.ad_expenses;
CREATE POLICY "Users can update own ad expenses"
  ON public.ad_expenses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own ad expenses
DROP POLICY IF EXISTS "Users can delete own ad expenses" ON public.ad_expenses;
CREATE POLICY "Users can delete own ad expenses"
  ON public.ad_expenses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
