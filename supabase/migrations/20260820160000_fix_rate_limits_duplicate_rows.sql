/*
  # Fix rate_limits missing unique constraint

  ## Why
  public.rate_limits (added in 20260508142520) only ever had a plain index
  on (bucket_key, action, window_start), not a UNIQUE constraint. But
  check_rate_limit() relies on `INSERT ... ON CONFLICT DO NOTHING` to avoid
  creating a second row for a bucket/window that already has one — with no
  unique constraint to actually conflict against, every call just inserted
  a fresh duplicate row instead. Once 2+ rows exist for the same
  bucket/action/window, the function's `UPDATE ... RETURNING count INTO
  v_count` (and its SELECT INTO fallback) both fail with Postgres error
  P0003 "query returned more than one row", since both expect exactly one
  row.

  This was silently happening for every rate-limited action already in
  production (sale.create, vendor_expense.create, ad_expense.create, auth
  actions) — invisibly, because the existing client-side checkRateLimit()
  helper (src/utils/security.ts) fails OPEN on any RPC error, so a broken
  rate-limit check just silently allowed the request through with a
  console.warn nobody was likely watching. It surfaced now because the new
  AI Business Assistant's server-side rate-limit check deliberately fails
  CLOSED (guarding a metered paid API), which turned the same latent bug
  into a visible, blocking error.

  ## Changes
  1. Deduplicate existing rows: for any (bucket_key, action, window_start)
     group with more than one row, merge them into a single row whose
     count is the SUM of the group (the true total request count), then
     delete the rest.
  2. Add a real UNIQUE constraint on (bucket_key, action, window_start) so
     ON CONFLICT DO NOTHING has something to actually conflict against,
     and this class of bug can't recur.
*/

-- 1) Merge duplicates: sum counts into the earliest-created row per group.
WITH ranked AS (
  SELECT
    id,
    bucket_key,
    action,
    window_start,
    count,
    ROW_NUMBER() OVER (PARTITION BY bucket_key, action, window_start ORDER BY created_at ASC, id ASC) AS rn,
    SUM(count) OVER (PARTITION BY bucket_key, action, window_start) AS total_count
  FROM public.rate_limits
),
to_update AS (
  SELECT id, total_count FROM ranked WHERE rn = 1
)
UPDATE public.rate_limits r
SET count = to_update.total_count, updated_at = now()
FROM to_update
WHERE r.id = to_update.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY bucket_key, action, window_start ORDER BY created_at ASC, id ASC) AS rn
  FROM public.rate_limits
)
DELETE FROM public.rate_limits
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Prevent it from ever happening again.
ALTER TABLE public.rate_limits
  ADD CONSTRAINT rate_limits_bucket_action_window_key UNIQUE (bucket_key, action, window_start);

-- The old non-unique index is now redundant with the constraint's own index.
DROP INDEX IF EXISTS public.rate_limits_bucket_action_idx;
