import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { listDueReminders } from './taskService';
import { formatDueTime } from './reminders';
import { publishNotification } from '../notifications/notificationService';

const SEEN_KEY = 'trackwyze_reminded_tasks';
const CHECK_EVERY_MS = 60_000;
/** A reminder missed for more than this long (app closed all week) is shown in the bell only, not as a pop-up. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeSeen(seen: Record<string, string>) {
  try {
    // Keep the list from growing forever.
    const entries = Object.entries(seen).slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Without storage a reminder may show twice; the in-app notification is deduped server-side.
  }
}

/** Raises a pop-up (and a system notification when allowed) when a task's reminder time arrives while Trackwyze is open. */
export function useTaskReminders(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const check = async () => {
      if (stopped || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      try {
        const due = await listDueReminders();
        const seen = readSeen();
        let changed = false;

        for (const task of due) {
          // Re-fires if the owner moves the reminder to a new time.
          if (!task.remindAt || seen[task.id] === task.remindAt) continue;
          seen[task.id] = task.remindAt;
          changed = true;

          const when = [task.dueDate, formatDueTime(task.dueTime)].filter(Boolean).join(' ');
          const fresh = Date.now() - new Date(task.remindAt).getTime() < STALE_AFTER_MS;

          publishNotification({
            type: 'task_reminder',
            priority: 'high',
            title: `Reminder: ${task.title}`,
            body: when ? `Due ${when}` : undefined,
            entityType: 'task',
            entityId: task.id,
            actionTab: 'dashboard',
            dedupeKey: `task_reminder:${task.id}:${task.remindAt}`,
          }).catch(() => {});

          if (!fresh) continue;
          toast(`Reminder: ${task.title}${when ? ` (${when})` : ''}`, { icon: '⏰', duration: 12_000 });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('Trackwyze reminder', { body: task.title, tag: `task-${task.id}` });
            } catch {
              // Some mobile browsers only allow notifications from a service worker.
            }
          }
        }
        if (changed) writeSeen(seen);
      } catch {
        // Reminders are best-effort; the next tick tries again.
      }
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}

/** Asks for permission to show system notifications; resolves true if granted. Safe to call repeatedly. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
