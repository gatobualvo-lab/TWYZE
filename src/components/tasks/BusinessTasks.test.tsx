import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusinessTask } from '../../services/tasks/taskService';

const service = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  toggleTaskCompleted: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock('../../services/tasks/taskService', () => service);
vi.mock('../../services/tasks/useTaskReminders', () => ({ ensureNotificationPermission: vi.fn() }));

import BusinessTasks, { dueState, sortTasks } from './BusinessTasks';
import { notifyTasksChanged } from '../../services/tasks/taskEvents';

const task = (over: Partial<BusinessTask>): BusinessTask => ({
  id: 'x', title: 'Task', taskType: 'general', completed: false, dueDate: null, dueTime: null, remindAt: null, createdAt: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  service.toggleTaskCompleted.mockResolvedValue(undefined);
  service.deleteTask.mockResolvedValue(undefined);
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

describe('BusinessTasks', () => {
  it('on the dashboard card, offers a link to the full page', async () => {
    service.listTasks.mockResolvedValue([task({ id: '1', title: 'Call supplier' })]);
    const onViewAll = vi.fn();
    render(<BusinessTasks variant="card" onViewAll={onViewAll} />);
    expect(await screen.findByText('Call supplier')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /View all/ }));
    expect(onViewAll).toHaveBeenCalled();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('on the page, filters between to do, done and all', async () => {
    service.listTasks.mockResolvedValue([
      task({ id: '1', title: 'Open one' }),
      task({ id: '2', title: 'Finished one', completed: true }),
    ]);
    render(<BusinessTasks variant="page" />);
    expect(await screen.findByText('Open one')).toBeInTheDocument();
    expect(screen.queryByText('Finished one')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Done (1)' }));
    expect(screen.getByText('Finished one')).toBeInTheDocument();
    expect(screen.queryByText('Open one')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'All (2)' }));
    expect(screen.getByText('Open one')).toBeInTheDocument();
    expect(screen.getByText('Finished one')).toBeInTheDocument();
  });

  it('adds a task, and ticks one off', async () => {
    service.listTasks.mockResolvedValue([task({ id: '1', title: 'Existing' })]);
    service.createTask.mockResolvedValue(task({ id: '2', title: 'Restock sugar' }));
    render(<BusinessTasks variant="page" />);
    await screen.findByText('Existing');

    await userEvent.type(screen.getByLabelText('New task'), 'Restock sugar{Enter}');
    expect(service.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Restock sugar', taskType: 'general' }));
    expect(await screen.findByText('Restock sugar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark "Existing" as done' }));
    expect(service.toggleTaskCompleted).toHaveBeenCalledWith('1', false);
  });

  it('puts the task back if it could not be deleted', async () => {
    service.listTasks.mockResolvedValue([task({ id: '1', title: 'Keep me' })]);
    service.deleteTask.mockRejectedValue(new Error('offline'));
    render(<BusinessTasks variant="page" />);
    await screen.findByText('Keep me');
    await userEvent.click(screen.getByRole('button', { name: 'Delete "Keep me"' }));
    expect(await screen.findByText('Keep me')).toBeInTheDocument();
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

describe('BusinessTasks and the calendar', () => {
  it('offers "show on calendar" only for tasks that have a day, and opens that day', async () => {
    service.listTasks.mockResolvedValue([
      task({ id: '1', title: 'Pay the supplier', dueDate: '2026-11-12' }),
      task({ id: '2', title: 'Someday' }),
    ]);
    const openCalendar = vi.fn();
    render(<BusinessTasks variant="page" onOpenCalendar={openCalendar} />);
    await screen.findByText('Pay the supplier');
    expect(screen.queryByRole('button', { name: 'Show "Someday" on the calendar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show "Pay the supplier" on the calendar' }));
    expect(openCalendar).toHaveBeenCalledWith('2026-11-12');
  });

  it('has no calendar button on a plan without the calendar', async () => {
    service.listTasks.mockResolvedValue([task({ id: '1', title: 'Pay the supplier', dueDate: '2026-11-12' })]);
    render(<BusinessTasks variant="page" />);
    await screen.findByText('Pay the supplier');
    expect(screen.queryByRole('button', { name: /on the calendar/ })).not.toBeInTheDocument();
  });

  it('keeps the dashboard box small: the date, time and reminder options open on request', async () => {
    service.listTasks.mockResolvedValue([]);
    render(<BusinessTasks variant="card" onViewAll={() => {}} />);
    await screen.findByText('No tasks yet.');
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Date, time and reminder options' }));
    expect(screen.getByLabelText('Due date')).toBeInTheDocument();
    expect(screen.getByLabelText('Reminder')).toBeInTheDocument();
  });

  it('refreshes when a task changes somewhere else, but not for its own change', async () => {
    service.listTasks.mockResolvedValue([task({ id: '1', title: 'First' })]);
    render(<BusinessTasks variant="page" />);
    await screen.findByText('First');
    expect(service.listTasks).toHaveBeenCalledTimes(1);

    service.listTasks.mockResolvedValue([task({ id: '1', title: 'First' }), task({ id: '2', title: 'Added in the calendar' })]);
    notifyTasksChanged(); // from another page
    expect(await screen.findByText('Added in the calendar')).toBeInTheDocument();
    expect(service.listTasks).toHaveBeenCalledTimes(2);
  });
});
