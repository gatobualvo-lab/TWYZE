/*
  Service line items

  A per-line-item Goods/Service toggle on sale_items, so a hybrid business
  (e.g. a salon selling retail hair product AND performing services) can
  mix both in one sale, without a whole-business mode switch.

  - item_type: 'goods' (default, preserves existing behavior) | 'service'.
  - service_type describes how a service's price was quoted (flat /
    hourly / per-session) — purely descriptive. The existing quantity
    column already carries the multiplier (hours worked, sessions sold)
    against selling_price, so no separate duration column is needed:
    selling_price * quantity already produces the correct total via the
    existing sale-math, just with quantity relabeled contextually in the
    UI ("Hours"/"Sessions") rather than meaning stock units.
  - staff_name: who performed the service, per line item — deliberately
    separate from sales.delivery_guy (goods-delivery-specific), since a
    hybrid sale can have both a delivery guy for a product and a staff
    member for a service in the same transaction.

  buying_price/vendor/quantity on sale_items are already nullable with no
  NOT NULL/CHECK constraint blocking a service row — this migration is
  purely additive.
*/

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'goods' CHECK (item_type IN ('goods', 'service')),
  ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IS NULL OR service_type IN ('flat', 'hourly', 'per_session')),
  ADD COLUMN IF NOT EXISTS staff_name text;

CREATE INDEX IF NOT EXISTS idx_sale_items_item_type ON public.sale_items(item_type) WHERE item_type = 'service';

-- New dropdown-managed list for "who performed the service", reusing
-- EnhancedDropdown's fully-generic type->table mechanism, identical shape
-- to user_delivery_guys/user_sellers.
CREATE TABLE IF NOT EXISTS public.user_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_staff_user_id ON public.user_staff(user_id);

ALTER TABLE public.user_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_staff FORCE ROW LEVEL SECURITY;

-- Mirrors user_delivery_guys/user_sellers' existing auth.uid()-only policy
-- shape exactly, for consistency with its sibling dropdown tables (neither
-- of those was migrated to the newer get_business_owner_id() team-accounts
-- shape either).
DROP POLICY IF EXISTS "user_staff_select" ON public.user_staff;
CREATE POLICY "user_staff_select" ON public.user_staff FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "user_staff_insert" ON public.user_staff;
CREATE POLICY "user_staff_insert" ON public.user_staff FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "user_staff_update" ON public.user_staff;
CREATE POLICY "user_staff_update" ON public.user_staff FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "user_staff_delete" ON public.user_staff;
CREATE POLICY "user_staff_delete" ON public.user_staff FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

NOTIFY pgrst, 'reload schema';
