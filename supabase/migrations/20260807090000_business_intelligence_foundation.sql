/*
  # Business Intelligence foundation: metrics engine + customers table

  ## Why
  Every planned BI feature (Health Score, Profit Analytics, Daily Closing
  Report, Opportunity Center, AI Advisor, Business Goals) needs the same
  underlying numbers: revenue, cost of goods, profit, expenses, outstanding
  balances. Today those are computed independently, client-side, in at least
  four different screens (Dashboard, DashboardHome, MonthlyDashboard,
  ReportsAnalytics), each fetching full row sets and reducing in JS — fine at
  today's data volumes, but it means five different "net profit" formulas
  and won't scale as businesses accumulate years of records.

  This migration adds one aggregation layer in Postgres that every feature
  queries instead of re-deriving. All functions are SECURITY INVOKER (they
  run as the calling user — RLS applies exactly as it would to a normal
  query, no privilege escalation) and STABLE (safe to call multiple times
  in one statement).

  Date-ish columns (sales.date, suppliers.date, general_expenses.date,
  *.occurred_on) are `timestamptz` under the hood even though generated
  TS types show `string` — every comparison/grouping below casts to `::date`
  defensively so it's correct regardless of whether the underlying column
  is `date`, `timestamp`, or `timestamptz`.

  ## Accounting notes
  - Revenue/profit come from TWO existing tables: `sales` (the primary sales
    flow) and `suppliers` (despite its name, this table records sales made
    *to* clients — confirmed by reading SupplierDashboard.tsx). Both are
    summed together, matching the convention already established in
    MonthlyDashboard.tsx.
  - Profit is read from the stored `profit` column on each row (computed at
    entry time by the existing sale/vendor forms) rather than recomputed
    from buying/selling price, so this matches whatever the app already
    shows on each record instead of silently disagreeing with it.
  - Expenses = ad_expenses + vendor_expenses + general_expenses. Note this
    intentionally differs from MonthlyDashboard.tsx, which omits
    vendor_expenses from its net-profit calc — that omission looks like a
    gap (vendor_expenses are real money out), so the shared engine corrects
    it rather than repeating it. MonthlyDashboard itself is left as-is.
  - Cash received (for the Daily Closing Report) is tracked separately from
    profit: profit is accrual (every sale counts, paid or not), cash is only
    what's actually been collected. Conflating the two is a common
    bookkeeping mistake this engine deliberately avoids.

  ## New table: customers
  "Customers" today are just a free-text string (`sales.client_name`), which
  can't hold notes, a status, or a stable identity for a timeline. This adds
  a real `customers` table and a nullable `customer_id` on `sales` and
  `documents` — fully additive, existing `client_name`/`customer_name` text
  columns are untouched, nothing that reads them today breaks. A backfill
  populates `customers` from existing distinct names and opportunistically
  links matching rows; anything ambiguous is left unlinked and falls back to
  name-based grouping, same as ClientManagement.tsx already does.
*/

-- ============================================================
-- 1) customers table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_name_unique ON public.customers(user_id, lower(name));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Nullable, additive FKs — existing code paths that only use client_name/
-- customer_name keep working unmodified.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_id') THEN
    ALTER TABLE public.sales ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='customer_id') THEN
    ALTER TABLE public.documents ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON public.documents(customer_id) WHERE customer_id IS NOT NULL;

-- Backfill: one customer row per distinct (user_id, lower(client_name)) seen
-- in sales, then link matching sales/documents rows. Best-effort, additive,
-- never touches existing text columns.
INSERT INTO public.customers (user_id, name, phone, first_seen_at, last_activity_at)
SELECT
  s.user_id,
  trim(s.client_name),
  (array_agg(s.customer_phone) FILTER (WHERE s.customer_phone IS NOT NULL AND s.customer_phone <> ''))[1],
  min(COALESCE(s.created_at, now())),
  max(COALESCE(s.created_at, now()))
FROM public.sales s
WHERE s.client_name IS NOT NULL AND trim(s.client_name) <> ''
GROUP BY s.user_id, trim(s.client_name)
ON CONFLICT (user_id, lower(name)) DO NOTHING;

UPDATE public.sales s
SET customer_id = c.id
FROM public.customers c
WHERE s.customer_id IS NULL
  AND s.client_name IS NOT NULL AND trim(s.client_name) <> ''
  AND c.user_id = s.user_id
  AND lower(c.name) = lower(trim(s.client_name));

