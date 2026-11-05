import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusinessTask } from './taskService';

const mocks = vi.hoisted(() => ({
  listDueReminders: vi.fn(),
  toggleTaskCompleted: vi.fn(),
  publishNotification: vi.fn(),
  custom: vi.fn(),
  dismiss: vi.fn(),
  error: vi.fn(),
}));

vi.mock('./taskService', () => ({ listDueReminders: mocks.listDueReminders, toggleTaskCompleted: mocks.toggleTaskCompleted }));
vi.mock('../notifications/notificationService', () => ({ publishNotification: mocks.publishNotification }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { custom: mocks.custom, dismiss: mocks.dismiss, error: mocks.error }) }));

import { useTaskReminders, REMINDER_TOAST_ID } from './useTaskReminders';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const task = (over: Partial<BusinessTask>): BusinessTask => ({
  id: 't1', title: 'Call the supplier', taskType: 'general', completed: false, dueDate: '2026-11-05', dueTime: '10:00', remindAt: hoursAgo(0.1), createdAt: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.publishNotification.mockResolvedValue(undefined);
  mocks.toggleTaskCompleted.mockResolvedValue(undefined);
});

/** Shows what the hook handed to the toast, the way the toaster would. */
const popup = () => {
  const [render_, options] = mocks.custom.mock.calls[0];
  return { ui: render_({ id: 'toast-1', visible: true }), options };
};

describe('useTaskReminders', () => {
  it('raises one pop-up for everything due together, and keeps the bell notifications', async () => {
    mocks.listDueReminders.mockResolvedValue([task({ id: 'a', title: 'Call the supplier' }), task({ id: 'b', title: 'Restock sugar' })]);
    renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.custom).toHaveBeenCalledTimes(1));

    const { ui, options } = popup();
    expect(options.id).toBe(REMINDER_TOAST_ID);
    render(ui);
    expect(screen.getByText('2 reminders')).toBeInTheDocument();
    expect(screen.getByText('Call the supplier')).toBeInTheDocument();
    expect(screen.getByText('Restock sugar')).toBeInTheDocument();

    expect(mocks.publishNotification).toHaveBeenCalledTimes(2);
    expect(mocks.publishNotification).toHaveBeenCalledWith(expect.objectContaining({ actionTab: 'tasks', type: 'task_reminder' }));
  });

  it('can always be closed', async () => {
    mocks.listDueReminders.mockResolvedValue([task({})]);
    renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.custom).toHaveBeenCalled());
    render(popup().ui);
    await userEvent.click(screen.getByRole('button', { name: 'Close reminder' }));
    expect(mocks.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('ticks a reminder off from the pop-up, and closes it after the last one', async () => {
    mocks.listDueReminders.mockResolvedValue([task({ id: 'a', title: 'First' }), task({ id: 'b', title: 'Second' })]);
    renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.custom).toHaveBeenCalled());
    render(popup().ui);

    await userEvent.click(screen.getByRole('button', { name: 'Mark "First" as done' }));
    expect(mocks.toggleTaskCompleted).toHaveBeenCalledWith('a', false);
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(mocks.dismiss).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Mark "Second" as done' }));
    expect(mocks.toggleTaskCompleted).toHaveBeenCalledWith('b', false);
    expect(mocks.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('opens the Tasks page from the pop-up', async () => {
    mocks.listDueReminders.mockResolvedValue([task({})]);
    const openTasks = vi.fn();
    renderHook(() => useTaskReminders(true, openTasks));
    await waitFor(() => expect(mocks.custom).toHaveBeenCalled());
    render(popup().ui);
    await userEvent.click(screen.getByRole('button', { name: 'View tasks' }));
    expect(openTasks).toHaveBeenCalled();
    expect(mocks.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('does not pop up a reminder that was missed for more than a day (the bell still gets it)', async () => {
    mocks.listDueReminders.mockResolvedValue([task({ remindAt: hoursAgo(30) })]);
    renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.publishNotification).toHaveBeenCalled());
    expect(mocks.custom).not.toHaveBeenCalled();
  });

  it('shows each reminder only once', async () => {
    const due = [task({ id: 'a' })];
    mocks.listDueReminders.mockResolvedValue(due);
    const first = renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.custom).toHaveBeenCalledTimes(1));
    first.unmount();

    renderHook(() => useTaskReminders(true));
    await waitFor(() => expect(mocks.listDueReminders).toHaveBeenCalledTimes(2));
    expect(mocks.custom).toHaveBeenCalledTimes(1);
  });
});
