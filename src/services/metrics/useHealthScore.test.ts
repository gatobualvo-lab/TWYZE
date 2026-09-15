import { describe, it, expect } from 'vitest';
import { previousEqualPeriod } from './useHealthScore';

describe('previousEqualPeriod', () => {
  it('gives an equal-length window immediately preceding the range, not calendar month', () => {
    // Aug 1-10 is a 10-day window; the previous 10-day window ends Jul 31.
    expect(previousEqualPeriod({ start: '2026-08-01', end: '2026-08-10' })).toEqual({
      start: '2026-07-22',
      end: '2026-07-31',
    });
  });

  it('handles a single-day range', () => {
    expect(previousEqualPeriod({ start: '2026-08-05', end: '2026-08-05' })).toEqual({
      start: '2026-08-04',
      end: '2026-08-04',
    });
  });

  it('handles a range spanning a year boundary', () => {
    expect(previousEqualPeriod({ start: '2026-01-01', end: '2026-01-05' })).toEqual({
      start: '2025-12-27',
      end: '2025-12-31',
    });
  });
});
