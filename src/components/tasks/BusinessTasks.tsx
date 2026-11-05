import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { listTasks, createTask, toggleTaskCompleted, deleteTask as deleteTaskRecord, type BusinessTask } from '../../services/tasks/taskService';
import { REMINDER_OPTIONS, formatDueTime } from '../../services/tasks/reminders';
import { ensureNotificationPermission } from '../../services/tasks/useTaskReminders';
import { notifyTasksChanged, onTasksChanged } from '../../services/tasks/taskEvents';
import { dueState, sortTasks, type DueState } from '../../services/tasks/taskUrgency';
import { toISODate } from '../../utils/dateRange';

export { dueState, sortTasks, type DueState };

type Filter = 'todo' | 'done' | 'all';

interface BusinessTasksProps {
  /** "card" is the small box on the dashboard; "page" is the full Business Tasks page in the menu. */
  variant: 'card' | 'page';
  /** On the card: opens the full page. */
  onViewAll?: () => void;
  /** Opens the Business Calendar on a day. Leave out when the plan has no calendar. */
  onOpenCalendar?: (date: string) => void;
}

const CHIP_BY_STATE: Record<DueState, { light: string; dark: string }> = {
  overdue: { light: 'bg-red-50 text-red-700', dark: 'bg-red-900/30 text-red-300' },
  today: { light: 'bg-amber-50 text-amber-700', dark: 'bg-amber-900/30 text-amber-300' },
  later: { light: 'bg-gray-100 text-gray-500', dark: 'bg-slate-600 text-gray-400' },
  none: { light: 'bg-gray-100 text-gray-500', dark: 'bg-slate-600 text-gray-400' },
};

