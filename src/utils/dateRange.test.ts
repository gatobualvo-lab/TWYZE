import { describe, it, expect } from 'vitest';
import { getPeriodRange, rangeKey, daysBetween } from './dateRange';

describe('getPeriodRange', () => {
  const wednesday = new Date('2026-08-05T12:00:00Z'); // a Wednesday

  it('today: start equals end', () => {
    expect(getPeriodRange('today', wednesday)).toEqual({ start: '2026-08-05', end: '2026-08-05' });
  });

  it('week: starts on the most recent Sunday', () => {
    expect(getPeriodRange('week', wednesday)).toEqual({ start: '2026-08-02', end: '2026-08-05' });
  });

  it('month: starts on the 1st of the current month', () => {
    expect(getPeriodRange('month', wednesday)).toEqual({ start: '2026-08-01', end: '2026-08-05' });
  });

  it('quarter: starts on the first month of the current quarter', () => {
    expect(getPeriodRange('quarter', wednesday)).toEqual({ start: '2026-07-01', end: '2026-08-05' });
  });

  it('year: starts on Jan 1', () => {
    expect(getPeriodRange('year', wednesday)).toEqual({ start: '2026-01-01', end: '2026-08-05' });
  });

  it('all: starts at a fixed epoch far in the past', () => {
    const result = getPeriodRange('all', wednesday);
    expect(result.end).toBe('2026-08-05');
    expect(new Date(result.start).getTime()).toBeLessThan(new Date('2020-01-01').getTime() + 1);
  });
});

describe('rangeKey', () => {
  it('produces a stable, distinct key per range', () => {
    expect(rangeKey({ start: '2026-08-01', end: '2026-08-05' })).toBe('2026-08-01:2026-08-05');
    expect(rangeKey({ start: '2026-08-01', end: '2026-08-05' })).not.toBe(
      rangeKey({ start: '2026-08-01', end: '2026-08-06' })
    );
  });
});

describe('daysBetween', () => {
  it('counts inclusively', () => {
    expect(daysBetween({ start: '2026-08-01', end: '2026-08-01' })).toBe(1);
    expect(daysBetween({ start: '2026-08-01', end: '2026-08-07' })).toBe(7);
  });

  it('never returns a negative count for a malformed/reversed range', () => {
    expect(daysBetween({ start: '2026-08-10', end: '2026-08-01' })).toBe(0);
  });
});
