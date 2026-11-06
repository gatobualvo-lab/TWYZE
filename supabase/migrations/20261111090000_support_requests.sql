/*
  # Support requests (the Guide's "Report a problem" form)

  The in-app Guide previously only offered a WhatsApp link when it couldn't help. This adds a
  form-based alternative: a signed-in person describes their problem, it is saved here AND
  emailed to the team (send-support-request-email), and they can see its status. WhatsApp stays
  available alongside it — this does not replace that option, just adds a tracked one.

  Same shape and RLS as feature_feedback: a person can add and read their own rows; an admin can
  read and update every row.
*/

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  page text CHECK (page IS NULL OR char_length(page) <= 60),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_user_id_idx ON public.support_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON public.support_requests (status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_requests_insert_own" ON public.support_requests;
CREATE POLICY "support_requests_insert_own" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_requests_select_own_or_admin" ON public.support_requests;
CREATE POLICY "support_requests_select_own_or_admin" ON public.support_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "support_requests_admin_update" ON public.support_requests;
CREATE POLICY "support_requests_admin_update" ON public.support_requests
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

REVOKE ALL ON public.support_requests FROM anon;
GRANT INSERT, SELECT ON public.support_requests TO authenticated;
GRANT UPDATE ON public.support_requests TO authenticated; -- limited to admins by the policy above
