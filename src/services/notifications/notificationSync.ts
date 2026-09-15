import { publishNotification } from './notificationService';
import { isNotificationAllowed } from './notificationPreferencesService';
import type { NotificationPreferences } from './notificationPreferencesService';
import type { Opportunity } from '../opportunities/opportunityEngine';
import { sendOpportunityAlertEmail } from '../email/emailService';

// Notifications are never detected here — every check already happens in
// the Opportunity Center's detectors and Business Goals' progress math.
// This module's only job is turning "the app already knows this matters"
// into a row in the shared notifications table, filtered by the user's
// preferences and deduplicated so the same finding never repeats.

export function isoWeekBucket(d: Date): string {
  // Coarse weekly bucket (not a strict ISO week number, just "same 7-day
  // stretch") so a goal that stays at-risk re-notifies weekly instead of
  // going silent forever after the first notification, or spamming daily.
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

/**
 * Only high-priority opportunities are worth an interruption — the full
 * list is still available in the Opportunity Center for everything else.
 * This is also the entire "low stock" / "overdue invoice" email alert
 * feature: opportunityEngine.ts already classifies stockouts and overdue
 * invoices as high-priority opportunities, so emailing on a genuinely new
 * high-priority opportunity notification covers both without any separate
 * detection logic.
 */
export async function syncOpportunityNotifications(opportunities: Opportunity[], prefs: NotificationPreferences): Promise<void> {
  if (!isNotificationAllowed(prefs, 'opportunity', 'high')) return;
  const highPriority = opportunities.filter(o => o.priority === 'high');

  await Promise.all(
    highPriority.map(async o => {
      try {
        const isNew = await publishNotification({
          type: 'opportunity',
          priority: 'high',
          title: o.title,
          body: o.whyItMatters,
          entityType: 'opportunity',
          actionTab: o.actionTab,
          dedupeKey: `opportunity:${o.id}`,
        });
        if (isNew && prefs.emailEnabled) {
          sendOpportunityAlertEmail({ title: o.title, body: o.whyItMatters }).catch(() => {});
        }
      } catch {
        // best-effort, matches the previous per-item .catch(() => {})
      }
    })
  );
}

export interface AtRiskGoalInput {
  id: string;
  name: string;
}

export async function syncGoalNotifications(atRiskGoals: AtRiskGoalInput[], prefs: NotificationPreferences): Promise<void> {
  if (!isNotificationAllowed(prefs, 'goal_at_risk', 'medium')) return;
  const bucket = isoWeekBucket(new Date());

  await Promise.all(
    atRiskGoals.map(g =>
      publishNotification({
        type: 'goal_at_risk',
        priority: 'medium',
        title: `"${g.name}" is falling behind pace`,
        body: 'Check progress and see what it would take to get back on track.',
        entityType: 'goal',
        entityId: g.id,
        actionTab: 'goals',
        dedupeKey: `goal_at_risk:${g.id}:${bucket}`,
      }).catch(() => {})
    )
  );
}
