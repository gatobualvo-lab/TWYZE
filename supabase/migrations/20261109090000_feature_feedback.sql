/*
  # Feature feedback (the "Suggest a Feature" page)

  Lets a signed-in person suggest a feature, report a bug, or leave general feedback about the
  app, and see the status of what they've sent in before. Unlike guide_feedback (which is
  high-volume, low-value-per-row and trimmed after 90 days), these are read by the team as
  product backlog signal, so nothing is auto-deleted.

  - A signed-in person can add rows for themselves, and read (but not edit) their own rows.
  - An admin can read and update every row (to move it through its status).
*/

CREATE TABLE IF NOT EXISTS public.feature_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'feature' CHECK (category IN ('feature', 'bug', 'general')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  page text CHECK (page IS NULL OR char_length(page) <= 60),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'done', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_feedback_user_id_idx ON public.feature_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feature_feedback_status_idx ON public.feature_feedback (status, created_at DESC);

ALTER TABLE public.feature_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_feedback_insert_own" ON public.feature_feedback;
CREATE POLICY "feature_feedback_insert_own" ON public.feature_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "feature_feedback_select_own_or_admin" ON public.feature_feedback;
CREATE POLICY "feature_feedback_select_own_or_admin" ON public.feature_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "feature_feedback_admin_update" ON public.feature_feedback;
CREATE POLICY "feature_feedback_admin_update" ON public.feature_feedback
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

REVOKE ALL ON public.feature_feedback FROM anon;
GRANT INSERT, SELECT ON public.feature_feedback TO authenticated;
GRANT UPDATE ON public.feature_feedback TO authenticated; -- limited to admins by the policy above
