/*
  # Link sales to a project/event, and count them in the project financial rollup

  ## Why
  An event organizer's main revenue (e.g. festival ticket sales) is recorded through the
  Sales module, not as invoices — but get_project_summary() (20260827120000_projects.sql)
  only ever looked at `documents` for revenue, so an event's budget page showed "Invoiced:
  0" no matter how many tickets sold. Adds the same nullable project_id FK already used on
  documents/general_expenses/ad_expenses/vendor_expenses to `sales`, and a separate
  sales_total column on the summary (kept apart from invoiced_total — they're different
  kinds of revenue) so ticket sales count toward an event's numbers.
*/

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_project_id ON public.sales(project_id) WHERE project_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_project_summary(uuid);
CREATE FUNCTION public.get_project_summary(p_project_id uuid DEFAULT NULL)
RETURNS TABLE (project_id uuid, invoiced_total numeric, sales_total numeric, spent_total numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH invoiced AS (
    SELECT d.project_id, SUM(COALESCE(d.total, 0)) AS invoiced_total
    FROM public.documents d
    WHERE d.user_id = public.get_business_owner_id() AND d.document_type = 'invoice'
      AND d.project_id IS NOT NULL AND (p_project_id IS NULL OR d.project_id = p_project_id)
    GROUP BY d.project_id
  ), sold AS (
    SELECT s.project_id, SUM(COALESCE(s.selling_price, 0)) AS sales_total
    FROM public.sales s
    WHERE s.user_id = public.get_business_owner_id() AND COALESCE(s.is_deleted, false) = false
      AND COALESCE(s.is_archived, false) = false
      AND s.project_id IS NOT NULL AND (p_project_id IS NULL OR s.project_id = p_project_id)
    GROUP BY s.project_id
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
  SELECT
    COALESCE(invoiced.project_id, sold.project_id, spent.project_id),
    COALESCE(invoiced.invoiced_total, 0),
    COALESCE(sold.sales_total, 0),
    COALESCE(spent.spent_total, 0)
  FROM invoiced
  FULL OUTER JOIN sold ON invoiced.project_id = sold.project_id
  FULL OUTER JOIN spent ON COALESCE(invoiced.project_id, sold.project_id) = spent.project_id
  WHERE public.has_permission('documents') AND public.has_permission('expenses');
$$;
REVOKE ALL ON FUNCTION public.get_project_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
