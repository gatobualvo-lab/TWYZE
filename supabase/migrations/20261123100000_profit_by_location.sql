/*
  # Top markets / delivery locations (backlog item 68)

  ## What
  Adds get_profit_by_location, grouping sales by the free-text `location`
  field already captured on every sale (the "delivery location" input in
  MultiProductSalesForm) -- same shape as the existing get_profit_by_customer,
  just grouped by location instead of client_name.
*/

CREATE OR REPLACE FUNCTION public.get_profit_by_location(p_start text, p_end text, p_limit int DEFAULT 50)
RETURNS TABLE (location text, revenue numeric, profit numeric, transaction_count bigint, last_order_date text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    trim(s.location) AS location,
    COALESCE(SUM(s.selling_price), 0) AS revenue,
    COALESCE(SUM(s.profit), 0) AS profit,
    COUNT(*) AS transaction_count,
    to_char(MAX(s.date::date), 'YYYY-MM-DD') AS last_order_date
  FROM public.sales s
  WHERE s.user_id = auth.uid() AND s.is_deleted = false AND s.is_archived = false
    AND s.location IS NOT NULL AND trim(s.location) <> ''
    AND s.date::date BETWEEN p_start::date AND p_end::date
  GROUP BY trim(s.location)
  ORDER BY profit DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_profit_by_location(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profit_by_location(text, text, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
