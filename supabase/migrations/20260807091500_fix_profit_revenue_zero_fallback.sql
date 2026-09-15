/*
  # Fix revenue showing 0 in get_profit_by_product/get_profit_by_vendor

  ## Problem
  Confirmed by querying real data: many sale_items rows have `subtotal` and
  `unit_price` stored as the literal number 0 (not null) — apparently never
  populated by an earlier version of the sale form — while `selling_price`
  is reliably populated. COALESCE only falls through on NULL, not on 0, so
  `COALESCE(si.subtotal, si.selling_price * si.quantity)` picked up the
  bogus 0 every time instead of falling back, and every product showed
  KES 0 revenue despite correct cost/profit figures.

  ## Fix
  Reorder the fallback to prefer selling_price * quantity (confirmed
  reliable), treating 0 as "not set" via NULLIF at each step, with
  buying_price + profit as a last resort for rows where even selling_price
  is missing.
*/

-- margin_pct needs the revenue total, which is only known after the SUM
-- below, so it's computed in a wrapping query rather than inline.
CREATE OR REPLACE FUNCTION public.get_profit_by_product(p_start text, p_end text, p_limit int DEFAULT 50)
RETURNS TABLE (product_name text, units_sold numeric, revenue numeric, cost numeric, profit numeric, margin_pct numeric, transaction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    product_name, units_sold, revenue, cost, profit,
    CASE WHEN revenue = 0 THEN NULL ELSE round(100 * profit / revenue, 1) END AS margin_pct,
    transaction_count
  FROM (
    SELECT
      si.product_name,
      COALESCE(SUM(si.quantity), 0) AS units_sold,
      COALESCE(SUM(
        COALESCE(NULLIF(si.selling_price, 0) * si.quantity, NULLIF(si.subtotal, 0), si.buying_price * si.quantity + si.profit, 0)
      ), 0) AS revenue,
      COALESCE(SUM(si.buying_price * si.quantity), 0) AS cost,
      COALESCE(SUM(si.profit), 0) AS profit,
      COUNT(DISTINCT si.sale_id) AS transaction_count
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.user_id = auth.uid() AND si.is_deleted = false
      AND s.is_deleted = false AND s.is_archived = false
      AND s.date::date BETWEEN p_start::date AND p_end::date
    GROUP BY si.product_name
  ) agg
  ORDER BY profit DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_profit_by_product(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profit_by_product(text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profit_by_vendor(p_start text, p_end text, p_limit int DEFAULT 50)
RETURNS TABLE (vendor_name text, units_bought numeric, revenue numeric, cost numeric, profit numeric, transaction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(NULLIF(si.vendor_name, ''), NULLIF(si.vendor, ''), 'Unknown') AS vendor_name,
    COALESCE(SUM(si.quantity), 0) AS units_bought,
    COALESCE(SUM(
      COALESCE(NULLIF(si.selling_price, 0) * si.quantity, NULLIF(si.subtotal, 0), si.buying_price * si.quantity + si.profit, 0)
    ), 0) AS revenue,
    COALESCE(SUM(si.buying_price * si.quantity), 0) AS cost,
    COALESCE(SUM(si.profit), 0) AS profit,
    COUNT(DISTINCT si.sale_id) AS transaction_count
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.user_id = auth.uid() AND si.is_deleted = false
    AND s.is_deleted = false AND s.is_archived = false
    AND s.date::date BETWEEN p_start::date AND p_end::date
  GROUP BY COALESCE(NULLIF(si.vendor_name, ''), NULLIF(si.vendor, ''), 'Unknown')
  ORDER BY profit DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_profit_by_vendor(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profit_by_vendor(text, text, int) TO authenticated;
