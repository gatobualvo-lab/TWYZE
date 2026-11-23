/*
  # Record ticket sales entirely within the Events section

  ## Problem
  Ticket tiers (inventory_items scoped by project_id) were meant to be sold
  through the normal multi-product Sales screen, picking the event from its
  project picker. In practice, event organizers don't ring up ticket sales
  through a POS screen at all — they sell via Eventbrite, M-Pesa till
  numbers, door cash, or agents, then just want to log how many sold and at
  what price, batch by batch (e.g. "2000 Regular at 2,500", "1,000 VIP at
  3,000"), without leaving the Events tab.

  ## Also fixes
  `decrement_inventory_stock` (20260805120000) matches by product_name alone
  across ALL of a user's inventory. Ticket tiers are very likely to repeat
  names across different events ("VIP", "Regular" exist at every festival),
  so reusing it here would silently decrement the wrong event's tier. This
  function instead targets one exact inventory_items.id, scoped additionally
  to the given project_id.

  ## What this does
  One SECURITY INVOKER call that, atomically:
  - Locks and validates the specific ticket tier (by id + project_id),
  - Decrements its current_stock by the sold quantity (floor 0),
  - Inserts a matching sales + sale_items row (project_id-scoped, so it
    already flows into get_project_summary()'s sales_total for the event),
  and returns the new sale id. user_id/entered_by are left for the existing
  trg_stamp_business_owner trigger (already attached to sales/sale_items/
  inventory_items) to stamp, same as every other insert path.
*/

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

  INSERT INTO public.sale_items (sale_id, product_name, quantity, unit_price, selling_price, buying_price, subtotal, profit)
  VALUES (v_sale_id, v_tier_name, p_quantity, p_unit_price, p_unit_price, 0, p_quantity * p_unit_price, p_quantity * p_unit_price);

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ticket_sale(uuid, uuid, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ticket_sale(uuid, uuid, integer, numeric) TO authenticated;
