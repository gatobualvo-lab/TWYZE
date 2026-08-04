/*
  # Fix ad_expenses RLS and ownership

  1. Schema Changes
    - Ensure `created_by` column exists with proper default
    - Add indexes for performance

  2. Helper Functions
    - Create `is_admin` function for admin bypass

  3. Security (RLS Policies)
    - Enable RLS on `ad_expenses` table
    - Insert policy: Users can only insert their own expenses (created_by = auth.uid())
    - Select policy: Users can read their own expenses; admins can read all
    - Update policy: Users can only update their own expenses
    - Delete policy: Users can only delete their own expenses

  4. Performance
    - Index on `created_by` for user filtering
    - Notify PostgREST to reload schema cache
*/

-- Ensure created_by column exists with proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'ad_expenses' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.ad_expenses 
      ADD COLUMN created_by uuid NOT NULL DEFAULT auth.uid();
  ELSE
    -- Update the default if column exists but doesn't have the right default
    ALTER TABLE public.ad_expenses 
      ALTER COLUMN created_by SET DEFAULT auth.uid();
    
    -- Make sure it's not null
    ALTER TABLE public.ad_expenses 
      ALTER COLUMN created_by SET NOT NULL;
  END IF;
END $$;

-- Create recommended indexes
CREATE INDEX IF NOT EXISTS ad_expenses_created_by_idx ON public.ad_expenses(created_by);

-- Enable RLS
ALTER TABLE public.ad_expenses ENABLE ROW LEVEL SECURITY;

-- Helper function for admin bypass
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id AND p.role = 'admin'
  );
$$;

-- Policy: Insert - only for authenticated user (created_by must match auth.uid())
DROP POLICY IF EXISTS "adx insert own" ON public.ad_expenses;
CREATE POLICY "adx insert own"
  ON public.ad_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Select - read own expenses (and admins read all)
DROP POLICY IF EXISTS "adx read own or admin" ON public.ad_expenses;
CREATE POLICY "adx read own or admin"
  ON public.ad_expenses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Policy: Update - only own expenses
DROP POLICY IF EXISTS "adx update own" ON public.ad_expenses;
CREATE POLICY "adx update own"
  ON public.ad_expenses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Delete - only own expenses
DROP POLICY IF EXISTS "adx delete own" ON public.ad_expenses;
CREATE POLICY "adx delete own"
  ON public.ad_expenses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
