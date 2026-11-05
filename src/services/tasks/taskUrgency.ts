import type { BusinessTask } from './taskService';
import { toISODate } from '../../utils/dateRange';

// Shared by every place that shows tasks in order of urgency: the Tasks page, the dashboard's
// Needs Attention box, and their tests. One definition of "overdue" so they can never disagree.

export type DueState = 'overdue' | 'today' | 'later' | 'none';

/** Whether an open task is late, due today, due later, or has no date. */
export function dueState(task: BusinessTask, today: string = toISODate(new Date())): DueState {
  if (task.completed || !task.dueDate) return 'none';
  if (task.dueDate < today) return 'overdue';
  return task.dueDate === today ? 'today' : 'later';
}

/** Open tasks first (soonest due first, undated last), finished ones after. */
export function sortTasks(tasks: BusinessTask[]): BusinessTask[] {
  const due = (t: BusinessTask) => (t.dueDate ? `${t.dueDate} ${t.dueTime ?? '99:99'}` : '9999');
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || due(a).localeCompare(due(b)));
}
