/*
  # Email alerts: per-user opt-in + admin broadcast log

  ## Why
  Two new email paths are being added in this change:
  - Opportunity-alert emails (low stock, overdue invoices) piggyback on the
    existing notification engine (see notificationSync.ts) — this just adds
    the per-user "also email me" toggle alongside the existing
    min_priority/muted_types preferences.
  - An admin broadcast tool needs somewhere to log what was sent, to whom,
    and when. The actual send happens from an Edge Function using the
    service-role key (so it can see every user's email regardless of RLS);
    the log row is written afterwards by the admin's own authenticated
    client, so it only needs an admin-gated insert/select policy.
*/

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all', 'active', 'trial', 'expired')),
  recipient_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_broadcasts_created_at ON public.email_broadcasts(created_at DESC);

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_broadcasts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_broadcasts_select" ON public.email_broadcasts;
CREATE POLICY "email_broadcasts_select" ON public.email_broadcasts FOR SELECT TO authenticated
  USING (check_user_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "email_broadcasts_insert" ON public.email_broadcasts;
CREATE POLICY "email_broadcasts_insert" ON public.email_broadcasts FOR INSERT TO authenticated
  WITH CHECK (check_user_role(auth.uid(), 'admin') AND created_by = auth.uid());
