import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { listTasks, toggleTaskCompleted, type BusinessTask } from '../../services/tasks/taskService';
import { dueState } from '../../services/tasks/taskUrgency';
import { formatDueTime } from '../../services/tasks/reminders';
import { notifyTasksChanged, onTasksChanged } from '../../services/tasks/taskEvents';

export interface ConditionCounts {
  pendingDeliveries: number;
  lowStockItems: number;
  outstandingCustomers: number;
}

export type AttentionRow =
  | { id: string; kind: 'task'; task: BusinessTask; late: boolean }
  | { id: string; kind: 'condition'; label: string; dot: 'orange' | 'red' | 'amber'; tab: string };

/**
 * One prioritized list: overdue tasks first, then the three ongoing conditions (deliveries, stock,
 * customers — in the order the app has always shown them), then what's due today. Tasks due later, and
 * finished tasks, are not "needing attention" and stay off this list; they're still on the Tasks page.
 */
export function buildAttentionRows(tasks: BusinessTask[], conditions: ConditionCounts, today?: string): AttentionRow[] {
  const overdue = tasks.filter(t => dueState(t, today) === 'overdue');
  const dueToday = tasks.filter(t => dueState(t, today) === 'today');

  const conditionRows: AttentionRow[] = [];
  if (conditions.pendingDeliveries > 0) {
    conditionRows.push({
      id: 'deliveries', kind: 'condition', dot: 'orange', tab: 'delivery-payments',
      label: `${conditions.pendingDeliveries} pending ${conditions.pendingDeliveries === 1 ? 'delivery' : 'deliveries'}`,
    });
  }
  if (conditions.lowStockItems > 0) {
    conditionRows.push({
      id: 'stock', kind: 'condition', dot: 'red', tab: 'inventory',
      label: `${conditions.lowStockItems} low stock ${conditions.lowStockItems === 1 ? 'item' : 'items'}`,
    });
  }
  if (conditions.outstandingCustomers > 0) {
    conditionRows.push({
      id: 'customers', kind: 'condition', dot: 'amber', tab: 'clients',
      label: `${conditions.outstandingCustomers} ${conditions.outstandingCustomers === 1 ? 'customer' : 'customers'} with outstanding balance`,
    });
  }

  return [
    ...overdue.map((task): AttentionRow => ({ id: `task:${task.id}`, kind: 'task', task, late: true })),
    ...conditionRows,
    ...dueToday.map((task): AttentionRow => ({ id: `task:${task.id}`, kind: 'task', task, late: false })),
  ];
}

const DOT_CLASS: Record<'orange' | 'red' | 'amber', string> = {
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
};

interface NeedsAttentionProps {
  conditions: ConditionCounts;
  onNavigate: (tab: string) => void;
}

/**
 * Everything that needs a look today, in one list: what's overdue, what's low or owed, and what's due
 * today — instead of a separate "Attention Needed" box and a separate task list answering the same
 * question. A task can be ticked off right here; everything else opens the page it belongs to. Tasks due
 * later stay on the Tasks page, reached from "View all tasks", so this box never grows past what's urgent.
 */
export default function NeedsAttention({ conditions, onNavigate }: NeedsAttentionProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tasks, setTasks] = useState<BusinessTask[] | null>(null);

  const load = useCallback(() => {
    listTasks().then(setTasks).catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    load();
    return onTasksChanged(load);
  }, [load]);

  const complete = async (taskId: string) => {
    setTasks(prev => (prev ? prev.map(t => (t.id === taskId ? { ...t, completed: true } : t)) : prev));
    try {
      await toggleTaskCompleted(taskId, false);
      notifyTasksChanged();
    } catch {
      load();
      toast.error('Could not update the task');
    }
  };

  const rows = buildAttentionRows(tasks ?? [], conditions);

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Needs attention</h2>
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Task
        </button>
      </div>

      {tasks === null ? (
        <p className={`text-sm py-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className={`flex items-center gap-3 mt-2 py-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 animate-pop-check">
            <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
          </span>
          <p className="text-sm">Nothing needs attention right now.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          {rows.map(row =>
            row.kind === 'task' ? (
              <div key={row.id} className={`group flex items-center gap-3 p-3 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                <button
                  type="button"
                  onClick={() => complete(row.task.id)}
                  aria-label={`Mark "${row.task.title}" as done`}
                  className={`w-5 h-5 rounded border flex-shrink-0 transition-all duration-150 active:scale-90 ${
                    isDark ? 'border-slate-500 hover:border-blue-400' : 'border-gray-300 hover:border-blue-400'
                  }`}
                />
                <button type="button" onClick={() => onNavigate('tasks')} className="min-w-0 flex-1 text-left">
                  <span className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.task.title}</span>
                </button>
                <span
                  className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                    row.late
                      ? isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
                      : isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {row.late ? 'Overdue' : 'Today'}{row.task.dueTime ? ` · ${formatDueTime(row.task.dueTime)}` : ''}
                </span>
              </div>
            ) : (
              <button
                key={row.id}
                type="button"
                onClick={() => onNavigate(row.tab)}
                className={`group w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_CLASS[row.dot]}`} aria-hidden="true" />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.label}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            )
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate('tasks')}
        className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
      >
        View all tasks <ArrowRight className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  );
}
