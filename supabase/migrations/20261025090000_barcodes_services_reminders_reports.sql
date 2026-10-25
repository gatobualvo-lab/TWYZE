/*
  # Barcodes, service settings, task reminders, document images, periodic reports

  ## 1. Barcodes
  inventory_items.barcode lets a USB/Bluetooth scanner (or the phone camera)
  find a product at the till. Unique per user among live items.

  ## 2. Services get their own settings
  Services are listed on their own page and keep their own fields: how the
  rate is charged (flat / hourly / per session), typical duration, default
  staff member, and an active switch (inactive services are hidden from the
  Add Sale picker without deleting them).

  ## 3. Reminders
  business_tasks gets an optional due time and a reminder. remind_at is the
  moment to nudge the owner; reminder_sent_at is set by the scheduled
  function once the reminder email has gone out.

  ## 4. Product images on documents
  document_items.image_url: optional photo shown next to the line item.

  ## 5. Quarterly / half-year / yearly business reports
  - notification_preferences.period_reports_enabled and
    task_reminders_enabled: per-user opt-outs for the two scheduled emails.
  - period_report_log: remembers which report was sent to whom, so the daily
    schedule can never send the same report twice.
  - period_report_data(): the numbers behind a report, computed with the same
    rules as get_business_metrics (sales + wholesale revenue/profit, all three
    expense tables). Only the service role can call it.
*/

-- 1) Barcodes + 2) service settings ---------------------------------------
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_service_type_chk;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_service_type_chk
  CHECK (service_type IS NULL OR service_type IN ('flat', 'hourly', 'per_session'));

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_duration_chk;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_duration_chk
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_user_barcode
  ON public.inventory_items (user_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '' AND COALESCE(is_deleted, false) = false;

ALTER TABLE public.user_products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3) Task reminders -------------------------------------------------------
ALTER TABLE public.business_tasks
  ADD COLUMN IF NOT EXISTS due_time text,
  ADD COLUMN IF NOT EXISTS remind_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.business_tasks DROP CONSTRAINT IF EXISTS business_tasks_due_time_chk;
ALTER TABLE public.business_tasks
  ADD CONSTRAINT business_tasks_due_time_chk
  CHECK (due_time IS NULL OR due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE INDEX IF NOT EXISTS idx_business_tasks_remind_pending
  ON public.business_tasks (remind_at)
  WHERE remind_at IS NOT NULL AND reminder_sent_at IS NULL AND completed IS NOT TRUE;

-- 4) Product images on documents -----------------------------------------
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS image_url text;

-- 5) Periodic reports -----------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS period_reports_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_reminders_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.period_report_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_kind text NOT NULL CHECK (period_kind IN ('quarterly', 'semiannual', 'yearly')),
  period_start date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_kind, period_start)
);

-- No policies on purpose: only the service role (the scheduled function) touches this.
ALTER TABLE public.period_report_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_report_log FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.period_report_data(p_user uuid, p_start date, p_end date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT COALESCE(SUM(selling_price), 0) AS revenue, COALESCE(SUM(profit), 0) AS profit, COUNT(*) AS cnt
    FROM public.sales
    WHERE user_id = p_user AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start AND p_end
  ), sup AS (
    SELECT COALESCE(SUM(selling_price), 0) AS revenue, COALESCE(SUM(profit), 0) AS profit, COUNT(*) AS cnt
    FROM public.suppliers
    WHERE user_id = p_user AND is_deleted = false
      AND date::date BETWEEN p_start AND p_end
  ), ad AS (
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM public.ad_expenses
    WHERE created_by = p_user AND is_deleted = false AND is_archived = false
      AND occurred_on::date BETWEEN p_start AND p_end
  ), ve AS (
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM public.vendor_expenses
    WHERE created_by = p_user AND is_deleted = false
      AND occurred_on::date BETWEEN p_start AND p_end
  ), ge AS (
    SELECT COALESCE(SUM(amount), 0) AS total FROM public.general_expenses
    WHERE user_id = p_user AND is_deleted = false AND is_archived = false
      AND date::date BETWEEN p_start AND p_end
  ), recv AS (
    SELECT COALESCE(SUM(selling_price), 0) AS total FROM public.sales
    WHERE user_id = p_user AND is_deleted = false AND is_archived = false AND payment_status = 'Unpaid'
  ), top_products AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) AS rows FROM (
      SELECT si.product_name AS name,
             COALESCE(SUM(si.quantity), 0) AS units,
             COALESCE(SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)), 0) AS revenue,
             COALESCE(SUM(si.profit), 0) AS profit
      FROM public.sale_items si
      JOIN public.sales sl ON sl.id = si.sale_id
      WHERE si.user_id = p_user AND si.is_deleted = false
        AND sl.is_deleted = false AND sl.is_archived = false
        AND sl.date::date BETWEEN p_start AND p_end
      GROUP BY si.product_name
      ORDER BY SUM(COALESCE(si.subtotal, si.selling_price * si.quantity)) DESC
      LIMIT 5
    ) t
  ), top_customers AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) AS rows FROM (
      SELECT client_name AS name, COALESCE(SUM(selling_price), 0) AS revenue, COUNT(*) AS orders
      FROM public.sales
      WHERE user_id = p_user AND is_deleted = false AND is_archived = false
        AND COALESCE(client_name, '') <> ''
        AND date::date BETWEEN p_start AND p_end
      GROUP BY client_name
      ORDER BY SUM(selling_price) DESC
      LIMIT 3
    ) t
  )
  SELECT jsonb_build_object(
    'revenue', s.revenue + sup.revenue,
    'gross_profit', s.profit + sup.profit,
    'expenses', ad.total + ve.total + ge.total,
    'net_profit', s.profit + sup.profit - ad.total - ve.total - ge.total,
    'sales_count', s.cnt + sup.cnt,
    'receivables', recv.total,
    'top_products', top_products.rows,
    'top_customers', top_customers.rows
  )
  FROM s, sup, ad, ve, ge, recv, top_products, top_customers;
$$;

REVOKE ALL ON FUNCTION public.period_report_data(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.period_report_data(uuid, date, date) TO service_role;
