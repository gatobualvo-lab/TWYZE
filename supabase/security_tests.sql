-- Trackwyze security tests
-- Run these manually in the Supabase SQL editor (anon/authenticated roles).
-- Each block documents the expected outcome.

-- ============================================================
-- 1) Anonymous users cannot read private tables
-- ============================================================
-- As role anon:
--   SELECT count(*) FROM public.sales;               -- expect 0
--   SELECT count(*) FROM public.vendor_expenses;     -- expect 0
--   SELECT count(*) FROM public.ad_expenses;         -- expect 0
--   SELECT count(*) FROM public.inventory_items;     -- expect 0
--   SELECT count(*) FROM public.profiles;            -- expect 0

-- ============================================================
-- 2) User A cannot see / mutate User B's rows
-- ============================================================
-- Login as User A, insert a sale, note its id.
-- Login as User B and run:
--   SELECT * FROM public.sales WHERE id = '<A_sale_id>';     -- expect 0 rows
--   UPDATE public.sales SET selling_price = 0
--     WHERE id = '<A_sale_id>' RETURNING id;                 -- expect 0 rows
--   DELETE FROM public.sales
--     WHERE id = '<A_sale_id>' RETURNING id;                 -- expect 0 rows

-- User B tries to insert a row pivoted to User A:
--   INSERT INTO public.sales (id, user_id, product_name)
--   VALUES (gen_random_uuid(), '<A_user_id>', 'hack');
--   -- expect: new row violates row-level security policy

-- ============================================================
-- 3) WITH CHECK blocks pivoting on UPDATE
-- ============================================================
-- As User A, attempt to change ownership of your own row to User B:
--   UPDATE public.sales SET user_id = '<B_user_id>'
--     WHERE id = '<A_sale_id>' RETURNING id;
--   -- expect: new row violates row-level security policy

-- ============================================================
-- 4) Non-admin cannot access admin-only data
-- ============================================================
-- As a regular authenticated user:
--   SELECT count(*) FROM public.audit_log;      -- expect 0
--   SELECT count(*) FROM public.rate_limits;    -- expect 0 (admin only)

-- ============================================================
-- 5) Storage IDOR protection
-- ============================================================
-- Upload a file as User A to path `<A_user_id>/secret.pdf`.
-- As User B, attempt to download `<A_user_id>/secret.pdf` ->
--   expect: 400/403 "new row violates" or object not found.
-- User B uploading to `<A_user_id>/evil.pdf` -> expect RLS rejection.

-- ============================================================
-- 6) Rate limiting
-- ============================================================
-- Call check_rate_limit rapidly as one user:
--   SELECT public.check_rate_limit('auth.login', 3, 60, NULL); -- run 5x
--   -- expect: first 3 return true, then false

-- ============================================================
-- Diagnostics: list every public policy
-- ============================================================
-- SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies WHERE schemaname='public' ORDER BY tablename, cmd;

-- Verify RLS is enabled on every public table:
-- SELECT tablename FROM pg_tables
--   WHERE schemaname='public' AND rowsecurity = false;  -- expect 0 rows
