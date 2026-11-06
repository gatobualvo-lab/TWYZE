/*
  # Fold "Report a problem" into feature_feedback instead of a parallel table

  This migration originally created a standalone support_requests table, shipped in the same
  session, never applied to production (confirmed live: a real submission against this project
  failed with "relation does not exist" right after the earlier version of this file was handed
  over). A same-session code review flagged that table as a near-duplicate of the existing
  feature_feedback table and admin UI — same shape, same RLS, a second admin page to maintain,
  no shared pagination. Since nothing was ever written to it, the cleanest fix is to never create
  it: add a `problem` category to feature_feedback instead, and drop the table defensively in
  case this file's earlier version was already run.

  Also closes a real gap the same review found: feature_feedback's insert policy had no
  server-side rate limit at all — only the best-effort admin-notification email was throttled,
  so a client that skipped the UI (or the email call) entirely could insert unlimited rows. The
  insert policy now calls the existing check_rate_limit() helper (already used from Edge
  Functions, never before from an RLS policy) directly in WITH CHECK, so the limit holds however
  the row gets inserted.
*/

DROP TABLE IF EXISTS public.support_requests;

-- Add 'problem' to the category check, whatever its auto-generated name actually is.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT pgc.conname
    FROM pg_constraint pgc
    JOIN pg_class rel ON rel.oid = pgc.conrelid
    WHERE rel.relname = 'feature_feedback'
      AND pgc.contype = 'c'
      AND pg_get_constraintdef(pgc.oid) LIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.feature_feedback DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.feature_feedback
  ADD CONSTRAINT feature_feedback_category_check CHECK (category IN ('feature', 'bug', 'general', 'problem'));

-- Rate-limit inserts at the RLS layer: 20 submissions/hour/person, enforced however the row
-- gets written (UI, a direct client call, anything), not just when the app's own code path runs.
DROP POLICY IF EXISTS "feature_feedback_insert_own" ON public.feature_feedback;
CREATE POLICY "feature_feedback_insert_own" ON public.feature_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.check_rate_limit('feature_feedback.insert', 20, 3600, NULL)
  );
