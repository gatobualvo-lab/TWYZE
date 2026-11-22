/*
  # Event planning module

  ## Why
  Reuses Projects rather than building a parallel system: a project already has a budget,
  a client, and aggregates its own invoices/quotations and expenses
  (20260827120000_projects.sql, get_project_summary()). An event (wedding, corporate
  function, birthday, conference) is that same shape plus a date, a type and a guest
  count — so this adds those as nullable columns on `projects` instead of a new table.

  ## Timeline / checklist
  business_tasks gets the same nullable project_id FK already used on documents,
  general_expenses, ad_expenses and vendor_expenses, so an event's planning checklist
  (book venue, confirm catering, send invitations, ...) is just business_tasks scoped to
  its project_id — reusing due dates, reminders and the reminder emails that already exist
  for tasks, rather than building a second task system.
*/

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS guest_count integer;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_kind_chk;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_project_kind_chk CHECK (project_kind IN ('general', 'event'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_event_type_chk;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_event_type_chk
  CHECK (event_type IS NULL OR event_type IN ('wedding', 'corporate', 'birthday', 'conference', 'other'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_guest_count_chk;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_guest_count_chk CHECK (guest_count IS NULL OR guest_count >= 0);

ALTER TABLE public.business_tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_tasks_project_id ON public.business_tasks(project_id) WHERE project_id IS NOT NULL;
