/*
  # Shared notification engine

  ## Why
  Multiple planned features (Opportunity Center, Smart Inventory, Business
  Goals) all need to tell the user "something needs attention." Without a
  shared table, each would build its own read/unread/dismiss logic. This is
  one table + one service every feature publishes into.

  ## Generation model
  There's no cron/Edge Function infrastructure in this project (confirmed
  during architecture review — everything is client-triggered). Rather than
  add that infrastructure now, notifications are generated opportunistically
  client-side (e.g. when the dashboard loads) and upserted with a dedupe key
  so re-running the same check doesn't create duplicates. This is a real
  tradeoff — notifications only appear when someone has the app open, not
  the instant a condition becomes true — noted here rather than hidden.

  ## Spam prevention
  `dedupe_key` + a unique index means the same logical condition (e.g. "this
  product is low on stock") can only ever have one open notification row.
  Callers that want a condition to re-notify periodically (not just once
  ever) bake a coarse time bucket into the key themselves, e.g.
  `low_stock:{product_id}:{year}-{month}`.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  action_tab text,
  dedupe_key text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe ON public.notifications(user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_archived, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- User-level notification preferences (frequency controls / per-type mute).
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_types text[] NOT NULL DEFAULT '{}',
  min_priority text NOT NULL DEFAULT 'low' CHECK (min_priority IN ('low', 'medium', 'high', 'critical')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_prefs_select" ON public.notification_preferences;
CREATE POLICY "notification_prefs_select" ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "notification_prefs_upsert" ON public.notification_preferences;
CREATE POLICY "notification_prefs_upsert" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "notification_prefs_update" ON public.notification_preferences;
CREATE POLICY "notification_prefs_update" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
