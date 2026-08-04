/*
  # Complete Ad Expenses Setup

  1. Schema Changes
    - Ensure `ad_type` column exists with proper default
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

-- Ensure columns exist with proper defaults
ALTER TABLE public.ad_expenses
  ADD COLUMN IF NOT EXISTS ad_type text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS created_by uuid NOT NULL DEFAULT auth.uid();

-- Create index
CREATE INDEX IF NOT EXISTS ad_expenses_created_by_idx ON public.ad_expenses(created_by);

-- Enable RLS
ALTER TABLE public.ad_expenses ENABLE ROW LEVEL SECURITY;

-- Helper function for admin bypass (idempotent)
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "adx insert own" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx read own or admin" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx update own" ON public.ad_expenses;
DROP POLICY IF EXISTS "adx delete own" ON public.ad_expenses;

-- Insert policy: only authenticated users can insert their own expenses
CREATE POLICY "adx insert own"
  ON public.ad_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Select policy: read own expenses or admin can read all
CREATE POLICY "adx read own or admin"
  ON public.ad_expenses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Update policy: only update own expenses
CREATE POLICY "adx update own"
  ON public.ad_expenses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Delete policy: only delete own expenses
CREATE POLICY "adx delete own"
  ON public.ad_expenses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
