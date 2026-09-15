/*
  # Team / staff accounts (per-section permissions)

  ## Model
  A business is still identified by its owner's auth.uid() everywhere in
  the schema — nothing about existing ownership columns changes. What's new
  is `business_members`: rows that say "this other auth user is staff on
  my business, with these section permissions." get_business_owner_id()
  resolves "whose business am I acting on" for the current caller — for an
  owner (no membership row) that's just their own uid, so every existing
  account's behavior is byte-for-byte unchanged by this migration. Only
  accounts that get invited as staff see anything different.

  has_permission(section) is the gate: true unconditionally for an owner,
  true for staff only if that section is in their granted permissions list.

  ## Why a trigger instead of touching every insert call site
  Every service in the app inserts rows with `user_id: currentUser.id` (the
  raw session id). Rewriting ~20 call sites to resolve the business owner
  first would be a huge, error-prone diff. Instead, a BEFORE INSERT trigger
  on each covered table overwrites user_id/created_by with
  get_business_owner_id() regardless of what was sent — for an owner this
  is a no-op (get_business_owner_id() = their own uid already), for staff
  it transparently redirects the new row onto their employer's business.
  Existing application code needs zero changes.

  ## Covered tables
  customers, sales, sale_items, suppliers, ad_expenses, vendor_expenses,
  general_expenses, documents, document_items, inventory_items — the
  operational data a staff member would plausibly need section access to.
  Personal/productivity tables (business_goals, business_tasks,
  notifications, notification_preferences, dashboard_preferences) are
  deliberately left untouched and stay owner-only for this first version.

  ## Invite flow
  Owner creates a `business_members` row with an invited_email and a
  permissions array (status='pending', member_id=NULL). claim_pending_invite()
  is called client-side once per login/signup; it links member_id to the
  caller's own uid if their auth email matches a pending invite. It's
  SECURITY DEFINER because it must read auth.users.email and update a row
  the caller doesn't own yet — but it only ever touches rows matching the
  caller's own verified email, so this can't be used to claim someone
  else's invite.
*/

CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  permissions text[] NOT NULL DEFAULT '{}',
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_members_no_self_invite CHECK (member_id IS DISTINCT FROM owner_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_members_owner_email
  ON public.business_members(owner_id, lower(invited_email)) WHERE status <> 'revoked';
CREATE INDEX IF NOT EXISTS idx_business_members_member ON public.business_members(member_id) WHERE status = 'active';

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_members_select" ON public.business_members;
CREATE POLICY "business_members_select" ON public.business_members FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR member_id = auth.uid());
DROP POLICY IF EXISTS "business_members_insert" ON public.business_members;
CREATE POLICY "business_members_insert" ON public.business_members FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "business_members_update" ON public.business_members;
CREATE POLICY "business_members_update" ON public.business_members FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "business_members_delete" ON public.business_members;
CREATE POLICY "business_members_delete" ON public.business_members FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_business_owner_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.business_members WHERE member_id = auth.uid() AND status = 'active' LIMIT 1),
    auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.get_business_owner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_owner_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_permission(p_section text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.business_members WHERE member_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members
    WHERE member_id = auth.uid() AND status = 'active' AND p_section = ANY(permissions)
  );
$$;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_pending_invite()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.business_members
  SET member_id = auth.uid(), status = 'active', accepted_at = now()
  WHERE lower(invited_email) = lower(v_email) AND status = 'pending' AND member_id IS NULL
  RETURNING owner_id INTO v_owner_id;

  RETURN v_owner_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_pending_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_invite() TO authenticated;

-- Ownership-stamping trigger: transparently redirects new rows from staff
-- onto their employer's business without any application code changes.
CREATE OR REPLACE FUNCTION public.stamp_business_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('ad_expenses', 'vendor_expenses') THEN
    NEW.created_by := public.get_business_owner_id();
  ELSE
    NEW.user_id := public.get_business_owner_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','sales','sale_items','suppliers','ad_expenses','vendor_expenses','general_expenses','documents','document_items','inventory_items']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_business_owner ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_stamp_business_owner BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner()', t);
  END LOOP;
