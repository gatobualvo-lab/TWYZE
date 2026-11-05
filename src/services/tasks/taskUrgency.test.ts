import { describe, it, expect } from 'vitest';
import { dueState, sortTasks } from './taskUrgency';
import type { BusinessTask } from './taskService';

const task = (over: Partial<BusinessTask>): BusinessTask => ({
  id: 'x', title: 'Task', taskType: 'general', completed: false, dueDate: null, dueTime: null, remindAt: null, createdAt: null, ...over,
});

describe('sortTasks', () => {
  it('puts open tasks first, soonest due first, undated last, finished tasks at the end', () => {
    const sorted = sortTasks([
      task({ id: 'done', completed: true, dueDate: '2026-11-01' }),
      task({ id: 'undated' }),
      task({ id: 'later', dueDate: '2026-11-09' }),
      task({ id: 'soon-late', dueDate: '2026-11-05', dueTime: '15:00' }),
      task({ id: 'soon-early', dueDate: '2026-11-05', dueTime: '08:00' }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(['soon-early', 'soon-late', 'later', 'undated', 'done']);
  });
});

describe('dueState', () => {
  const today = '2026-11-05';
  it('tells late, today, later and undated apart, and ignores finished tasks', () => {
    expect(dueState(task({ dueDate: '2026-11-04' }), today)).toBe('overdue');
    expect(dueState(task({ dueDate: '2026-11-05' }), today)).toBe('today');
    expect(dueState(task({ dueDate: '2026-11-09' }), today)).toBe('later');
    expect(dueState(task({ dueDate: null }), today)).toBe('none');
    expect(dueState(task({ dueDate: '2026-11-01', completed: true }), today)).toBe('none');
  });
});
