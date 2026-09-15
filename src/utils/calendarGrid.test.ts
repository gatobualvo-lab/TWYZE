import { describe, it, expect } from 'vitest';
import { getMonthGrid } from './dateRange';

describe('getMonthGrid', () => {
  it('always returns 6 full weeks (42 days)', () => {
    expect(getMonthGrid(2026, 7)).toHaveLength(42); // August 2026 (0-indexed month 7)
  });

  it('starts on a Sunday and ends on a Saturday', () => {
    const grid = getMonthGrid(2026, 7);
    expect(new Date(grid[0].date + 'T12:00:00').getDay()).toBe(0);
    expect(new Date(grid[41].date + 'T12:00:00').getDay()).toBe(6);
  });

  it('marks every day of the target month as inMonth, and padding days as not', () => {
    const grid = getMonthGrid(2026, 7); // August has 31 days
    const inMonthDays = grid.filter(d => d.inMonth);
    expect(inMonthDays).toHaveLength(31);
    expect(inMonthDays[0].date).toBe('2026-08-01');
    expect(inMonthDays[30].date).toBe('2026-08-31');
  });

  it('flags today correctly when it falls inside the grid', () => {
    const grid = getMonthGrid(2026, 7, new Date('2026-08-15T12:00:00'));
    const today = grid.find(d => d.isToday);
    expect(today?.date).toBe('2026-08-15');
  });

  it('flags no day as today when the reference date is outside the month', () => {
    const grid = getMonthGrid(2026, 7, new Date('2026-09-15T12:00:00'));
    expect(grid.some(d => d.isToday)).toBe(false);
  });
});
