/*
  # Business Goals

  ## Why a new table
  business_tasks already exists (a simple to-do list, shown on the
  dashboard) but that's checkbox-based, not target-based — there's nowhere
  to say "hit KES 100,000 revenue this month" and track progress against
  it. This is a genuinely new concept, not a duplicate of business_tasks.

  ## Design
  Not a fixed enum of goal types — metric_type covers the targets the
  metrics engine can compute progress for automatically (revenue, profit,
  sales_count, expense_cap), plus 'custom' for anything else (e.g. "sign up
  5 wholesale customers") where the owner updates progress by hand via
  manual_current_value. Progress for the automatic types is always computed
  live from get_business_metrics — never stored/duplicated — so it can
  never drift from the real numbers.
*/

CREATE TABLE IF NOT EXISTS public.business_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('revenue', 'profit', 'sales_count', 'expense_cap', 'custom')),
  target_value numeric NOT NULL CHECK (target_value > 0),
  manual_current_value numeric, -- only used/updated when metric_type = 'custom'
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_goals_user ON public.business_goals(user_id, status, period_end);

ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_goals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_goals_select" ON public.business_goals;
CREATE POLICY "business_goals_select" ON public.business_goals FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "business_goals_insert" ON public.business_goals;
CREATE POLICY "business_goals_insert" ON public.business_goals FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "business_goals_update" ON public.business_goals;
CREATE POLICY "business_goals_update" ON public.business_goals FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "business_goals_delete" ON public.business_goals;
CREATE POLICY "business_goals_delete" ON public.business_goals FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.set_business_goals_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_goals_updated_at ON public.business_goals;
CREATE TRIGGER trg_business_goals_updated_at BEFORE UPDATE ON public.business_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_business_goals_updated_at();
