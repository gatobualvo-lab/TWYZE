/*
  # Sync vendor payment status and auto-decrement inventory on sales

  ## Problem
  1. Marking a vendor as paid in the Sales List only updates
     `sales.amount_owed_to_vendor`; the Vendor Transactions screen reads
     `sale_items.vendor_payment_status`, so the change is invisible there.
  2. Recording a sale does not reduce stock in `inventory_items`, so
     inventory drifts out of sync with actual sales.

  ## Solution
  Add three triggers:
  - `sales_vendor_payment_roll_down`: when `sales.amount_owed_to_vendor`
    changes, mirror the Paid/Unpaid status down onto every related
    `sale_items` row.
  - `sale_items_vendor_payment_roll_up`: when a single sale_item row is
    flipped Paid/Unpaid, recalculate `sales.amount_owed_to_vendor` for
    the parent sale based on the remaining Unpaid items.
  - `sale_items_decrement_inventory`: on INSERT of a sale_item, decrement
    the matching `inventory_items.current_stock` (matched by user_id +
    product_name, case-insensitive). On soft-delete the stock is restored.

  ## Safety
  - Triggers are idempotent and protected with guard flags to avoid
    recursion between the two sync triggers.
  - No data is deleted. Inventory adjustments are bounded at 0.
*/

-- Helper: set a session flag so the two sync triggers don't ping-pong
CREATE OR REPLACE FUNCTION public.sales_vendor_payment_roll_down()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_status text;
BEGIN
  IF current_setting('app.skip_vendor_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(NEW.amount_owed_to_vendor, 0) IS DISTINCT FROM COALESCE(OLD.amount_owed_to_vendor, 0) THEN
    new_status := CASE WHEN COALESCE(NEW.amount_owed_to_vendor, 0) > 0 THEN 'Unpaid' ELSE 'Paid' END;

    PERFORM set_config('app.skip_vendor_sync', 'on', true);
    UPDATE public.sale_items
      SET vendor_payment_status = new_status,
          vendor_payment = CASE
            WHEN new_status = 'Paid' THEN COALESCE(buying_price, 0) * COALESCE(quantity, 0)
            ELSE 0
          END,
          updated_at = now()
      WHERE sale_id = NEW.id
        AND COALESCE(is_deleted, false) = false;
    PERFORM set_config('app.skip_vendor_sync', 'off', true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_vendor_payment_roll_down_trg ON public.sales;
CREATE TRIGGER sales_vendor_payment_roll_down_trg
AFTER UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sales_vendor_payment_roll_down();

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

DROP TRIGGER IF EXISTS sale_items_vendor_payment_roll_up_trg ON public.sale_items;
CREATE TRIGGER sale_items_vendor_payment_roll_up_trg
AFTER INSERT OR UPDATE OF vendor_payment_status ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.sale_items_vendor_payment_roll_up();

-- Inventory decrement on sale
CREATE OR REPLACE FUNCTION public.sale_items_decrement_inventory()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  qty_delta numeric;
  match_user uuid;
  match_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    qty_delta := -COALESCE(NEW.quantity, 0);
    match_user := NEW.user_id;
    match_name := NEW.product_name;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only react when a row is soft-deleted (restore stock) or undeleted
    IF COALESCE(OLD.is_deleted, false) = false AND COALESCE(NEW.is_deleted, false) = true THEN
      qty_delta := COALESCE(OLD.quantity, 0);
      match_user := OLD.user_id;
      match_name := OLD.product_name;
    ELSIF COALESCE(OLD.is_deleted, false) = true AND COALESCE(NEW.is_deleted, false) = false THEN
      qty_delta := -COALESCE(NEW.quantity, 0);
      match_user := NEW.user_id;
      match_name := NEW.product_name;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF match_user IS NULL OR match_name IS NULL OR qty_delta = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.inventory_items
     SET current_stock = GREATEST(COALESCE(current_stock, 0) + qty_delta, 0),
         quantity = GREATEST(COALESCE(quantity, 0) + qty_delta, 0),
         updated_at = now()
   WHERE user_id = match_user
     AND COALESCE(is_deleted, false) = false
     AND LOWER(COALESCE(product_name, name, '')) = LOWER(match_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_decrement_inventory_trg ON public.sale_items;
CREATE TRIGGER sale_items_decrement_inventory_trg
AFTER INSERT OR UPDATE OF is_deleted ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.sale_items_decrement_inventory();

NOTIFY pgrst, 'reload schema';
