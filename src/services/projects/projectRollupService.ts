import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import { listProjects, type Project } from './projectService';

// get_project_summary only returns projects that actually have at least one
// invoice or expense attached (it's built from two CTEs joined on
// project_id) — a brand-new project with nothing logged against it yet
// won't appear there, so the project list itself is fetched separately and
// merged in, defaulting invoiced/spent to 0 for anything the RPC didn't
// return a row for.

export interface ProjectSummary extends Project {
  invoicedTotal: number;
  spentTotal: number;
  remainingBudget: number | null;
}

export async function fetchProjectSummaries(): Promise<ProjectSummary[]> {
  const [projects, summaryRes] = await Promise.all([
    listProjects(),
    supabase.rpc('get_project_summary'),
  ]);

  const summaryByProjectId = new Map<string, { invoicedTotal: number; spentTotal: number }>();
  for (const row of summaryRes.data ?? []) {
    summaryByProjectId.set(row.project_id, {
      invoicedTotal: toNum(row.invoiced_total),
      spentTotal: toNum(row.spent_total),
    });
  }

  return projects.map(project => {
    const summary = summaryByProjectId.get(project.id) ?? { invoicedTotal: 0, spentTotal: 0 };
    return {
      ...project,
      invoicedTotal: summary.invoicedTotal,
      spentTotal: summary.spentTotal,
      remainingBudget: project.budget == null ? null : project.budget - summary.spentTotal,
    };
  });
}
