import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import { listProjects, listEvents, type Project } from './projectService';

// get_project_summary only returns projects that actually have at least one
// invoice or expense attached (it's built from two CTEs joined on
// project_id) — a brand-new project with nothing logged against it yet
// won't appear there, so the project list itself is fetched separately and
// merged in, defaulting invoiced/spent to 0 for anything the RPC didn't
// return a row for.

export interface ProjectSummary extends Project {
  invoicedTotal: number;
  /** Revenue from the Sales module attributed to this project (e.g. ticket sales for an event). */
  salesTotal: number;
  spentTotal: number;
  remainingBudget: number | null;
}

// get_project_summary's generated return type doesn't know about sales_total yet
// (added in 20261122120000_event_ticket_sales.sql) until types are regenerated against
// the live schema.
interface ProjectSummaryRow {
  project_id: string;
  invoiced_total: number;
  sales_total: number;
  spent_total: number;
}

async function summarize(projects: Project[]): Promise<ProjectSummary[]> {
  const { data } = await supabase.rpc('get_project_summary');

  const summaryByProjectId = new Map<string, { invoicedTotal: number; salesTotal: number; spentTotal: number }>();
  for (const row of (data ?? []) as ProjectSummaryRow[]) {
    summaryByProjectId.set(row.project_id, {
      invoicedTotal: toNum(row.invoiced_total),
      salesTotal: toNum(row.sales_total),
      spentTotal: toNum(row.spent_total),
    });
  }

  return projects.map(project => {
    const summary = summaryByProjectId.get(project.id) ?? { invoicedTotal: 0, salesTotal: 0, spentTotal: 0 };
    return {
      ...project,
      invoicedTotal: summary.invoicedTotal,
      salesTotal: summary.salesTotal,
      spentTotal: summary.spentTotal,
      remainingBudget: project.budget == null ? null : project.budget - summary.spentTotal,
    };
  });
}

export async function fetchProjectSummaries(): Promise<ProjectSummary[]> {
  return summarize(await listProjects());
}

/** Events (project_kind='event') only, with the same budget/sales/spend rollup — the standalone Events page. */
export async function fetchEventSummaries(): Promise<ProjectSummary[]> {
  return summarize(await listEvents());
}