INSERT INTO public.customers (user_id, name, phone, email, first_seen_at, last_activity_at)
SELECT
  d.user_id,
  trim(d.customer_name),
  (array_agg(d.customer_phone) FILTER (WHERE d.customer_phone IS NOT NULL AND d.customer_phone <> ''))[1],
  (array_agg(d.customer_email) FILTER (WHERE d.customer_email IS NOT NULL AND d.customer_email <> ''))[1],
  min(COALESCE(d.created_at, now())),
  max(COALESCE(d.created_at, now()))
FROM public.documents d
WHERE d.customer_name IS NOT NULL AND trim(d.customer_name) <> ''
GROUP BY d.user_id, trim(d.customer_name)
ON CONFLICT (user_id, lower(name)) DO NOTHING;

UPDATE public.documents d
SET customer_id = c.id
FROM public.customers c
WHERE d.customer_id IS NULL
  AND d.customer_name IS NOT NULL AND trim(d.customer_name) <> ''
  AND c.user_id = d.user_id
  AND lower(c.name) = lower(trim(d.customer_name));

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE OR REPLACE FUNCTION public.set_customers_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customers_updated_at();

-- ============================================================
-- 2) Metrics engine
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_business_metrics(p_start text, p_end text)
RETURNS TABLE (
  sales_revenue numeric, sales_profit numeric, sales_count bigint,
  supplier_revenue numeric, supplier_profit numeric, supplier_count bigint,
  ad_expenses numeric, vendor_expenses numeric, general_expenses numeric,
  total_expenses numeric,
  gross_profit numeric, net_profit numeric,
  outstanding_receivables numeric, outstanding_payables numeric,
  cash_received numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT
      COALESCE(SUM(selling_price), 0) AS revenue,
      COALESCE(SUM(profit), 0) AS profit,
      COUNT(*) AS cnt,
      COALESCE(SUM(selling_price) FILTER (WHERE payment_status = 'Paid'), 0) AS cash
    FROM public.sales
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start::date AND p_end::date
  ), sup AS (
    SELECT
      COALESCE(SUM(selling_price), 0) AS revenue,
      COALESCE(SUM(profit), 0) AS profit,
      COUNT(*) AS cnt,
      COALESCE(SUM(COALESCE(amount_paid, CASE WHEN payment_status = 'Paid' THEN selling_price ELSE 0 END)), 0) AS cash
    FROM public.suppliers
    WHERE user_id = auth.uid() AND is_deleted = false
      AND date::date BETWEEN p_start::date AND p_end::date
  ), ad AS (
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM public.ad_expenses
    WHERE created_by = auth.uid() AND is_deleted = false AND is_archived = false
      AND occurred_on::date BETWEEN p_start::date AND p_end::date
  ), ve AS (
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM public.vendor_expenses
    WHERE created_by = auth.uid() AND is_deleted = false
      AND occurred_on::date BETWEEN p_start::date AND p_end::date
  ), ge AS (
    SELECT COALESCE(SUM(amount), 0) AS total FROM public.general_expenses
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start::date AND p_end::date
  ), recv AS (
    SELECT COALESCE(SUM(selling_price), 0) AS total FROM public.sales
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
      AND payment_status = 'Unpaid'
  ), recv_sup AS (
    SELECT COALESCE(SUM(GREATEST(COALESCE(balance_due, 0), 0)), 0) AS total FROM public.suppliers
    WHERE user_id = auth.uid() AND is_deleted = false
      AND COALESCE(payment_status, 'Unpaid') <> 'Paid'
  ), payables AS (
    SELECT COALESCE(SUM(amount_owed_to_vendor), 0) AS total FROM public.sales
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
  )
  SELECT
    s.revenue, s.profit, s.cnt,
    sup.revenue, sup.profit, sup.cnt,
    ad.total, ve.total, ge.total,
    (ad.total + ve.total + ge.total) AS total_expenses,
    (s.profit + sup.profit) AS gross_profit,
    (s.profit + sup.profit - ad.total - ve.total - ge.total) AS net_profit,
    (recv.total + recv_sup.total) AS outstanding_receivables,
    payables.total AS outstanding_payables,
    (s.cash + sup.cash) AS cash_received
  FROM s, sup, ad, ve, ge, recv, recv_sup, payables;
$$;

