/*
  # Feature flags table

  ## Why
  The admin System Settings "Feature Flags" tab only ever toggled local React
  state — nothing was persisted, so every toggle was lost on refresh and had
  zero effect on the app. This gives it a real backing table.

  ## Changes
  1. Create `public.feature_flags` (key, name, description, enabled, timestamps,
     updated_by), seeded with the flags that were previously hardcoded in the
     client.
  2. RLS: any authenticated user can read (so app code can gate on flags later),
     only admins can insert/update/delete.
*/

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert feature flags" ON public.feature_flags;
CREATE POLICY "Admins can insert feature flags"
  ON public.feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update feature flags" ON public.feature_flags;
CREATE POLICY "Admins can update feature flags"
  ON public.feature_flags FOR UPDATE
  TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete feature flags" ON public.feature_flags;
CREATE POLICY "Admins can delete feature flags"
  ON public.feature_flags FOR DELETE
  TO authenticated
  USING (private.is_admin(auth.uid()));

INSERT INTO public.feature_flags (key, name, description, enabled)
VALUES
  ('multi_product_sales', 'Multi-product sales', 'Enable multi-product sales feature', true),
  ('inventory_management', 'Inventory management', 'Enable inventory management feature', true),
  ('email_notifications', 'Email notifications', 'Enable email notifications', false),
  ('sms_notifications', 'SMS notifications', 'Enable SMS notifications', false),
  ('vendor_expenses', 'Vendor expenses', 'Enable vendor expenses tracking', true)
ON CONFLICT (key) DO NOTHING;
