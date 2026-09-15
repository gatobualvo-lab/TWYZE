import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isoWeekBucket } from './notificationSync';
import type { Opportunity } from '../opportunities/opportunityEngine';
import type { NotificationPreferences } from './notificationPreferencesService';

const publishNotificationMock = vi.fn();
const sendOpportunityAlertEmailMock = vi.fn();

vi.mock('./notificationService', () => ({
  publishNotification: (...args: unknown[]) => publishNotificationMock(...args),
}));
vi.mock('../email/emailService', () => ({
  sendOpportunityAlertEmail: (...args: unknown[]) => sendOpportunityAlertEmailMock(...args),
}));

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'stockout:widget-1',
    category: 'inventory',
    priority: 'high',
    title: 'Widget is about to run out',
    detected: '2026-09-15',
    whyItMatters: 'You will be out of stock within days at current sales pace.',
    estimatedImpact: null,
    evidence: [],
    recommendedAction: 'Reorder now',
    actionTab: 'inventory',
    ...overrides,
  };
}

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { mutedTypes: [], minPriority: 'low', emailEnabled: true, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  publishNotificationMock.mockResolvedValue(true);
  sendOpportunityAlertEmailMock.mockResolvedValue(undefined);
});

describe('syncOpportunityNotifications', () => {
  it('emails a genuinely new high-priority opportunity when email alerts are enabled', async () => {
    const { syncOpportunityNotifications } = await import('./notificationSync');
    await syncOpportunityNotifications([opportunity()], prefs({ emailEnabled: true }));

    expect(sendOpportunityAlertEmailMock).toHaveBeenCalledWith({
      title: 'Widget is about to run out',
      body: 'You will be out of stock within days at current sales pace.',
    });
  });

  it('does not email when the notification already existed (not genuinely new)', async () => {
    publishNotificationMock.mockResolvedValue(false);

    const { syncOpportunityNotifications } = await import('./notificationSync');
    await syncOpportunityNotifications([opportunity()], prefs({ emailEnabled: true }));

    expect(sendOpportunityAlertEmailMock).not.toHaveBeenCalled();
  });

  it('does not email when the user has email alerts turned off', async () => {
    const { syncOpportunityNotifications } = await import('./notificationSync');
    await syncOpportunityNotifications([opportunity()], prefs({ emailEnabled: false }));

    expect(publishNotificationMock).toHaveBeenCalled();
    expect(sendOpportunityAlertEmailMock).not.toHaveBeenCalled();
  });

  it('ignores medium/low priority opportunities entirely', async () => {
    const { syncOpportunityNotifications } = await import('./notificationSync');
    await syncOpportunityNotifications([opportunity({ priority: 'medium' })], prefs({ emailEnabled: true }));

    expect(publishNotificationMock).not.toHaveBeenCalled();
    expect(sendOpportunityAlertEmailMock).not.toHaveBeenCalled();
  });
});

describe('isoWeekBucket', () => {
  it('gives the same bucket for two dates a few days apart', () => {
    const a = isoWeekBucket(new Date('2026-08-10T09:00:00'));
    const b = isoWeekBucket(new Date('2026-08-12T21:00:00'));
    expect(a).toBe(b);
  });

  it('gives a different bucket for dates a month apart', () => {
    const a = isoWeekBucket(new Date('2026-08-10T09:00:00'));
    const b = isoWeekBucket(new Date('2026-09-10T09:00:00'));
    expect(a).not.toBe(b);
  });

  it('includes the year so the bucket does not collide across years', () => {
    const bucket = isoWeekBucket(new Date('2026-08-10T09:00:00'));
    expect(bucket).toContain('2026');
  });
});
