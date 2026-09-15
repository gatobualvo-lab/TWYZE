/*
  # Universal Smart Search

  One SECURITY INVOKER function that searches across customers, products,
  sales, suppliers, and documents in a single round trip, ranked by match
  quality (exact > starts-with > contains). Doing this server-side avoids
  either (a) shipping every customer/product/sale to the browser to filter
  client-side, which won't scale, or (b) firing 5 separate queries per
  keystroke. The debouncing that keeps this from running on every keystroke
  in the first place lives client-side, in useUniversalSearch.
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
  )
  SELECT * FROM results
  ORDER BY match_rank, title
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.universal_search(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.universal_search(text, int) TO authenticated;
