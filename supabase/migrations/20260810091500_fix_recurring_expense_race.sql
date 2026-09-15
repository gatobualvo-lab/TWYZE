/*
  # Fix a race condition in run_due_recurring_expenses()

  Two concurrent calls (e.g. React 18 double-invoking the mount effect in
  dev, or the app open in two tabs) could both read the same recurring
  expense row before either committed its next_run_date update, generating
  the same expense twice. `FOR UPDATE` locks each row for the duration of
  the transaction so a second concurrent call blocks until the first
  commits, then sees the already-advanced next_run_date and correctly does
  nothing.
*/

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
    ORDER BY id
    FOR UPDATE
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
