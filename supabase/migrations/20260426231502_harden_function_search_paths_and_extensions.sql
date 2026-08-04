/*
  # Harden security warnings: function search_path, extension schema, audit_log RLS

  ## Why
  Supabase's database linter flagged three classes of issues:

  1. Several `public.*` trigger / helper functions have a mutable `search_path`,
     which means a malicious schema could shadow built-in functions when the
     trigger fires. We pin `search_path = public, pg_temp` on each.
  2. The `citext` extension is installed in the `public` schema. Best practice
     is to keep extensions out of `public`; we move it into a dedicated
     `extensions` schema. Existing columns/indexes that reference the `citext`
     type continue to work because PostgreSQL stores the type reference by OID.
  3. The `audit_log` INSERT policy used `WITH CHECK (true)`, which lets any
     authenticated user write arbitrary rows pretending to be anyone. We tighten
     it so a row can only be inserted with `user_id = auth.uid()`.

  ## Changes

  1. Functions hardened with `SET search_path = public, pg_temp`:
     - `inventory_items_sync_legacy_fields()`
     - `sales_sync_seller_fields()`
     - `sale_items_sync_vendor_fields()`
     - `ad_expenses_sync_aliases()`
     - `vendor_expenses_sync_aliases()`
     - `sales_vendor_payment_roll_down()`
     - `sale_items_vendor_payment_roll_up()`
     - `sale_items_decrement_inventory()`
     - `valid_username(text)`

  2. Extensions:
     - Create schema `extensions` (if not exists).
     - `ALTER EXTENSION citext SET SCHEMA extensions`.
     - Grant `USAGE` on the new schema to `authenticated`, `anon`, `service_role`
       so existing queries continue to resolve the `citext` type.

  3. `public.audit_log`:
     - Drop the unrestricted `"System can insert audit log"` INSERT policy.
     - Replace it with an INSERT policy that only allows authenticated users to
       insert rows where `user_id = auth.uid()`. The existing admin SELECT
       policy is untouched.

  ## Notes
  - No data is dropped.
  - All function bodies are preserved verbatim; only the `SET search_path`
    clause is added.
*/

-- 1. Pin search_path on each flagged function
ALTER FUNCTION public.inventory_items_sync_legacy_fields() SET search_path = public, pg_temp;
ALTER FUNCTION public.sales_sync_seller_fields()           SET search_path = public, pg_temp;
ALTER FUNCTION public.sale_items_sync_vendor_fields()      SET search_path = public, pg_temp;
ALTER FUNCTION public.ad_expenses_sync_aliases()           SET search_path = public, pg_temp;
ALTER FUNCTION public.vendor_expenses_sync_aliases()       SET search_path = public, pg_temp;
ALTER FUNCTION public.sales_vendor_payment_roll_down()     SET search_path = public, pg_temp;
ALTER FUNCTION public.sale_items_vendor_payment_roll_up()  SET search_path = public, pg_temp;
ALTER FUNCTION public.sale_items_decrement_inventory()     SET search_path = public, pg_temp;
ALTER FUNCTION public.valid_username(text)                 SET search_path = public, pg_temp;

-- 2. Move citext out of public into a dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'citext' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION citext SET SCHEMA extensions';
  END IF;
END $$;

-- 3. Tighten audit_log INSERT policy: drop permissive, add ownership check
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

CREATE POLICY "Users can insert own audit entries"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
