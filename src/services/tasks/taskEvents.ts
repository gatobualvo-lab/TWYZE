// Small message board between the places that show tasks (the Tasks page, the dashboard box, the Business
// Calendar, the reminder pop-up). When one of them changes a task the others refresh, and "show this task
// on the calendar" can open the calendar on the right day, even though every page stays mounted once opened.

const TASKS_CHANGED = 'trackwyze:tasks-changed';
const CALENDAR_DATE = 'trackwyze:calendar-date';
const CALENDAR_DATE_KEY = 'trackwyze_calendar_date';

/**
 * Tells every list of tasks that a task was added, changed or removed. Pass yourself as the origin so you can
 * skip reloading for a change you just made.
 */
export function notifyTasksChanged(origin?: object): void {
  window.dispatchEvent(new CustomEvent<object | undefined>(TASKS_CHANGED, { detail: origin }));
}

/** Runs the callback whenever a task changes anywhere (with who changed it, if they said). Returns the function that stops listening. */
export function onTasksChanged(callback: (origin?: object) => void): () => void {
  const handler = (event: Event) => callback((event as CustomEvent<object | null>).detail ?? undefined);
  window.addEventListener(TASKS_CHANGED, handler);
  return () => window.removeEventListener(TASKS_CHANGED, handler);
}

/** Asks the Business Calendar to show a day (YYYY-MM-DD). Works whether or not the calendar is open yet. */
export function requestCalendarDate(date: string): void {
  try {
    sessionStorage.setItem(CALENDAR_DATE_KEY, date);
  } catch {
    // private mode: the calendar can still be told through the event below
  }
  window.dispatchEvent(new CustomEvent<string>(CALENDAR_DATE, { detail: date }));
}

/** The day waiting to be shown by a calendar that was not open when it was asked for, once. */
export function takeRequestedCalendarDate(): string | null {
  try {
    const date = sessionStorage.getItem(CALENDAR_DATE_KEY);
    if (date) sessionStorage.removeItem(CALENDAR_DATE_KEY);
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

/** Runs the callback when a day is asked for while the calendar is already open. */
export function onCalendarDateRequested(callback: (date: string) => void): () => void {
  const handler = (event: Event) => {
    const date = (event as CustomEvent<string>).detail;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      try {
        sessionStorage.removeItem(CALENDAR_DATE_KEY);
      } catch {
        // nothing to clear
      }
      callback(date);
    }
  };
  window.addEventListener(CALENDAR_DATE, handler);
  return () => window.removeEventListener(CALENDAR_DATE, handler);
}
