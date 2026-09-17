/*
  # Expand Universal Search

  ## Why
  universal_search only ever covered customers, products, sales, suppliers,
  and documents — everything else added since (vendors via vendor_expenses,
  Projects, Business Goals, Recurring Invoices, General/Ad Expenses) was
  invisible to search even though each has its own page to jump to. This
  adds those five as new result types, following the exact same shape and
  ranking convention (exact > starts-with > contains) as the existing ones.

  General and Ad expenses share the 'expense' result type (two separate
  branches below, one per source table) since to a business owner they're
  both just "an expense" — the subtitle and action_tab still distinguish
  which one a given row actually is.

  Ownership scoping matches each table's own RLS policy exactly:
  business_goals is per-user (auth.uid()); vendor_expenses/ad_expenses are
  scoped by created_by = get_business_owner_id(); projects/recurring_invoices/
  general_expenses are scoped by user_id = get_business_owner_id(). RLS still
  enforces the has_permission()/restricts_to_own_records() layer transparently
  on top of this SECURITY INVOKER function, same as it always has for the
  original five branches.
*/

CREATE OR REPLACE FUNCTION public.universal_search(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  action_tab text,
  match_rank int
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH q AS (SELECT lower(trim(p_query)) AS term WHERE length(trim(p_query)) >= 2),
  results AS (
    SELECT
      'customer'::text AS result_type, c.id AS result_id, c.name AS title,
      NULLIF(COALESCE(c.phone, c.email, ''), '') AS subtitle,
      'customer-timeline'::text AS action_tab,
      CASE WHEN lower(c.name) = q.term THEN 0 WHEN lower(c.name) LIKE q.term || '%' THEN 1 ELSE 2 END AS match_rank
    FROM public.customers c, q
    WHERE c.user_id = auth.uid() AND lower(c.name) LIKE '%' || q.term || '%'

    UNION ALL

    SELECT
      'product', i.id, i.product_name,
      'Inventory · ' || COALESCE(i.current_stock::text, '0') || ' in stock',
      'inventory-predictions',
      CASE WHEN lower(i.product_name) = q.term THEN 0 WHEN lower(i.product_name) LIKE q.term || '%' THEN 1 ELSE 2 END
    FROM public.inventory_items i, q
    WHERE i.user_id = auth.uid() AND i.is_deleted = false
      AND i.product_name IS NOT NULL AND lower(i.product_name) LIKE '%' || q.term || '%'

    UNION ALL

    SELECT
      'sale', s.id, COALESCE(s.product_name, 'Sale'),
      'Sale' || CASE WHEN s.client_name IS NOT NULL AND s.client_name <> '' THEN ' · ' || s.client_name ELSE '' END
        || ' · ' || to_char(s.date::date, 'Mon DD, YYYY'),
      'view-sales',
      CASE WHEN lower(COALESCE(s.product_name, '')) = q.term OR lower(COALESCE(s.client_name, '')) = q.term THEN 0 ELSE 2 END
    FROM public.sales s, q
    WHERE s.user_id = auth.uid() AND s.is_deleted = false
      AND (lower(COALESCE(s.product_name, '')) LIKE '%' || q.term || '%' OR lower(COALESCE(s.client_name, '')) LIKE '%' || q.term || '%')

    UNION ALL

    SELECT
      'supplier', sup.id, COALESCE(NULLIF(sup.client, ''), NULLIF(sup.name, ''), 'Supplier sale'),
      'Supplier' || CASE WHEN sup.product IS NOT NULL AND sup.product <> '' THEN ' · ' || sup.product ELSE '' END,
      'view-suppliers',
      2
    FROM public.suppliers sup, q
    WHERE sup.user_id = auth.uid() AND sup.is_deleted = false
      AND (lower(COALESCE(sup.client, '')) LIKE '%' || q.term || '%'
        OR lower(COALESCE(sup.name, '')) LIKE '%' || q.term || '%'
        OR lower(COALESCE(sup.product, '')) LIKE '%' || q.term || '%')

    UNION ALL

    SELECT
      'document', d.id, d.document_number,
      initcap(d.document_type) || CASE WHEN d.customer_name IS NOT NULL AND d.customer_name <> '' THEN ' · ' || d.customer_name ELSE '' END,
      CASE d.document_type WHEN 'quotation' THEN 'documents-quotations' WHEN 'invoice' THEN 'documents-invoices' ELSE 'documents-receipts' END,
      CASE WHEN lower(d.document_number) = q.term THEN 0 ELSE 2 END
    FROM public.documents d, q
    WHERE d.user_id = auth.uid()
      AND (lower(d.document_number) LIKE '%' || q.term || '%' OR lower(COALESCE(d.customer_name, '')) LIKE '%' || q.term || '%')

    UNION ALL

    -- One row per distinct vendor name — vendor_expenses has many rows per vendor.
    -- Parenthesized: a DISTINCT ON's ORDER BY is only valid inside a UNION ALL
    -- branch when that branch is wrapped, otherwise Postgres can't tell
    -- whether the ORDER BY belongs to this SELECT or the whole union chain.
    (
      SELECT DISTINCT ON (lower(ve.vendor_name))
        'vendor', ve.id, ve.vendor_name,
        'Vendor'::text,
        'vendor-transactions',
        CASE WHEN lower(ve.vendor_name) = q.term THEN 0 WHEN lower(ve.vendor_name) LIKE q.term || '%' THEN 1 ELSE 2 END
      FROM public.vendor_expenses ve, q
      WHERE ve.created_by = public.get_business_owner_id()
        AND ve.vendor_name IS NOT NULL AND lower(ve.vendor_name) LIKE '%' || q.term || '%'
      ORDER BY lower(ve.vendor_name), ve.created_at DESC
    )

    UNION ALL

    SELECT
      'project', p.id, p.name,
      COALESCE(NULLIF(p.client_name, ''), 'Project'),
      'projects',
      CASE WHEN lower(p.name) = q.term THEN 0 WHEN lower(p.name) LIKE q.term || '%' THEN 1 ELSE 2 END
    FROM public.projects p, q
    WHERE p.user_id = public.get_business_owner_id()
      AND (lower(p.name) LIKE '%' || q.term || '%' OR lower(COALESCE(p.client_name, '')) LIKE '%' || q.term || '%')

    UNION ALL

    SELECT
      'goal', g.id, g.name,
      'Goal · ' || initcap(g.status),
      'goals',
      CASE WHEN lower(g.name) = q.term THEN 0 WHEN lower(g.name) LIKE q.term || '%' THEN 1 ELSE 2 END
    FROM public.business_goals g, q
    WHERE g.user_id = auth.uid() AND lower(g.name) LIKE '%' || q.term || '%'

    UNION ALL

    SELECT
      'recurring_invoice', ri.id, ri.customer_name,
      'Recurring invoice · ' || ri.description,
      'recurring-invoices',
      CASE WHEN lower(ri.customer_name) = q.term THEN 0 WHEN lower(ri.customer_name) LIKE q.term || '%' THEN 1 ELSE 2 END
    FROM public.recurring_invoices ri, q
    WHERE ri.user_id = public.get_business_owner_id()
      AND (lower(ri.customer_name) LIKE '%' || q.term || '%' OR lower(ri.description) LIKE '%' || q.term || '%')

    UNION ALL

    SELECT
      'expense', ge.id, COALESCE(NULLIF(ge.description, ''), ge.expense_type),
      'General expense · ' || ge.expense_type,
      'general-expenses',
      CASE WHEN lower(COALESCE(ge.description, '')) = q.term OR lower(ge.expense_type) = q.term THEN 0 ELSE 2 END
    FROM public.general_expenses ge, q
    WHERE ge.user_id = public.get_business_owner_id() AND COALESCE(ge.is_deleted, false) = false
      AND (lower(COALESCE(ge.description, '')) LIKE '%' || q.term || '%' OR lower(ge.expense_type) LIKE '%' || q.term || '%')

    UNION ALL

    SELECT
      'expense', ae.id, ae.description,
      'Ad expense'::text,
      'ad-expenses',
      CASE WHEN lower(ae.description) = q.term THEN 0 WHEN lower(ae.description) LIKE q.term || '%' THEN 1 ELSE 2 END
    FROM public.ad_expenses ae, q
    WHERE ae.created_by = public.get_business_owner_id() AND ae.is_deleted = false
      AND ae.description IS NOT NULL AND lower(ae.description) LIKE '%' || q.term || '%'
  )
  SELECT * FROM results
  ORDER BY match_rank, title
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.universal_search(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.universal_search(text, int) TO authenticated;
