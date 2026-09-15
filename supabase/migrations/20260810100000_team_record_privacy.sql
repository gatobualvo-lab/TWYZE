/*
  # Per-staff record privacy: own-records-only, owner-only delete, entered-by tracking

  ## What this adds
  Two new per-team-member settings on business_members:
    - restrict_to_own_records: when true, that staff member's SELECT/UPDATE on
      every covered table is additionally scoped to rows THEY personally
      created, not the whole business's data within their granted sections.
    - hide_financial_details: read by the client to decide whether to show
      buying price/profit/margin figures. This is an application-layer
      signal, not a database-enforced column mask — see the migration this
      one's paired with in the app code for why a true column-level mask on
      the sales table was deliberately not built (it would require rewriting
      sales' entire read/write path behind a view with insert/update/delete
      triggers, on the single highest-traffic, highest-risk table in the
      schema, for a threat model — a staff member deliberately inspecting
      their own network requests — that the UI-level hide already closes for
      the realistic case).

  Plus: DELETE is now owner-only on every covered table, full stop — no
  staff member can delete a record regardless of their granted sections or
  own-records setting. And every covered table gains `entered_by`, stamped
  automatically by the same trigger that already redirects staff writes onto
  their employer's business, so the owner can always see who actually
  entered a given record (Team Management already lists members; this is
  the per-record half of that).

  ## Why DELETE ignores restrict_to_own_records entirely
  "Only entered_by = me" for DELETE would still let a staff member permanently
  destroy something they created — for financial and inventory records that's
  exactly the kind of action a business owner should be able to rely on
  staying reversible-by-them-only. Deletion is a strictly stronger permission
  than edit here, not a variant of it.
*/

ALTER TABLE public.business_members
  ADD COLUMN IF NOT EXISTS restrict_to_own_records boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_financial_details boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','sales','sale_items','suppliers','ad_expenses','vendor_expenses','general_expenses','documents','document_items','inventory_items','recurring_expenses']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);
  END LOOP;
END $$;

-- Stamp entered_by alongside the existing owner-redirect, on every table the
-- trigger already runs on — no new CREATE TRIGGER statements needed.
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
  NEW.entered_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restricts_to_own_records()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT restrict_to_own_records FROM public.business_members WHERE member_id = auth.uid() AND status = 'active' LIMIT 1),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.restricts_to_own_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restricts_to_own_records() TO authenticated;

-- customers (section: customers)
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('customers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('customers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('customers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- sales (section: sales)
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_select" ON public.sales FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- sale_items (section: sales)
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "sale_items_update" ON public.sale_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('sales') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "sale_items_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- suppliers (section: suppliers)
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('suppliers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('suppliers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('suppliers') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- ad_expenses (section: expenses, ownership column: created_by)
DROP POLICY IF EXISTS "ad_expenses_select" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses_update" ON public.ad_expenses;
DROP POLICY IF EXISTS "ad_expenses_delete" ON public.ad_expenses;
CREATE POLICY "ad_expenses_select" ON public.ad_expenses FOR SELECT TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "ad_expenses_update" ON public.ad_expenses FOR UPDATE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "ad_expenses_delete" ON public.ad_expenses FOR DELETE TO authenticated
  USING (created_by = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- vendor_expenses (section: expenses, ownership column: created_by)
DROP POLICY IF EXISTS "vendor_expenses_select" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses_update" ON public.vendor_expenses;
DROP POLICY IF EXISTS "vendor_expenses_delete" ON public.vendor_expenses;
CREATE POLICY "vendor_expenses_select" ON public.vendor_expenses FOR SELECT TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "vendor_expenses_update" ON public.vendor_expenses FOR UPDATE TO authenticated
  USING (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (created_by = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "vendor_expenses_delete" ON public.vendor_expenses FOR DELETE TO authenticated
  USING (created_by = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- general_expenses (section: expenses)
DROP POLICY IF EXISTS "general_expenses_select" ON public.general_expenses;
DROP POLICY IF EXISTS "general_expenses_update" ON public.general_expenses;
DROP POLICY IF EXISTS "general_expenses_delete" ON public.general_expenses;
CREATE POLICY "general_expenses_select" ON public.general_expenses FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "general_expenses_update" ON public.general_expenses FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "general_expenses_delete" ON public.general_expenses FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- documents (section: documents)
DROP POLICY IF EXISTS "select_own_documents" ON public.documents;
DROP POLICY IF EXISTS "update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "delete_own_documents" ON public.documents;
CREATE POLICY "select_own_documents" ON public.documents FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "update_own_documents" ON public.documents FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "delete_own_documents" ON public.documents FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- document_items (section: documents)
DROP POLICY IF EXISTS "select_own_document_items" ON public.document_items;
DROP POLICY IF EXISTS "update_own_document_items" ON public.document_items;
DROP POLICY IF EXISTS "delete_own_document_items" ON public.document_items;
CREATE POLICY "select_own_document_items" ON public.document_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "update_own_document_items" ON public.document_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "delete_own_document_items" ON public.document_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- inventory_items (section: inventory)
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('inventory') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('inventory') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('inventory') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

-- recurring_expenses (section: expenses)
DROP POLICY IF EXISTS "recurring_expenses_select" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_expenses_update" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_expenses_delete" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_select" ON public.recurring_expenses FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "recurring_expenses_update" ON public.recurring_expenses FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses') AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
CREATE POLICY "recurring_expenses_delete" ON public.recurring_expenses FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());
