import { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import type { BusinessTask } from '../../services/tasks/taskService';
import { formatDueTime } from '../../services/tasks/reminders';

interface ReminderToastProps {
  /** The tasks whose reminder time has arrived. */
  tasks: BusinessTask[];
  /** Ticks a task off. */
  onDone: (task: BusinessTask) => void;
  /** Opens the Tasks page. */
  onOpenTasks: () => void;
  /** Closes the pop-up. */
  onClose: () => void;
}

const MAX_SHOWN = 3;

function when(task: BusinessTask): string {
  return [task.dueDate, formatDueTime(task.dueTime)].filter(Boolean).join(' ');
}

/** The reminder pop-up: what is due, a way to tick it off, a way to see the rest, and always a way to close it. */
export default function ReminderToast({ tasks, onDone, onOpenTasks, onClose }: ReminderToastProps) {
  const shown = tasks.slice(0, MAX_SHOWN);
  const more = tasks.length - shown.length;

  return (
    <div role="alert" className="pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xl">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{tasks.length === 1 ? 'Reminder' : `${tasks.length} reminders`}</p>
          <ul className="mt-1 space-y-1.5">
            {shown.map(task => (
              <li key={task.id} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onDone(task)}
                  aria-label={`Mark "${task.title}" as done`}
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-gray-300 text-transparent hover:border-blue-500 hover:text-blue-500"
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>
                <span className="min-w-0 text-sm text-gray-800 break-words">
                  {task.title}
                  {when(task) && <span className="ml-1.5 text-xs text-gray-500">{when(task)}</span>}
                </span>
              </li>
            ))}
          </ul>
          {more > 0 && <p className="mt-1 text-xs text-gray-500">and {more} more</p>}
          <button type="button" onClick={onOpenTasks} className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
            View tasks
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reminder"
          className="-mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface ReminderPopupProps {
  initial: BusinessTask[];
  /** Ticks the task off (saves it). */
  complete: (task: BusinessTask) => void;
  onOpenTasks: () => void;
  onClose: () => void;
}

/** The reminder pop-up with its own list: ticking one off removes it, and the pop-up closes after the last. */
export function ReminderPopup({ initial, complete, onOpenTasks, onClose }: ReminderPopupProps) {
  const [tasks, setTasks] = useState(initial);
  if (tasks.length === 0) return null;
  return (
    <ReminderToast
      tasks={tasks}
      onClose={onClose}
      onOpenTasks={onOpenTasks}
      onDone={task => {
        complete(task);
        const rest = tasks.filter(t => t.id !== task.id);
        setTasks(rest);
        if (rest.length === 0) onClose();
      }}
    />
  );
}
