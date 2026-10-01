import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enqueueWrite, listQueuedWrites } from '../services/offline/offlineQueue';

const upsertMock = vi.fn();
const fromMock = vi.fn((_table: string) => ({ upsert: upsertMock }));

vi.mock('../utils/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({ error: null });
});

describe('useOfflineWriteSync', () => {
  it('replays a queued write on mount and clears it once synced', async () => {
    enqueueWrite({
      id: 'expense-1',
      kind: 'general_expense',
      table: 'general_expenses',
      payload: { id: 'expense-1', amount: 500 },
      label: 'Rent — KES 500',
    });

    const { useOfflineWriteSync } = await import('./useOfflineWriteSync');
    const { result } = renderHook(() => useOfflineWriteSync());

    await waitFor(() => expect(listQueuedWrites()).toHaveLength(0));

    expect(fromMock).toHaveBeenCalledWith('general_expenses');
    expect(upsertMock).toHaveBeenCalledWith({ id: 'expense-1', amount: 500 });
    expect(toastSuccess).toHaveBeenCalledWith('Offline entry synced');
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
  });

  it('replays multiple queued writes of different kinds independently', async () => {
    enqueueWrite({
      id: 'expense-1',
      kind: 'general_expense',
      table: 'general_expenses',
      payload: { id: 'expense-1' },
      label: 'Rent',
    });
    enqueueWrite({
      id: 'sale-1',
      kind: 'supplier_sale',
      table: 'suppliers',
      payload: { id: 'sale-1' },
      label: 'Client — Product',
    });

    const { useOfflineWriteSync } = await import('./useOfflineWriteSync');
    renderHook(() => useOfflineWriteSync());

    await waitFor(() => expect(listQueuedWrites()).toHaveLength(0));
    expect(fromMock).toHaveBeenCalledWith('general_expenses');
    expect(fromMock).toHaveBeenCalledWith('suppliers');
    expect(toastSuccess).toHaveBeenCalledWith('2 offline entries synced');
  });

  it('leaves a still-failing replay in the queue instead of dropping it', async () => {
    upsertMock.mockResolvedValue({ error: new TypeError('Failed to fetch') });
    enqueueWrite({
      id: 'expense-1',
      kind: 'general_expense',
      table: 'general_expenses',
      payload: { id: 'expense-1' },
      label: 'Rent',
    });

    const { useOfflineWriteSync } = await import('./useOfflineWriteSync');
    const { result } = renderHook(() => useOfflineWriteSync());

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(listQueuedWrites()).toHaveLength(1);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
