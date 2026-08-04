/*
# Add is_archived column for archiving sales and expenses

1. Modified Tables
   - `sales` - Added `is_archived` boolean column (default false)
   - `ad_expenses` - Added `is_archived` boolean column (default false)
   - `general_expenses` - Added `is_archived` boolean column (default false)

2. Purpose
   - Allow users to archive sales and expenses without deleting them
   - Archived items are excluded from all financial calculations and reports
   - Provides a non-destructive way to hide old/irrelevant records

3. Important Notes
   - Existing rows default to false (not archived)
   - Archived items remain in the database for audit/history purposes
   - Frontend queries should filter with is_archived = false to exclude archived items
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ad_expenses' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE ad_expenses ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'general_expenses' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE general_expenses ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;