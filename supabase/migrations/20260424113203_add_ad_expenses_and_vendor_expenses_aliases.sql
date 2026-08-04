/*
  # Add legacy column aliases to ad_expenses and vendor_expenses

  ## Summary
  Several components query these tables using legacy column names
  (`user_id`, `date`, `amount`, `vendor_name`, `is_cleared`, `cleared_at`,
  `cleared_by`) that don't exist in the canonical schema. Adding nullable
  alias columns plus sync triggers lets the existing UI keep reading/writing
  with no risk of data loss while we eventually unify on one set of names.

  ## Changes
  ad_expenses: adds user_id (mirrors created_by), date (mirrors occurred_on),
    amount (mirrors amount_kes).
  vendor_expenses: adds user_id (mirrors created_by), date (mirrors occurred_on),
    amount (mirrors amount_kes), vendor_name, is_cleared, cleared_at,
    cleared_by, updated_at.

  Before-insert/update triggers mirror values both ways so code using either
  name writes consistent data. No existing rows are destroyed.
*/

DO $$
BEGIN
  -- ad_expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_expenses' AND column_name='user_id') THEN
    ALTER TABLE public.ad_expenses ADD COLUMN user_id uuid;
    UPDATE public.ad_expenses SET user_id = created_by WHERE user_id IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_expenses' AND column_name='date') THEN
    ALTER TABLE public.ad_expenses ADD COLUMN date date;
    UPDATE public.ad_expenses SET date = occurred_on WHERE date IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_expenses' AND column_name='amount') THEN
    ALTER TABLE public.ad_expenses ADD COLUMN amount numeric;
    UPDATE public.ad_expenses SET amount = amount_kes WHERE amount IS NULL;
  END IF;

  -- vendor_expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='user_id') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN user_id uuid;
    UPDATE public.vendor_expenses SET user_id = created_by WHERE user_id IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='date') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN date date;
    UPDATE public.vendor_expenses SET date = occurred_on WHERE date IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='amount') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN amount numeric;
    UPDATE public.vendor_expenses SET amount = amount_kes WHERE amount IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='vendor_name') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN vendor_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='is_cleared') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN is_cleared boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='cleared_at') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN cleared_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='cleared_by') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN cleared_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_expenses' AND column_name='updated_at') THEN
    ALTER TABLE public.vendor_expenses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ad_expenses_sync_aliases()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.created_by IS NOT NULL THEN NEW.user_id := NEW.created_by; END IF;
  IF NEW.created_by IS NULL AND NEW.user_id IS NOT NULL THEN NEW.created_by := NEW.user_id; END IF;
  IF NEW.date IS NULL AND NEW.occurred_on IS NOT NULL THEN NEW.date := NEW.occurred_on; END IF;
  IF NEW.occurred_on IS NULL AND NEW.date IS NOT NULL THEN NEW.occurred_on := NEW.date; END IF;
  IF NEW.amount IS NULL AND NEW.amount_kes IS NOT NULL THEN NEW.amount := NEW.amount_kes; END IF;
  IF NEW.amount_kes IS NULL AND NEW.amount IS NOT NULL THEN NEW.amount_kes := NEW.amount; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_expenses_sync_aliases_trg ON public.ad_expenses;
CREATE TRIGGER ad_expenses_sync_aliases_trg
BEFORE INSERT OR UPDATE ON public.ad_expenses
FOR EACH ROW EXECUTE FUNCTION public.ad_expenses_sync_aliases();

CREATE OR REPLACE FUNCTION public.vendor_expenses_sync_aliases()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.created_by IS NOT NULL THEN NEW.user_id := NEW.created_by; END IF;
  IF NEW.created_by IS NULL AND NEW.user_id IS NOT NULL THEN NEW.created_by := NEW.user_id; END IF;
  IF NEW.date IS NULL AND NEW.occurred_on IS NOT NULL THEN NEW.date := NEW.occurred_on; END IF;
  IF NEW.occurred_on IS NULL AND NEW.date IS NOT NULL THEN NEW.occurred_on := NEW.date; END IF;
  IF NEW.amount IS NULL AND NEW.amount_kes IS NOT NULL THEN NEW.amount := NEW.amount_kes; END IF;
  IF NEW.amount_kes IS NULL AND NEW.amount IS NOT NULL THEN NEW.amount_kes := NEW.amount; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_expenses_sync_aliases_trg ON public.vendor_expenses;
CREATE TRIGGER vendor_expenses_sync_aliases_trg
BEFORE INSERT OR UPDATE ON public.vendor_expenses
FOR EACH ROW EXECUTE FUNCTION public.vendor_expenses_sync_aliases();

NOTIFY pgrst, 'reload schema';
