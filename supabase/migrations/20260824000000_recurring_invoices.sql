/*
  # Recurring invoices

  ## Why
  Recurring expenses already exist (templates that regenerate a
  general_expenses row on a schedule); there was no equivalent for a
  business owner with a repeat client billed the same amount every
  week/month. This adds the same pattern for invoices.

  ## Why a self-scoped function, not a cron job
  Same constraint as recurring_expenses/subscription-lapse: no Edge
  Function/cron infrastructure exists in this project. run_due_recurring_invoices()
  only ever reads/writes the CALLING user's own rows (RLS-scoped via
  get_business_owner_id()), called once per session on Dashboard mount —
  exactly the run_due_recurring_expenses() pattern, generating a bounded
  catch-up (max 24 periods) if the owner hasn't opened the app in a while.

  ## Design choice: one line item per generated invoice
  A recurring invoice is a flat recurring charge (e.g. "Monthly retainer —
  KES 15,000"), not a multi-line order — matches the simplicity of
  recurring_expenses rather than building a recurring line-item template
  system nobody asked for.
*/

CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 28),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  next_run_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user ON public.recurring_invoices(user_id, next_run_date);

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_invoices_select" ON public.recurring_invoices;
CREATE POLICY "recurring_invoices_select" ON public.recurring_invoices FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));

DROP POLICY IF EXISTS "recurring_invoices_insert" ON public.recurring_invoices;
CREATE POLICY "recurring_invoices_insert" ON public.recurring_invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('documents'));

DROP POLICY IF EXISTS "recurring_invoices_update" ON public.recurring_invoices;
CREATE POLICY "recurring_invoices_update" ON public.recurring_invoices FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));

DROP POLICY IF EXISTS "recurring_invoices_delete" ON public.recurring_invoices;
CREATE POLICY "recurring_invoices_delete" ON public.recurring_invoices FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

DROP TRIGGER IF EXISTS trg_stamp_business_owner_recurring_invoices ON public.recurring_invoices;
CREATE TRIGGER trg_stamp_business_owner_recurring_invoices BEFORE INSERT ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner();

CREATE OR REPLACE FUNCTION public.run_due_recurring_invoices()
RETURNS int
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_next date;
  v_safety int;
  v_count int := 0;
  v_doc_number text;
  v_doc_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_invoices
    WHERE user_id = public.get_business_owner_id() AND is_active = true AND next_run_date <= CURRENT_DATE
  LOOP
    v_next := r.next_run_date;
    v_safety := 0;
    WHILE v_next <= CURRENT_DATE AND v_safety < 24 LOOP
      -- Explicit p_user_id: this function's own default (auth.uid()) would
      -- be wrong if a staff member with documents access is the one
      -- whose session happens to trigger this — the numbering sequence and
      -- generated document must belong to the business owner (r.user_id,
      -- already resolved via get_business_owner_id() on insert), not
      -- whoever is currently logged in.
      v_doc_number := public.generate_document_number('invoice', r.user_id);
      v_doc_id := gen_random_uuid();

      INSERT INTO public.documents (
        id, user_id, document_type, document_number, status, date, due_date,
        customer_name, customer_email, customer_phone,
        subtotal, total, amount_paid, balance_due, notes
      ) VALUES (
        v_doc_id, r.user_id, 'invoice', v_doc_number, 'sent', v_next, v_next + interval '14 days',
        r.customer_name, r.customer_email, r.customer_phone,
        r.amount, r.amount, 0, r.amount, 'Auto-generated from a recurring invoice'
      );

      INSERT INTO public.document_items (document_id, user_id, product_name, description, quantity, unit_price, total, sort_order)
      VALUES (v_doc_id, r.user_id, r.description, r.description, 1, r.amount, r.amount, 0);

      v_count := v_count + 1;
      v_next := CASE r.frequency
        WHEN 'weekly' THEN v_next + interval '7 days'
        ELSE (v_next + interval '1 month')
      END;
    END LOOP;

    UPDATE public.recurring_invoices SET next_run_date = v_next, updated_at = now() WHERE id = r.id;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_due_recurring_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_due_recurring_invoices() TO authenticated;
