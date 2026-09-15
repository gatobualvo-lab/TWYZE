/*
  # Recurring expenses

  ## Why a client-triggered function, not a cron job
  Same constraint as the notification engine: no Edge Function/cron
  infrastructure exists in this project. run_due_recurring_expenses() is
  called once per session (Dashboard mount) and generates any general_expenses
  rows that came due since the last time someone opened the app. A bounded
  catch-up loop (max 24 periods) means an owner who hasn't opened the app in
  months still gets their missed rent/salary expenses backfilled, without
  risking runaway generation from a data problem.

  ## Ownership and permissions
  Reuses get_business_owner_id()/has_permission('expenses') from the team
  accounts migration — a recurring expense template is expense-adjacent, so
  staff with expenses access can manage it too. The generated
  general_expenses rows go through that table's own existing RLS/trigger,
  unchanged.
*/

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  expense_type text NOT NULL DEFAULT 'General',
  amount numeric NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 28),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  next_run_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expenses_schedule_check CHECK (
    (frequency = 'monthly' AND day_of_month IS NOT NULL AND day_of_week IS NULL) OR
    (frequency = 'weekly' AND day_of_week IS NOT NULL AND day_of_month IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_due ON public.recurring_expenses(user_id, is_active, next_run_date);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_expenses_select" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_select" ON public.recurring_expenses FOR SELECT TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
DROP POLICY IF EXISTS "recurring_expenses_insert" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_insert" ON public.recurring_expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
DROP POLICY IF EXISTS "recurring_expenses_update" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_update" ON public.recurring_expenses FOR UPDATE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'))
  WITH CHECK (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));
DROP POLICY IF EXISTS "recurring_expenses_delete" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_delete" ON public.recurring_expenses FOR DELETE TO authenticated
  USING (user_id = public.get_business_owner_id() AND public.has_permission('expenses'));

DROP TRIGGER IF EXISTS trg_stamp_business_owner ON public.recurring_expenses;
CREATE TRIGGER trg_stamp_business_owner BEFORE INSERT ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_owner();

CREATE OR REPLACE FUNCTION public.run_due_recurring_expenses()
RETURNS int
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_next date;
  v_safety int;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_expenses
    WHERE user_id = public.get_business_owner_id() AND is_active = true AND next_run_date <= CURRENT_DATE
  LOOP
    v_next := r.next_run_date;
    v_safety := 0;
    WHILE v_next <= CURRENT_DATE AND v_safety < 24 LOOP
      INSERT INTO public.general_expenses (user_id, description, expense_type, amount, date, notes)
      VALUES (r.user_id, r.description, r.expense_type, r.amount, v_next, 'Auto-generated from a recurring expense');

      v_count := v_count + 1;
      v_next := CASE WHEN r.frequency = 'monthly' THEN (v_next + interval '1 month')::date ELSE (v_next + interval '7 days')::date END;
      v_safety := v_safety + 1;
    END LOOP;

    UPDATE public.recurring_expenses SET next_run_date = v_next WHERE id = r.id;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_due_recurring_expenses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_due_recurring_expenses() TO authenticated;
