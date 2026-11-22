/*
  # Standalone Events module: tickets, guests, sponsors

  Events (projects with project_kind='event') are getting their own page instead of
  living inside Projects. Three of the production gaps this closes need no new tables —
  business_tasks (already has due_time, for run-of-show) and vendor_expenses (already
  has is_cleared/cleared_at, for deposit schedules) are reused as-is. This migration adds
  what's genuinely missing:

  1. inventory_items.project_id — a ticket tier IS a product (price = selling_price,
     capacity = current_stock, decrements on sale exactly like any other product); this
     is the same nullable, additive project_id FK already on documents/recurring_invoices/
     general_expenses/ad_expenses/vendor_expenses/sales/business_tasks.
  2. event_guests — a named guest/RSVP list (a headcount alone can't track who's coming).
  3. event_sponsors — package name, amount, deliverables owed, fulfilled flag, with an
     optional link to the actual invoice (a Document) once one exists.

  Both new tables copy projects' exact RLS shape and trigger (20260827120000_projects.sql).
*/

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_project_id ON public.inventory_items(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size >= 1),
  rsvp_status text NOT NULL DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'confirmed', 'declined', 'attended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_guests_project_id ON public.event_guests(project_id);

ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_guests_select" ON public.event_guests;
CREATE POLICY "event_guests_select" ON public.event_guests FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
DROP POLICY IF EXISTS "event_guests_insert" ON public.event_guests;
CREATE POLICY "event_guests_insert" ON public.event_guests FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('documents'));
DROP POLICY IF EXISTS "event_guests_update" ON public.event_guests;
CREATE POLICY "event_guests_update" ON public.event_guests FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
DROP POLICY IF EXISTS "event_guests_delete" ON public.event_guests;
CREATE POLICY "event_guests_delete" ON public.event_guests FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

DROP TRIGGER IF EXISTS trg_stamp_business_owner_event_guests ON public.event_guests;
CREATE TRIGGER trg_stamp_business_owner_event_guests BEFORE INSERT ON public.event_guests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner();

-- Table-specific updated_at trigger function, matching the existing convention
-- (e.g. set_customers_updated_at()) rather than assuming a shared one exists.
CREATE OR REPLACE FUNCTION public.set_event_guests_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_guests_updated_at ON public.event_guests;
CREATE TRIGGER trg_event_guests_updated_at BEFORE UPDATE ON public.event_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_event_guests_updated_at();

CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sponsor_name text NOT NULL,
  package_label text,
  amount numeric,
  deliverables text,
  fulfilled boolean NOT NULL DEFAULT false,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_sponsors_project_id ON public.event_sponsors(project_id);

ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sponsors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sponsors_select" ON public.event_sponsors;
CREATE POLICY "event_sponsors_select" ON public.event_sponsors FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()));
DROP POLICY IF EXISTS "event_sponsors_insert" ON public.event_sponsors;
CREATE POLICY "event_sponsors_insert" ON public.event_sponsors FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('documents'));
DROP POLICY IF EXISTS "event_sponsors_update" ON public.event_sponsors;
CREATE POLICY "event_sponsors_update" ON public.event_sponsors FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('documents')
         AND (NOT public.restricts_to_own_records() OR entered_by = auth.uid()))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('documents'));
DROP POLICY IF EXISTS "event_sponsors_delete" ON public.event_sponsors;
CREATE POLICY "event_sponsors_delete" ON public.event_sponsors FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND auth.uid() = public.get_business_owner_id());

DROP TRIGGER IF EXISTS trg_stamp_business_owner_event_sponsors ON public.event_sponsors;
CREATE TRIGGER trg_stamp_business_owner_event_sponsors BEFORE INSERT ON public.event_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner();

CREATE OR REPLACE FUNCTION public.set_event_sponsors_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_sponsors_updated_at ON public.event_sponsors;
CREATE TRIGGER trg_event_sponsors_updated_at BEFORE UPDATE ON public.event_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.set_event_sponsors_updated_at();

NOTIFY pgrst, 'reload schema';
