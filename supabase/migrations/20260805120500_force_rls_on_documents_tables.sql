/*
  # Force RLS on the documents/tasks/settings tables

  ## Why
  The May 2026 hardening pass (20260508142520) added FORCE ROW LEVEL
  SECURITY across the schema, but business_settings, documents,
  document_items, business_tasks, and dashboard_preferences were created
  afterward (20260625232156) with only ENABLE ROW LEVEL SECURITY. Policies
  on these tables are correct and this doesn't affect normal
  anon/authenticated access via PostgREST — FORCE only matters for a
  table-owner-privileged connection, which is what the rest of the schema
  is already hardened against. This closes that gap for consistency.
*/

ALTER TABLE public.business_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.document_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences FORCE ROW LEVEL SECURITY;
