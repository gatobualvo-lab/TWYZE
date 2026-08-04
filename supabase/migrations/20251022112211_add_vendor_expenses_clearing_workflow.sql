/*
  # Add Clearing Workflow to Vendor Expenses

  ## Changes Made
  
  1. Schema Updates
    - Add `is_cleared` boolean flag (default false)
    - Add `cleared_at` timestamp for when expense was marked paid
    - Add `cleared_by` uuid to track who cleared it
    - Add indexes for performance on clearing queries
    
  2. RPC Function
    - Create `vendor_expenses_mark_all_paid()` function
    - Marks all uncleared expenses for a vendor as paid
    - Returns count of expenses cleared
    - Uses security definer with proper ownership checks
    
  3. Security
    - Maintains existing RLS policies for owner/admin access
    - RPC function respects ownership constraints
    
  ## Usage
  - Individual expenses can be toggled via UPDATE
  - Bulk clearing via RPC function for convenience
  - Cleared expenses remain in database with audit trail
*/

-- Add clearing columns if they don't exist
DO $$
BEGIN
  -- Add is_cleared column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_expenses' 
    AND column_name = 'is_cleared'
  ) THEN
    ALTER TABLE public.vendor_expenses 
    ADD COLUMN is_cleared boolean NOT NULL DEFAULT false;
  END IF;

  -- Add cleared_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_expenses' 
    AND column_name = 'cleared_at'
  ) THEN
    ALTER TABLE public.vendor_expenses 
    ADD COLUMN cleared_at timestamptz;
  END IF;

  -- Add cleared_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_expenses' 
    AND column_name = 'cleared_by'
  ) THEN
    ALTER TABLE public.vendor_expenses 
    ADD COLUMN cleared_by uuid;
  END IF;
END $$;

-- Create indexes for clearing workflow
CREATE INDEX IF NOT EXISTS ve_is_cleared_idx 
  ON public.vendor_expenses(is_cleared);

CREATE INDEX IF NOT EXISTS ve_vendor_name_idx 
  ON public.vendor_expenses(vendor_name);

-- RPC function to mark all expenses for a vendor as paid
CREATE OR REPLACE FUNCTION public.vendor_expenses_mark_all_paid(v_vendor_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleared int;
BEGIN
  -- Update all uncleared expenses for this vendor that the user owns
  UPDATE public.vendor_expenses
     SET is_cleared = true,
         cleared_at = now(),
         cleared_by = auth.uid()
   WHERE vendor_name = v_vendor_name
     AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
     AND is_cleared = false;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN v_cleared;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.vendor_expenses_mark_all_paid(text) TO authenticated;