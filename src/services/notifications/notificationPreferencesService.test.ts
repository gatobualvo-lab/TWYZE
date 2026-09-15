import { describe, it, expect } from 'vitest';
import { isNotificationAllowed } from './notificationPreferencesService';
import type { NotificationPreferences } from './notificationPreferencesService';

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { mutedTypes: [], minPriority: 'low', emailEnabled: true, ...overrides };
}

describe('isNotificationAllowed', () => {
  it('allows everything by default', () => {
    expect(isNotificationAllowed(prefs(), 'opportunity', 'low')).toBe(true);
    expect(isNotificationAllowed(prefs(), 'opportunity', 'critical')).toBe(true);
  });

  it('blocks a muted type regardless of priority', () => {
    expect(isNotificationAllowed(prefs({ mutedTypes: ['opportunity'] }), 'opportunity', 'critical')).toBe(false);
  });

  it('blocks anything below the minimum priority', () => {
    const p = prefs({ minPriority: 'high' });
    expect(isNotificationAllowed(p, 'opportunity', 'medium')).toBe(false);
    expect(isNotificationAllowed(p, 'opportunity', 'high')).toBe(true);
    expect(isNotificationAllowed(p, 'opportunity', 'critical')).toBe(true);
  });

  it('does not let a low minimum priority block anything', () => {
    const p = prefs({ minPriority: 'low' });
    expect(isNotificationAllowed(p, 'opportunity', 'low')).toBe(true);
  });
});
