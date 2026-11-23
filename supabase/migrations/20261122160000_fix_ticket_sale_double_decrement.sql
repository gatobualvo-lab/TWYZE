/*
  # Fix ticket sales decrementing stock twice

  ## Problem
  `record_ticket_sale` (20261122150000) explicitly decrements the ticket
  tier's current_stock by the exact, id-scoped quantity sold, then inserts
  into sale_items. But an existing trigger (sale_items_decrement_inventory_trg,
  from 20260424114206) ALSO fires on that same insert and decrements stock
  again -- matched only by user_id + lower(product_name), with no item/project
  scoping. Every ticket sale was being decremented twice (e.g. selling 200
  tickets dropped stock by 400), and that generic trigger carries the same
  cross-event tier-name collision risk record_ticket_sale was written to avoid.

  ## Fix
  Reuse the session-flag guard pattern already used by the vendor-payment
  sync triggers (app.skip_vendor_sync) to make the generic inventory-decrement
  trigger skip rows inserted by record_ticket_sale, which performs its own
  correctly-scoped decrement instead.
*/

CREATE OR REPLACE FUNCTION public.sale_items_decrement_inventory()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  qty_delta numeric;
  match_user uuid;
  match_name text;
BEGIN
  IF current_setting('app.skip_ticket_inventory_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    qty_delta := -COALESCE(NEW.quantity, 0);
    match_user := NEW.user_id;
    match_name := NEW.product_name;
  ELSIF TG_OP = 'UPDATE' THEN
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

CREATE OR REPLACE FUNCTION public.record_ticket_sale(
  p_project_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_unit_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier_name text;
  v_sale_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'Price must be 0 or more';
  END IF;

  SELECT product_name INTO v_tier_name
    FROM public.inventory_items
   WHERE id = p_item_id AND project_id = p_project_id AND is_deleted = false
   FOR UPDATE;

  IF v_tier_name IS NULL THEN
    RAISE EXCEPTION 'Ticket tier not found';
  END IF;

  UPDATE public.inventory_items
     SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - p_quantity),
         updated_at = now()
   WHERE id = p_item_id;

  INSERT INTO public.sales (product_name, selling_price, buying_price, profit, payment_status, date, sale_date, project_id)
  VALUES (v_tier_name, p_quantity * p_unit_price, 0, p_quantity * p_unit_price, 'Paid', now(), now(), p_project_id)
  RETURNING id INTO v_sale_id;

  PERFORM set_config('app.skip_ticket_inventory_sync', 'on', true);
  INSERT INTO public.sale_items (sale_id, product_name, quantity, unit_price, selling_price, buying_price, subtotal, profit)
  VALUES (v_sale_id, v_tier_name, p_quantity, p_unit_price, p_unit_price, 0, p_quantity * p_unit_price, p_quantity * p_unit_price);
  PERFORM set_config('app.skip_ticket_inventory_sync', 'off', true);

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ticket_sale(uuid, uuid, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ticket_sale(uuid, uuid, integer, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