export default function BusinessTasks({ variant, onViewAll, onOpenCalendar }: BusinessTasksProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isPage = variant === 'page';

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todo');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('general');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [remind, setRemind] = useState<number | null>(null);
  // On the small dashboard box the extra options stay out of the way until asked for.
  const [showOptions, setShowOptions] = useState(false);

  // Identifies this list, so a change it made itself does not trigger a pointless reload of itself.
  const self = useRef({});

  const load = useCallback(() => {
    listTasks()
      .then(setTasks)
      .catch(() => toast.error('Could not load your tasks'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // A task added, ticked off or deleted anywhere else (the calendar, a reminder pop-up) shows up here too.
    return onTasksChanged(origin => { if (origin !== self.current) load(); });
  }, [load]);

  const addTask = useCallback(async () => {
    if (!title.trim()) return;
    try {
      const wantsReminder = remind !== null && !!dueDate;
      const created = await createTask({
        title: title.trim(),
        taskType: type,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        remindMinutesBefore: wantsReminder ? remind : null,
      });
      setTasks(prev => [created, ...prev]);
      setTitle('');
      setDueDate('');
      setDueTime('');
      setRemind(null);
      notifyTasksChanged(self.current);
      toast.success(wantsReminder ? 'Task added. You will be reminded' : 'Task added');
      if (wantsReminder) ensureNotificationPermission();
    } catch {
      toast.error('Failed to add task');
    }
  }, [title, type, dueDate, dueTime, remind]);

  const toggle = async (id: string, completed: boolean) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !completed } : t)));
    try {
      await toggleTaskCompleted(id, completed);
      notifyTasksChanged(self.current);
    } catch {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed } : t)));
      toast.error('Could not update the task');
    }
  };

  const remove = async (id: string) => {
    const before = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await deleteTaskRecord(id);
      notifyTasksChanged(self.current);
    } catch {
      setTasks(before);
      toast.error('Could not delete the task');
    }
  };

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const openCount = tasks.filter(t => !t.completed).length;
  const doneCount = tasks.length - openCount;
  const visible = isPage ? sorted.filter(t => (filter === 'todo' ? !t.completed : filter === 'done' ? t.completed : true)) : sorted.filter(t => !t.completed);
  const today = toISODate(new Date());
  const optionsOpen = isPage || showOptions;

  const field = `w-full min-w-0 sm:w-auto text-xs px-2 py-2 rounded-lg border disabled:opacity-50 ${
    isDark ? 'bg-slate-700 border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
  }`;
  const chipBase = 'text-xs px-1.5 py-0.5 rounded';
  const plainChip = `${chipBase} ${isDark ? CHIP_BY_STATE.later.dark : CHIP_BY_STATE.later.light}`;

  return (
    <div className={`rounded-xl border ${isPage ? 'p-5' : 'p-4'} ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${isPage ? 'text-lg' : 'text-base'} font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
          Business Tasks{!isPage && openCount > 0 ? ` (${openCount})` : ''}
        </h2>
        {!isPage && onViewAll && (
          <button type="button" onClick={onViewAll} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-2.5">
        <label htmlFor={`task-title-${variant}`} className="sr-only">New task</label>
        <input
          id={`task-title-${variant}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="Add a task..."
          className={`flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border ${
            isDark ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder:text-gray-500' : 'border-gray-200 placeholder:text-gray-400'
          }`}
        />
        {!isPage && (
          <button
            type="button"
            onClick={() => setShowOptions(v => !v)}
            aria-expanded={showOptions}
            aria-label="Date, time and reminder options"
            className={`px-2.5 rounded-lg border flex-shrink-0 ${isDark ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
        <button onClick={addTask} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium flex-shrink-0">
          Add
        </button>
      </div>
      {/* Two columns on a phone so the four controls fit its width; a wider row would stretch the whole page. */}
      {optionsOpen && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-2">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Task type" className={field}>
            <option value="general">General</option>
            <option value="follow_up">Follow up</option>
            <option value="pay_supplier">Pay supplier</option>
            <option value="restock">Restock</option>
            <option value="deliver">Deliver</option>
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" className={field} />
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} aria-label="Due time" className={field} />
          <select
            value={remind === null ? '' : String(remind)}
            onChange={(e) => setRemind(e.target.value === '' ? null : Number(e.target.value))}
            disabled={!dueDate}
            aria-label="Reminder"
            className={field}
          >
            {REMINDER_OPTIONS.map(o => (
              <option key={String(o.value)} value={o.value === null ? '' : String(o.value)}>{o.value === null ? 'No reminder' : `Remind: ${o.label.toLowerCase()}`}</option>
            ))}
          </select>
        </div>
      )}

      {isPage && (
        <div className="mt-4 flex gap-2" role="tablist" aria-label="Show tasks">
          {([['todo', `To do (${openCount})`], ['done', `Done (${doneCount})`], ['all', `All (${tasks.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isDark ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={`mt-2.5 space-y-0.5 ${isPage ? '' : 'max-h-40 overflow-y-auto'}`}>
        {loading ? (
          <p className={`text-sm py-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading…</p>
        ) : visible.length === 0 ? (
          <p className={`text-sm py-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {tasks.length === 0 ? 'No tasks yet.' : filter === 'done' && isPage ? 'Nothing finished yet.' : 'Nothing left to do.'}
          </p>
        ) : (
          visible.map(task => {
            const state = dueState(task, today);
            const dueChip = `${chipBase} ${isDark ? CHIP_BY_STATE[state].dark : CHIP_BY_STATE[state].light}`;
            return (
              <div key={task.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg group transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                <button
                  onClick={() => toggle(task.id, task.completed)}
                  aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-150 active:scale-90 ${
                    task.completed ? 'bg-blue-600 border-blue-600' : isDark ? 'border-slate-500 hover:border-blue-400' : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {task.completed && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm break-words ${task.completed ? 'line-through opacity-50' : ''} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{task.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {task.dueDate && (
                      <span className={dueChip}>
                        {state === 'overdue' ? 'Overdue · ' : state === 'today' ? 'Today · ' : ''}
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {task.dueTime ? ` · ${formatDueTime(task.dueTime)}` : ''}
                        {task.remindAt && !task.completed ? ' ⏰' : ''}
                      </span>
                    )}
                    {isPage && <span className={plainChip}>{task.taskType.replace('_', ' ')}</span>}
                  </div>
                </div>
                {task.dueDate && onOpenCalendar && (
                  <button
                    onClick={() => onOpenCalendar(task.dueDate!)}
                    aria-label={`Show "${task.title}" on the calendar`}
                    title="Show on calendar"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600"
                  >
                    <CalendarDays className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={() => remove(task.id)}
                  aria-label={`Delete "${task.title}"`}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-red-400 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