REVOKE ALL ON FUNCTION public.get_business_metrics(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_metrics(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_series(p_start text, p_end text)
RETURNS TABLE (day text, revenue numeric, profit numeric, expenses numeric, transaction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT to_char(d, 'YYYY-MM-DD') AS day
    FROM generate_series(p_start::date, p_end::date, interval '1 day') d
  ), rev AS (
    SELECT to_char(date::date, 'YYYY-MM-DD') AS day, SUM(selling_price) AS revenue, SUM(profit) AS profit, COUNT(*) AS cnt
    FROM public.sales
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start::date AND p_end::date
    GROUP BY date::date
  ), sup_rev AS (
    SELECT to_char(date::date, 'YYYY-MM-DD') AS day, SUM(selling_price) AS revenue, SUM(profit) AS profit, COUNT(*) AS cnt
    FROM public.suppliers
    WHERE user_id = auth.uid() AND is_deleted = false
      AND date::date BETWEEN p_start::date AND p_end::date
    GROUP BY date::date
  ), exp AS (
    SELECT to_char(occurred_on::date, 'YYYY-MM-DD') AS day, SUM(amount_kes) AS total FROM public.ad_expenses
    WHERE created_by = auth.uid() AND is_deleted = false AND is_archived = false
      AND occurred_on::date BETWEEN p_start::date AND p_end::date
    GROUP BY occurred_on::date
    UNION ALL
    SELECT to_char(occurred_on::date, 'YYYY-MM-DD') AS day, SUM(amount_kes) AS total FROM public.vendor_expenses
    WHERE created_by = auth.uid() AND is_deleted = false
      AND occurred_on::date BETWEEN p_start::date AND p_end::date
    GROUP BY occurred_on::date
    UNION ALL
    SELECT to_char(date::date, 'YYYY-MM-DD') AS day, SUM(amount) AS total FROM public.general_expenses
    WHERE user_id = auth.uid() AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start::date AND p_end::date
    GROUP BY date::date
  ), exp_by_day AS (
    SELECT day, SUM(total) AS total FROM exp GROUP BY day
  )
  SELECT
    days.day,
    COALESCE(rev.revenue, 0) + COALESCE(sup_rev.revenue, 0) AS revenue,
    COALESCE(rev.profit, 0) + COALESCE(sup_rev.profit, 0) AS profit,
    COALESCE(exp_by_day.total, 0) AS expenses,
    COALESCE(rev.cnt, 0) + COALESCE(sup_rev.cnt, 0) AS transaction_count
  FROM days
  LEFT JOIN rev ON rev.day = days.day
  LEFT JOIN sup_rev ON sup_rev.day = days.day
  LEFT JOIN exp_by_day ON exp_by_day.day = days.day
  ORDER BY days.day;
$$;

REVOKE ALL ON FUNCTION public.get_daily_series(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_series(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profit_by_product(p_start text, p_end text, p_limit int DEFAULT 50)
RETURNS TABLE (product_name text, units_sold numeric, revenue numeric, cost numeric, profit numeric, margin_pct numeric, transaction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    si.product_name,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)), 0) AS revenue,
    COALESCE(SUM(si.buying_price * si.quantity), 0) AS cost,
    COALESCE(SUM(si.profit), 0) AS profit,
    CASE WHEN COALESCE(SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)), 0) = 0 THEN NULL
      ELSE round(100 * COALESCE(SUM(si.profit), 0) / SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)), 1)
    END AS margin_pct,
    COUNT(DISTINCT si.sale_id) AS transaction_count
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.user_id = auth.uid() AND si.is_deleted = false
    AND s.is_deleted = false AND s.is_archived = false
    AND s.date::date BETWEEN p_start::date AND p_end::date
  GROUP BY si.product_name
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
    COALESCE(SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)), 0) AS revenue,
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

CREATE OR REPLACE FUNCTION public.get_profit_by_customer(p_start text, p_end text, p_limit int DEFAULT 50)
RETURNS TABLE (customer_name text, customer_id uuid, revenue numeric, profit numeric, transaction_count bigint, last_order_date text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    trim(s.client_name) AS customer_name,
    (array_agg(s.customer_id) FILTER (WHERE s.customer_id IS NOT NULL))[1] AS customer_id,
    COALESCE(SUM(s.selling_price), 0) AS revenue,
    COALESCE(SUM(s.profit), 0) AS profit,
    COUNT(*) AS transaction_count,
    to_char(MAX(s.date::date), 'YYYY-MM-DD') AS last_order_date
  FROM public.sales s
  WHERE s.user_id = auth.uid() AND s.is_deleted = false AND s.is_archived = false
    AND s.client_name IS NOT NULL AND trim(s.client_name) <> ''
    AND s.date::date BETWEEN p_start::date AND p_end::date
  GROUP BY trim(s.client_name)
  ORDER BY profit DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_profit_by_customer(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profit_by_customer(text, text, int) TO authenticated;
