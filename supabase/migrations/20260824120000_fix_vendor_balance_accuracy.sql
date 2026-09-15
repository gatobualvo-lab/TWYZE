/*
  # Fix vendor balance accuracy

  ## Problems found during a vendor-payments audit
  1. `get_vendor_balance_summary` (used by Cash Position and the AI
     Business Assistant) summed ALL sale_items for a vendor's "total
     owed", including ones already marked Paid. Every other screen in the
     app (Vendor Transactions, Expense Overview) only counts Unpaid items
     as "owed" — so once any item was marked Paid, this RPC's balance for
     that vendor stopped shrinking and stayed wrong forever.
  2. `sale_items_vendor_payment_roll_up` (fired when a single sale_item's
     vendor_payment_status is flipped, e.g. from Vendor Transactions)
     recalculated the parent sale's amount_owed_to_vendor but never
     touched that row's own `vendor_payment` column — only the reverse
     roll-down trigger did. Nothing currently reads vendor_payment, so
     this was invisible, but it's a real data-integrity gap for any
     future report/export that does.

  ## Fix
  - Add `si.vendor_payment_status = 'Unpaid'` to the `owed` CTE.
  - Have the roll-up trigger also sync `vendor_payment` on the row that
    changed, mirroring the roll-down trigger's logic.
*/

CREATE OR REPLACE FUNCTION public.get_vendor_balance_summary(p_limit int DEFAULT 50)
RETURNS TABLE (vendor_name text, total_owed numeric, total_paid numeric, balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH owed AS (
    SELECT COALESCE(NULLIF(si.vendor_name, ''), NULLIF(si.vendor, ''), 'Unknown') AS vendor_name,
           SUM(COALESCE(si.buying_price, 0) * COALESCE(si.quantity, 0)) AS total_owed
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.user_id = public.get_business_owner_id() AND COALESCE(si.is_deleted, false) = false
      AND COALESCE(s.is_deleted, false) = false AND s.is_archived = false
      AND si.vendor_payment_status = 'Unpaid'
    GROUP BY 1
  ), paid AS (
    SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name,
           SUM(amount_kes) AS total_paid
    FROM public.vendor_expenses
    WHERE created_by = public.get_business_owner_id() AND is_deleted = false
    GROUP BY 1
  )
  SELECT
    COALESCE(owed.vendor_name, paid.vendor_name),
    COALESCE(owed.total_owed, 0),
    COALESCE(paid.total_paid, 0),
    COALESCE(owed.total_owed, 0) - COALESCE(paid.total_paid, 0) AS balance
  FROM owed FULL OUTER JOIN paid ON owed.vendor_name = paid.vendor_name
  WHERE public.has_permission('suppliers') AND public.has_permission('expenses')
  ORDER BY balance DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.sale_items_vendor_payment_roll_up()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_unpaid numeric;
  target_sale_id uuid;
BEGIN
  IF current_setting('app.skip_vendor_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  target_sale_id := NEW.sale_id;
  IF target_sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE(buying_price, 0) * COALESCE(quantity, 0)), 0)
    INTO total_unpaid
    FROM public.sale_items
   WHERE sale_id = target_sale_id
     AND COALESCE(is_deleted, false) = false
     AND vendor_payment_status = 'Unpaid';

  PERFORM set_config('app.skip_vendor_sync', 'on', true);

  -- Keep this row's own vendor_payment (amount actually paid) in sync
  -- with vendor_payment_status. Only the roll-down trigger did this
  -- before, so an item marked Paid/Unpaid directly left vendor_payment
  -- stale.
  UPDATE public.sale_items
     SET vendor_payment = CASE
           WHEN vendor_payment_status = 'Paid' THEN COALESCE(buying_price, 0) * COALESCE(quantity, 0)
           ELSE 0
         END,
         updated_at = now()
   WHERE id = NEW.id;

  UPDATE public.sales
     SET amount_owed_to_vendor = total_unpaid,
         payment_status = CASE
           WHEN total_unpaid = 0 AND COALESCE(delivery_fee_paid, true) THEN 'Paid'
           WHEN total_unpaid > 0 THEN 'Unpaid'
           ELSE payment_status
         END,
         updated_at = now()
   WHERE id = target_sale_id;
  PERFORM set_config('app.skip_vendor_sync', 'off', true);

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
