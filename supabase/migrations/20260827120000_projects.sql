/*
  Projects — a wrapper entity for contractors/agencies billing one client
  across multiple invoices for a single job, tracking budget vs money
  invoiced (documents) vs money spent (expenses). Documents, recurring
  invoice templates, and the three expense tables each optionally attach
  via a nullable project_id FK — the same additive pattern already used
  for documents.customer_id (20260807090000_business_intelligence_foundation.sql).
*/

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  client_name text,
  budget numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('documents'));
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

DROP TRIGGER IF EXISTS trg_stamp_business_owner_projects ON public.projects;
CREATE TRIGGER trg_stamp_business_owner_projects BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner();

-- Nullable, additive FKs onto everything a project can wrap.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_invoices ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.general_expenses ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.ad_expenses ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_expenses ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_project_id ON public.recurring_invoices(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_general_expenses_project_id ON public.general_expenses(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_expenses_project_id ON public.ad_expenses(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_expenses_project_id ON public.vendor_expenses(project_id) WHERE project_id IS NOT NULL;

-- run_due_recurring_invoices() must copy project_id onto each generated
-- document — full replace, only the INSERT column/value lists change from
-- the existing definition in 20260824000000_recurring_invoices.sql.
CREATE OR REPLACE FUNCTION public.run_due_recurring_invoices()
RETURNS int LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD; v_next date; v_safety int; v_count int := 0; v_doc_number text; v_doc_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_invoices
    WHERE user_id = public.get_business_owner_id() AND is_active = true AND next_run_date <= CURRENT_DATE
  LOOP
    v_next := r.next_run_date; v_safety := 0;
    WHILE v_next <= CURRENT_DATE AND v_safety < 24 LOOP
      v_doc_number := public.generate_document_number('invoice', r.user_id);
      v_doc_id := gen_random_uuid();
      INSERT INTO public.documents (
        id, user_id, document_type, document_number, status, date, due_date,
        customer_name, customer_email, customer_phone, project_id,
        subtotal, total, amount_paid, balance_due, notes
      ) VALUES (
        v_doc_id, r.user_id, 'invoice', v_doc_number, 'sent', v_next, v_next + interval '14 days',
        r.customer_name, r.customer_email, r.customer_phone, r.project_id,
        r.amount, r.amount, 0, r.amount, 'Auto-generated from a recurring invoice'
      );
      INSERT INTO public.document_items (document_id, user_id, product_name, description, quantity, unit_price, total, sort_order)
      VALUES (v_doc_id, r.user_id, r.description, r.description, 1, r.amount, r.amount, 0);
      v_count := v_count + 1; v_safety := v_safety + 1;
      v_next := CASE r.frequency WHEN 'weekly' THEN v_next + interval '7 days' ELSE (v_next + interval '1 month') END;
    END LOOP;
    UPDATE public.recurring_invoices SET next_run_date = v_next, updated_at = now() WHERE id = r.id;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_due_recurring_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_due_recurring_invoices() TO authenticated;

-- Project rollup — same two-CTE-FULL-OUTER-JOIN shape as
-- get_vendor_balance_summary, grouped by project_id (a real FK).
CREATE OR REPLACE FUNCTION public.get_project_summary(p_project_id uuid DEFAULT NULL)
RETURNS TABLE (project_id uuid, invoiced_total numeric, spent_total numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH invoiced AS (
    SELECT d.project_id, SUM(COALESCE(d.total, 0)) AS invoiced_total
    FROM public.documents d
    WHERE d.user_id = public.get_business_owner_id() AND d.document_type = 'invoice'
      AND d.project_id IS NOT NULL AND (p_project_id IS NULL OR d.project_id = p_project_id)
    GROUP BY d.project_id
  ), spent AS (
    SELECT project_id, SUM(amount) AS spent_total FROM (
      SELECT project_id, COALESCE(amount, 0) AS amount FROM public.general_expenses
        WHERE user_id = public.get_business_owner_id() AND COALESCE(is_deleted, false) = false
          AND COALESCE(is_archived, false) = false AND project_id IS NOT NULL
          AND (p_project_id IS NULL OR project_id = p_project_id)
      UNION ALL
      SELECT project_id, COALESCE(amount_kes, 0) AS amount FROM public.ad_expenses
        WHERE created_by = public.get_business_owner_id() AND is_deleted = false AND is_archived = false
          AND project_id IS NOT NULL AND (p_project_id IS NULL OR project_id = p_project_id)
      UNION ALL
      SELECT project_id, COALESCE(amount_kes, 0) AS amount FROM public.vendor_expenses
        WHERE created_by = public.get_business_owner_id() AND is_deleted = false
          AND project_id IS NOT NULL AND (p_project_id IS NULL OR project_id = p_project_id)
    ) combined GROUP BY project_id
  )
  SELECT COALESCE(invoiced.project_id, spent.project_id), COALESCE(invoiced.invoiced_total, 0), COALESCE(spent.spent_total, 0)
  FROM invoiced FULL OUTER JOIN spent ON invoiced.project_id = spent.project_id
  WHERE public.has_permission('documents') AND public.has_permission('expenses');
$$;
REVOKE ALL ON FUNCTION public.get_project_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
