/*
  # Fix ad_expenses.ad_type CHECK constraint

  ## Why
  Same class of bug as the earlier vendor_expenses.expense_type fix: the
  live `ad_expenses_ad_type_chk` constraint doesn't match
  src/pages/AdExpensesPage.tsx's TYPES list (["Boost","Leads","Conversion",
  "Awareness","Other"]) — confirmed live by inserting a row with
  ad_type='Awareness', which the UI itself offers as a dropdown option, and
  having it rejected. No tracked migration ever created this constraint
  (it isn't defined anywhere in supabase/migrations), so it must have been
  added directly via the Supabase dashboard at some point, out of sync with
  the app.
*/

ALTER TABLE public.ad_expenses DROP CONSTRAINT IF EXISTS ad_expenses_ad_type_chk;

ALTER TABLE public.ad_expenses ADD CONSTRAINT ad_expenses_ad_type_chk
  CHECK (ad_type IN ('Boost', 'Leads', 'Conversion', 'Awareness', 'Other'));
