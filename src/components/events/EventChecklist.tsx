import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Plus, ListChecks, Clock } from 'lucide-react';
import { formatDate } from '../../utils/format';
import { listTasksForProject, createTask, toggleTaskCompleted, type BusinessTask } from '../../services/tasks/taskService';

interface EventChecklistProps {
  projectId: string;
  /** YYYY-MM-DD — items dated on this day are the "Run of Show" (timed, day-of schedule). */
  eventDate: string | null;
  mode: 'checklist' | 'runOfShow';
}

/** Checklist = everything not dated on the event day itself; Run of Show = only those, timed. */
const EventChecklist: React.FC<EventChecklistProps> = ({ projectId, eventDate, mode }) => {
  const [tasks, setTasks] = useState<BusinessTask[] | null>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(mode === 'runOfShow' && eventDate ? eventDate : '');
  const [dueTime, setDueTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listTasksForProject(projectId).then(setTasks).catch(() => setTasks([])); };
  useEffect(refresh, [projectId]);

  const isRunOfShowItem = (t: BusinessTask) => !!eventDate && t.dueDate === eventDate;
  const visible = (tasks ?? []).filter(t => (mode === 'runOfShow' ? isRunOfShowItem(t) : !isRunOfShowItem(t)));
  const sorted = mode === 'runOfShow'
    ? [...visible].sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''))
    : visible;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (mode === 'runOfShow' && !eventDate) {
      toast.error('Set an event date first (from Overview) to build a run-of-show schedule');
      return;
    }
    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        taskType: mode === 'runOfShow' ? 'event' : 'general',
        dueDate: mode === 'runOfShow' ? eventDate : (dueDate || null),
        dueTime: dueTime || null,
        projectId,
      });
      setTitle(''); setDueTime('');
      if (mode === 'checklist') setDueDate('');
      refresh();
    } catch {
      toast.error('Could not add that item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (taskId: string, completed: boolean) => {
    setTasks(prev => prev && prev.map(t => (t.id === taskId ? { ...t, completed: !completed } : t)));
    try {
      await toggleTaskCompleted(taskId, completed);
    } catch {
      toast.error('Could not update that item');
      refresh();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
        {mode === 'runOfShow' ? <Clock className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
        {mode === 'runOfShow' ? 'Run of show' : 'Checklist'} ({sorted.length})
      </p>

      {!tasks ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-400">
          {mode === 'runOfShow'
            ? (eventDate ? 'No timed items yet for the event day.' : 'Set an event date first (from Overview).')
            : 'No checklist items yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sorted.map(t => (
            <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => handleToggle(t.id, t.completed)}
                aria-label={t.completed ? 'Mark not done' : 'Mark done'}
                className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}
              >
                {t.completed && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className={`flex-1 min-w-0 truncate ${t.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
              {mode === 'runOfShow'
                ? (t.dueTime && <span className="text-xs font-semibold text-violet-600 flex-shrink-0">{t.dueTime}</span>)
                : (t.dueDate && <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(t.dueDate)}</span>)}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          placeholder={mode === 'runOfShow' ? 'Add a schedule item (e.g. Gates open)' : 'Add a checklist item (e.g. Book venue)'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        {mode === 'checklist' && (
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" aria-label="Due date" />
        )}
        <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" aria-label="Time" />
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg flex-shrink-0"
        >
          <Plus className="w-4 h-4 inline -mt-0.5" /> {submitting ? 'Adding…' : 'Add'}
        </button>
      </form>
    </div>
  );
};

export default EventChecklist;
