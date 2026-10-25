import { supabase } from '../../utils/supabase';
import type { NotificationPriority } from './notificationService';

export interface NotificationPreferences {
  mutedTypes: string[];
  minPriority: NotificationPriority;
  /** Also email high-priority opportunity alerts (low stock, overdue invoices) as they're published. */
  emailEnabled: boolean;
  /** Email a business summary every quarter, half-year and year. */
  periodReportsEnabled: boolean;
  /** Email task reminders (in addition to the in-app pop-up). */
  taskRemindersEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  mutedTypes: [],
  minPriority: 'low',
  emailEnabled: true,
  periodReportsEnabled: true,
  taskRemindersEnabled: true,
};

export async function getPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase.from('notification_preferences').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PREFERENCES;
  return {
    mutedTypes: data.muted_types ?? [],
    minPriority: (data.min_priority as NotificationPriority) ?? 'low',
    emailEnabled: data.email_enabled ?? true,
    periodReportsEnabled: data.period_reports_enabled ?? true,
    taskRemindersEnabled: data.task_reminders_enabled ?? true,
  };
}

export async function updatePreferences(prefs: NotificationPreferences): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to change notification settings.');

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      muted_types: prefs.mutedTypes,
      min_priority: prefs.minPriority,
      email_enabled: prefs.emailEnabled,
      period_reports_enabled: prefs.periodReportsEnabled,
      task_reminders_enabled: prefs.taskRemindersEnabled,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

const PRIORITY_RANK: Record<NotificationPriority, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function isNotificationAllowed(prefs: NotificationPreferences, type: string, priority: NotificationPriority): boolean {
  if (prefs.mutedTypes.includes(type)) return false;
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[prefs.minPriority];
}
