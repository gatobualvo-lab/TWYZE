/*
  # Atomic inventory stock decrement

  ## Problem
  MultiProductSalesForm decremented inventory with a client-side
  read-then-write: SELECT current_stock, then UPDATE with the computed
  value. Two sales of the same product recorded close together can both
  read the same starting stock and overwrite each other's decrement,
  leaving inventory counts wrong with no error raised.

  ## Fix
  A SECURITY INVOKER function that does the read and write in a single
  atomic UPDATE inside Postgres, scoped to the calling user via
  `auth.uid()` (same authorization boundary as the existing RLS policy
  on inventory_items — SECURITY INVOKER means this function has no more
  access than the calling user already has).
*/

CREATE OR REPLACE FUNCTION public.decrement_inventory_stock(
  p_product_name text,
  p_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.inventory_items
     SET current_stock = GREATEST(0, current_stock - p_quantity),
         updated_at = now()
   WHERE user_id = auth.uid()
     AND is_deleted = false
     AND product_name ILIKE p_product_name;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_inventory_stock(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrement_inventory_stock(text, numeric) TO authenticated;
