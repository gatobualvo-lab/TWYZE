/*
  # TrackWyze Guide feedback (thumbs up / down on answers)

  One row per rating, so the team can see which questions the Guide answers badly and fix what it
  knows. A row holds the question, the start of the answer, the page and the plan. It holds no business
  data (the Guide never sees any).

  - A signed-in person can add rows for themselves only. Nobody but an admin can read them.
  - Rows older than 90 days are removed whenever a new one is added, so questions are not kept for good.
*/

CREATE TABLE IF NOT EXISTS public.guide_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  question text NOT NULL CHECK (char_length(question) <= 500),
  answer text NOT NULL CHECK (char_length(answer) <= 1200),
  page text CHECK (page IS NULL OR char_length(page) <= 60),
  tier text CHECK (tier IS NULL OR char_length(tier) <= 20),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guide_feedback_created_at_idx ON public.guide_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS guide_feedback_rating_idx ON public.guide_feedback (rating, created_at DESC);

ALTER TABLE public.guide_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guide_feedback_insert_own" ON public.guide_feedback;
CREATE POLICY "guide_feedback_insert_own" ON public.guide_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "guide_feedback_admin_read" ON public.guide_feedback;
CREATE POLICY "guide_feedback_admin_read" ON public.guide_feedback
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

REVOKE ALL ON public.guide_feedback FROM anon;
GRANT INSERT ON public.guide_feedback TO authenticated;
GRANT SELECT ON public.guide_feedback TO authenticated; -- still limited to admins by the policy above

-- Keeps only the last 90 days, without needing a scheduled job.
CREATE OR REPLACE FUNCTION public.trim_guide_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  DELETE FROM public.guide_feedback WHERE created_at < now() - interval '90 days';
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS guide_feedback_trim ON public.guide_feedback;
CREATE TRIGGER guide_feedback_trim
  AFTER INSERT ON public.guide_feedback
  FOR EACH STATEMENT EXECUTE FUNCTION public.trim_guide_feedback();
