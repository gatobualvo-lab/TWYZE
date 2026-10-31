import { describe, it, expect } from 'vitest';
import { describePeriod, isWithin, normalizeCustom, periodFor, toIsoDate } from './period';

// Wednesday 21 October 2026, late evening: a UTC-based "today" would already be Thursday elsewhere.
const NOW = new Date(2026, 9, 21, 23, 30);

describe('toIsoDate', () => {
  it('uses the local calendar day', () => {
    expect(toIsoDate(NOW)).toBe('2026-10-21');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('periodFor', () => {
  it('today', () => {
    expect(periodFor('today', NOW)).toEqual({ preset: 'today', start: '2026-10-21', end: '2026-10-21' });
  });

  it('this week runs Monday to Sunday', () => {
    expect(periodFor('week', NOW)).toMatchObject({ start: '2026-10-19', end: '2026-10-25' });
    // a Sunday still belongs to the week that started on the Monday before
    expect(periodFor('week', new Date(2026, 9, 25))).toMatchObject({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodFor('week', new Date(2026, 9, 26))).toMatchObject({ start: '2026-10-26', end: '2026-11-01' });
  });

  it('this month and last month, including February and year boundaries', () => {
    expect(periodFor('month', NOW)).toMatchObject({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodFor('last_month', NOW)).toMatchObject({ start: '2026-09-01', end: '2026-09-30' });
    expect(periodFor('last_month', new Date(2026, 0, 10))).toMatchObject({ start: '2025-12-01', end: '2025-12-31' });
    expect(periodFor('month', new Date(2028, 1, 10))).toMatchObject({ end: '2028-02-29' });
  });

  it('this year, all time and custom', () => {
    expect(periodFor('year', NOW)).toMatchObject({ start: '2026-01-01', end: '2026-12-31' });
    expect(periodFor('all', NOW)).toEqual({ preset: 'all', start: '', end: '' });
    expect(periodFor('custom', NOW, { start: '2026-03-01', end: '2026-03-15' })).toEqual({ preset: 'custom', start: '2026-03-01', end: '2026-03-15' });
    expect(periodFor('custom', NOW)).toEqual({ preset: 'custom', start: '', end: '' });
  });
});

describe('isWithin', () => {
  const october = { start: '2026-10-01', end: '2026-10-31' };

  it('includes both end days', () => {
    expect(isWithin('2026-10-01', october)).toBe(true);
    expect(isWithin('2026-10-31', october)).toBe(true);
    expect(isWithin('2026-09-30', october)).toBe(false);
    expect(isWithin('2026-11-01', october)).toBe(false);
  });

  it('counts a timestamp on the last day as inside', () => {
    expect(isWithin('2026-10-31T14:30:00+00:00', october)).toBe(true);
  });

  it('no limits means everything, including missing dates', () => {
    expect(isWithin(null, { start: '', end: '' })).toBe(true);
    expect(isWithin(null, october)).toBe(false);
  });

  it('works with only one end set', () => {
    expect(isWithin('2026-05-01', { start: '2026-04-01', end: '' })).toBe(true);
    expect(isWithin('2026-03-01', { start: '2026-04-01', end: '' })).toBe(false);
    expect(isWithin('2026-03-01', { start: '', end: '2026-04-01' })).toBe(true);
  });
});

describe('describePeriod', () => {
  it('words the period', () => {
    expect(describePeriod({ preset: 'all', start: '', end: '' })).toBe('All time');
    expect(describePeriod({ preset: 'today', start: '2026-10-21', end: '2026-10-21' })).toBe('Today');
    expect(describePeriod({ preset: 'custom', start: '2026-10-05', end: '2026-10-05' })).toContain('2026');
    expect(describePeriod({ preset: 'month', start: '2026-10-01', end: '2026-10-31' })).toMatch(/^1 Oct – 31 Oct 2026$/);
    expect(describePeriod({ preset: 'custom', start: '2026-10-01', end: '' })).toMatch(/^From /);
    expect(describePeriod({ preset: 'custom', start: '', end: '2026-10-01' })).toMatch(/^Up to /);
  });
});

describe('normalizeCustom', () => {
  it('swaps a back-to-front range', () => {
    expect(normalizeCustom('2026-10-20', '2026-10-10')).toEqual({ start: '2026-10-10', end: '2026-10-20' });
    expect(normalizeCustom('2026-10-10', '2026-10-20')).toEqual({ start: '2026-10-10', end: '2026-10-20' });
    expect(normalizeCustom('', '2026-10-20')).toEqual({ start: '', end: '2026-10-20' });
  });
});
