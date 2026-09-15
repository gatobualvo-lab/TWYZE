import { describe, it, expect } from 'vitest';
import { buildCalendarEvents } from './calendarEvents';

describe('buildCalendarEvents', () => {
  it('returns an empty map when given no data', () => {
    expect(buildCalendarEvents({}).size).toBe(0);
  });

  it('groups a revenue day and skips days with zero revenue', () => {
    const map = buildCalendarEvents({
      dailySeries: [
        { day: '2026-08-10', revenue: 5000, profit: 1000, expenses: 0, transactionCount: 2 },
        { day: '2026-08-11', revenue: 0, profit: 0, expenses: 0, transactionCount: 0 },
      ],
    });
    expect(map.has('2026-08-10')).toBe(true);
    expect(map.has('2026-08-11')).toBe(false);
    expect(map.get('2026-08-10')![0].type).toBe('revenue');
  });

  it('shows both a revenue and an expense event on the same day when both occurred', () => {
    const map = buildCalendarEvents({
      dailySeries: [{ day: '2026-08-10', revenue: 5000, profit: 1000, expenses: 2000, transactionCount: 1 }],
    });
    const types = map.get('2026-08-10')!.map(e => e.type).sort();
    expect(types).toEqual(['expense', 'revenue']);
  });

  it('only surfaces active goal deadlines, not completed/missed/archived ones', () => {
    const map = buildCalendarEvents({
      goals: [
        { id: 'g1', name: 'Active Goal', periodEnd: '2026-08-31', status: 'active' },
        { id: 'g2', name: 'Missed Goal', periodEnd: '2026-08-20', status: 'missed' },
      ],
    });
    expect(map.has('2026-08-31')).toBe(true);
    expect(map.has('2026-08-20')).toBe(false);
  });

  it('skips completed tasks and tasks with no due date', () => {
    const map = buildCalendarEvents({
      tasks: [
        { id: 't1', title: 'Call supplier', dueDate: '2026-08-12', completed: false },
        { id: 't2', title: 'Done already', dueDate: '2026-08-12', completed: true },
        { id: 't3', title: 'No date', dueDate: null, completed: false },
      ],
    });
    expect(map.get('2026-08-12')).toHaveLength(1);
    expect(map.get('2026-08-12')![0].title).toBe('Call supplier');
  });

  it('marks a high stockout risk as critical and medium as warning', () => {
    const map = buildCalendarEvents({
      stockoutForecasts: [
        { productName: 'Desk', stockoutDate: '2026-08-15', risk: 'high' },
        { productName: 'Chair', stockoutDate: '2026-08-20', risk: 'medium' },
      ],
    });
    expect(map.get('2026-08-15')![0].severity).toBe('critical');
    expect(map.get('2026-08-20')![0].severity).toBe('warning');
  });

  it('merges events from multiple sources that land on the same day', () => {
    const map = buildCalendarEvents({
      dailySeries: [{ day: '2026-08-10', revenue: 1000, profit: 200, expenses: 0, transactionCount: 1 }],
      tasks: [{ id: 't1', title: 'Follow up', dueDate: '2026-08-10', completed: false }],
    });
    expect(map.get('2026-08-10')).toHaveLength(2);
  });
});
