/*
  # Add RLS and Edit/Delete Support for Vendor Expenses

  ## Changes Made
  
  1. Schema Updates
    - Add `created_by` column to track expense ownership
    - Add index on `created_by` for performance
    
  2. Helper Functions
    - Create `is_admin()` helper function for role checking
    
  3. Row Level Security Policies
    - Enable RLS on vendor_expenses table
    - SELECT: Users can read their own expenses or if they're admin
    - INSERT: Users can only insert expenses they own
    - UPDATE: Users can update their own expenses or if they're admin
    - DELETE: Users can delete their own expenses or if they're admin
    
  ## Security Notes
  - All policies verify ownership via `created_by = auth.uid()`
  - Admin users have full access via `is_admin()` function
  - Policies are idempotent and can be reapplied safely
*/

-- Add created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_expenses' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.vendor_expenses 
    ADD COLUMN created_by uuid;
    
    -- Update existing rows to use the user_id if it exists
    UPDATE public.vendor_expenses 
    SET created_by = user_id 
    WHERE created_by IS NULL AND user_id IS NOT NULL;
    
    -- Make it NOT NULL with a default
    ALTER TABLE public.vendor_expenses 
    ALTER COLUMN created_by SET DEFAULT auth.uid(),
    ALTER COLUMN created_by SET NOT NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS vendor_expenses_created_by_idx 
  ON public.vendor_expenses(created_by);

-- Enable RLS
ALTER TABLE public.vendor_expenses ENABLE ROW LEVEL SECURITY;

-- Helper function: admin check (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = user_id 
    AND p.role = 'admin'
  );
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ve read own or admin" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve insert own" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve update own or admin" ON public.vendor_expenses;
DROP POLICY IF EXISTS "ve delete own or admin" ON public.vendor_expenses;

-- SELECT: own or admin
CREATE POLICY "ve read own or admin"
ON public.vendor_expenses 
FOR SELECT
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- INSERT: must be owner
CREATE POLICY "ve insert own"
ON public.vendor_expenses 
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- UPDATE: owner or admin
CREATE POLICY "ve update own or admin"
ON public.vendor_expenses 
FOR UPDATE
USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- DELETE: owner or admin
CREATE POLICY "ve delete own or admin"
ON public.vendor_expenses 
FOR DELETE
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));