// Reminder timing for tasks. A reminder is "N minutes before the task's due
// moment"; the due moment is the due date at the due time (9:00 am when the
// user gave a date but no time, so a reminder still lands at a sensible hour).

export const DEFAULT_DUE_TIME = '09:00';

export interface ReminderOption {
  /** Minutes before the due moment; null means no reminder. */
  value: number | null;
  label: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At the due time' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 24 * 60, label: '1 day before' },
  { value: 7 * 24 * 60, label: '1 week before' },
];

/** The instant (ISO, UTC) to remind at, or null if there is no reminder or no due date. Times are the user's local time. */
export function computeRemindAt(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  minutesBefore: number | null | undefined
): string | null {
  if (!dueDate || minutesBefore === null || minutesBefore === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const time = dueTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime) ? dueTime : DEFAULT_DUE_TIME;

  const due = new Date(`${dueDate}T${time}:00`);
  if (Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() - minutesBefore * 60_000).toISOString();
}

/** "9:30 am" style label for a stored HH:MM value. */
export function formatDueTime(dueTime: string | null | undefined): string {
  if (!dueTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) return '';
  const [h, m] = dueTime.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}