END $$;

-- Replace ownership-scoped RLS with owner+permission-scoped RLS on every
-- covered table. Old policy names captured live from pg_policies before
-- writing this migration so nothing stale is left behind.

-- customers (section: customers)
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('customers'));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('customers'));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('customers'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('customers'));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('customers'));

-- sales (section: sales)
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "Users can update own data" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_select" ON public.sales FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'));

-- sale_items (section: sales)
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update" ON public.sale_items;
DROP POLICY IF EXISTS "Users can update own data" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sale_items_insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sale_items_update" ON public.sale_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales'));
CREATE POLICY "sale_items_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales'));

-- suppliers (section: suppliers)
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update own data" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('suppliers'));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('suppliers'));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('suppliers'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('suppliers'));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('suppliers'));

-- ad_expenses (section: expenses, ownership column: created_by)
DROP POLICY IF EXISTS "ad_expenses_select" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses select own or admin" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses_insert" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses insert own" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses_update" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses update own or admin" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses_delete" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses delete own or admin" ON public.ad_expenses;
CREATE POLICY "ad_expenses_select" ON public.ad_expenses FOR SELECT TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "ad_expenses_insert" ON public.ad_expenses FOR INSERT TO authenticated
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "ad_expenses_update" ON public.ad_expenses FOR UPDATE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'))
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "ad_expenses_delete" ON public.ad_expenses FOR DELETE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));

-- vendor_expenses (section: expenses, ownership column: created_by)
DROP POLICY IF EXISTS "vendor_expenses_select" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses select own or admin" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses_insert" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses insert own" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses_update" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses update own or admin" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses_delete" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses delete own or admin" ON public.vendor_expenses;
CREATE POLICY "vendor_expenses_select" ON public.vendor_expenses FOR SELECT TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "vendor_expenses_insert" ON public.vendor_expenses FOR INSERT TO authenticated
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "vendor_expenses_update" ON public.vendor_expenses FOR UPDATE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'))
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "vendor_expenses_delete" ON public.vendor_expenses FOR DELETE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses'));

-- general_expenses (section: expenses)
DROP POLICY IF EXISTS "general_expenses_select" ON public.general_expenses;
DROP POLICY IF EXISTS "general_expenses_insert" ON public.general_expenses;
DROP POLICY IF EXISTS "general_expenses_update" ON public.general_expenses;
DROP POLICY IF EXISTS "Users can update own data" ON public.general_expenses;
DROP POLICY IF EXISTS "general_expenses_delete" ON public.general_expenses;
CREATE POLICY "general_expenses_select" ON public.general_expenses FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "general_expenses_insert" ON public.general_expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "general_expenses_update" ON public.general_expenses FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
CREATE POLICY "general_expenses_delete" ON public.general_expenses FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));

-- documents (section: documents)
DROP POLICY IF EXISTS "select_own_documents" ON public.documents;
DROP POLICY IF EXISTS "insert_own_documents" ON public.documents;
DROP POLICY IF EXISTS "update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "delete_own_documents" ON public.documents;
CREATE POLICY "select_own_documents" ON public.documents FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "insert_own_documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "update_own_documents" ON public.documents FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "delete_own_documents" ON public.documents FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'));

-- document_items (section: documents)
DROP POLICY IF EXISTS "select_own_document_items" ON public.document_items;
DROP POLICY IF EXISTS "insert_own_document_items" ON public.document_items;
DROP POLICY IF EXISTS "update_own_document_items" ON public.document_items;
DROP POLICY IF EXISTS "delete_own_document_items" ON public.document_items;
CREATE POLICY "select_own_document_items" ON public.document_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "insert_own_document_items" ON public.document_items FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "update_own_document_items" ON public.document_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
CREATE POLICY "delete_own_document_items" ON public.document_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents'));

-- inventory_items (section: inventory)
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update own data" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('inventory'));
CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('inventory'));
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('inventory'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('inventory'));
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('inventory'));
