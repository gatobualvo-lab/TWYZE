import { describe, it, expect } from 'vitest';
import { computeRemindAt, formatDueTime } from './reminders';

// Expected values are built the same way the code does (local time), so the
// tests pass in any time zone.
const local = (iso: string) => new Date(iso).toISOString();

describe('computeRemindAt', () => {
  it('reminds at the due time itself', () => {
    expect(computeRemindAt('2026-10-30', '14:30', 0)).toBe(local('2026-10-30T14:30:00'));
  });

  it('subtracts the lead time', () => {
    expect(computeRemindAt('2026-10-30', '14:30', 60)).toBe(local('2026-10-30T13:30:00'));
    expect(computeRemindAt('2026-10-30', '14:30', 24 * 60)).toBe(local('2026-10-29T14:30:00'));
  });

  it('uses 9:00 am when only a date was given', () => {
    expect(computeRemindAt('2026-10-30', null, 0)).toBe(local('2026-10-30T09:00:00'));
    expect(computeRemindAt('2026-10-30', '', 15)).toBe(local('2026-10-30T08:45:00'));
  });

  it('returns null without a due date or a reminder choice', () => {
    expect(computeRemindAt(null, '10:00', 15)).toBeNull();
    expect(computeRemindAt('2026-10-30', '10:00', null)).toBeNull();
    expect(computeRemindAt('2026-10-30', '10:00', undefined)).toBeNull();
  });

  it('rejects malformed dates and falls back to 9:00 for a malformed time', () => {
    expect(computeRemindAt('30/10/2026', '10:00', 0)).toBeNull();
    expect(computeRemindAt('2026-10-30', '25:99', 0)).toBe(local('2026-10-30T09:00:00'));
  });
});

describe('formatDueTime', () => {
  it('formats 24-hour times as am/pm', () => {
    expect(formatDueTime('09:05')).toBe('9:05 am');
    expect(formatDueTime('00:00')).toBe('12:00 am');
    expect(formatDueTime('12:30')).toBe('12:30 pm');
    expect(formatDueTime('18:45')).toBe('6:45 pm');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDueTime(null)).toBe('');
    expect(formatDueTime('soon')).toBe('');
  });
});
