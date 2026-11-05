import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusinessTask } from '../../services/tasks/taskService';
import { toISODate } from '../../utils/dateRange';
import { buildAttentionRows } from './NeedsAttention';

const task = (over: Partial<BusinessTask>): BusinessTask => ({
  id: 't1', title: 'Task', taskType: 'general', completed: false, dueDate: null, dueTime: null, remindAt: null, createdAt: null, ...over,
});

const NO_CONDITIONS = { pendingDeliveries: 0, lowStockItems: 0, outstandingCustomers: 0 };
const TODAY = '2026-11-05';

describe('buildAttentionRows', () => {
  it('puts overdue tasks first, then the three conditions in their usual order, then tasks due today', () => {
    const tasks = [
      task({ id: 'today1', title: 'Due today', dueDate: TODAY }),
      task({ id: 'late1', title: 'Overdue task', dueDate: '2026-11-01' }),
    ];
    const rows = buildAttentionRows(tasks, { pendingDeliveries: 2, lowStockItems: 1, outstandingCustomers: 3 }, TODAY);
    expect(rows.map(r => r.id)).toEqual(['task:late1', 'deliveries', 'stock', 'customers', 'task:today1']);
  });

  it('leaves out tasks due later and tasks with no date — they are not "needing attention" today', () => {
    const tasks = [task({ dueDate: '2026-12-25' }), task({ dueDate: null })];
    expect(buildAttentionRows(tasks, NO_CONDITIONS, TODAY)).toEqual([]);
  });

  it('leaves out a finished task even if its date is overdue', () => {
    const tasks = [task({ dueDate: '2026-01-01', completed: true })];
    expect(buildAttentionRows(tasks, NO_CONDITIONS, TODAY)).toEqual([]);
  });

  it('only lists a condition when its count is above zero', () => {
    const rows = buildAttentionRows([], { pendingDeliveries: 0, lowStockItems: 5, outstandingCustomers: 0 }, TODAY);
    expect(rows).toEqual([{ id: 'stock', kind: 'condition', dot: 'red', tab: 'inventory', label: '5 low stock items' }]);
  });

  it('is empty when there is nothing overdue, nothing due today, and no active condition', () => {
    expect(buildAttentionRows([], NO_CONDITIONS, TODAY)).toEqual([]);
  });
});

const mocks = vi.hoisted(() => ({ listTasks: vi.fn(), toggleTaskCompleted: vi.fn() }));
vi.mock('../../services/tasks/taskService', async importOriginal => ({ ...(await importOriginal()), listTasks: mocks.listTasks, toggleTaskCompleted: mocks.toggleTaskCompleted }));

import NeedsAttention from './NeedsAttention';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.toggleTaskCompleted.mockResolvedValue(undefined);
});

describe('NeedsAttention', () => {
  // The component classifies tasks against the real clock, so these use dates relative to "now".
  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));

  it('shows a clear "all good" state when nothing needs attention', async () => {
    mocks.listTasks.mockResolvedValue([]);
    render(<NeedsAttention conditions={NO_CONDITIONS} onNavigate={vi.fn()} />);
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();
  });

  it('mixes an overdue task with the delivery/stock/customer conditions in one list', async () => {
    mocks.listTasks.mockResolvedValue([task({ id: 'late1', title: 'Call the supplier', dueDate: yesterday })]);
    render(<NeedsAttention conditions={{ pendingDeliveries: 1, lowStockItems: 0, outstandingCustomers: 2 }} onNavigate={vi.fn()} />);
    expect(await screen.findByText('Call the supplier')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('1 pending delivery')).toBeInTheDocument();
    expect(screen.getByText('2 customers with outstanding balance')).toBeInTheDocument();
  });

  it('ticking a task off removes it from the list, not just marks it', async () => {
    // A stateful mock, so the reload NeedsAttention triggers after completing a task sees the
    // change — the same as the real database would, once toggleTaskCompleted has actually run.
    let current: BusinessTask[] = [task({ id: 'late1', title: 'Pay rent', dueDate: yesterday })];
    mocks.listTasks.mockImplementation(() => Promise.resolve(current));
    mocks.toggleTaskCompleted.mockImplementation(async (id: string) => {
      current = current.map(t => (t.id === id ? { ...t, completed: true } : t));
    });
    render(<NeedsAttention conditions={NO_CONDITIONS} onNavigate={vi.fn()} />);
    await screen.findByText('Pay rent');
    await userEvent.click(screen.getByRole('button', { name: 'Mark "Pay rent" as done' }));
    expect(mocks.toggleTaskCompleted).toHaveBeenCalledWith('late1', false);
    await waitFor(() => expect(screen.queryByText('Pay rent')).not.toBeInTheDocument());
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();
  });

  it('a condition row opens its own page; a task row and "View all tasks" open the Tasks page', async () => {
    mocks.listTasks.mockResolvedValue([task({ id: 'today1', title: 'Restock sugar', dueDate: today })]);
    const onNavigate = vi.fn();
    render(<NeedsAttention conditions={{ pendingDeliveries: 0, lowStockItems: 3, outstandingCustomers: 0 }} onNavigate={onNavigate} />);
    await screen.findByText('Restock sugar');

    await userEvent.click(screen.getByText('3 low stock items'));
    expect(onNavigate).toHaveBeenCalledWith('inventory');

    await userEvent.click(screen.getByText('Restock sugar'));
    expect(onNavigate).toHaveBeenCalledWith('tasks');

    await userEvent.click(screen.getByRole('button', { name: /View all tasks/ }));
    expect(onNavigate).toHaveBeenCalledWith('tasks');
  });
});
