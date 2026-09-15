import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enqueueSale, listQueuedSales, markProductDecremented } from '../services/offline/offlineSalesQueue';

const upsertSalesMock = vi.fn();
const upsertItemsMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === 'sales') return { upsert: upsertSalesMock };
  if (table === 'sale_items') return { upsert: upsertItemsMock };
  throw new Error(`unexpected table ${table}`);
});

vi.mock('../utils/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  upsertSalesMock.mockResolvedValue({ error: null });
  upsertItemsMock.mockResolvedValue({ error: null });
  rpcMock.mockResolvedValue({ error: null });
});

describe('useOfflineSalesSync', () => {
  it('replays a queued sale on mount and clears it once synced', async () => {
    enqueueSale({
      saleId: 'sale-1',
      saleData: { id: 'sale-1' },
      saleItemsData: [{ id: 'item-1', sale_id: 'sale-1' }],
      decrementTargets: [{ productName: 'Widget', quantity: 2 }],
    });

    const { useOfflineSalesSync } = await import('./useOfflineSalesSync');
    const { result } = renderHook(() => useOfflineSalesSync());

    await waitFor(() => expect(listQueuedSales()).toHaveLength(0));

    expect(upsertSalesMock).toHaveBeenCalledWith({ id: 'sale-1' });
    expect(upsertItemsMock).toHaveBeenCalledWith([{ id: 'item-1', sale_id: 'sale-1' }]);
    expect(rpcMock).toHaveBeenCalledWith('decrement_inventory_stock', { p_product_name: 'Widget', p_quantity: 2 });
    expect(toastSuccess).toHaveBeenCalledWith('Offline sale synced');
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
  });

  it('only decrements products not already marked as decremented on a resumed replay', async () => {
    enqueueSale({
      saleId: 'sale-2',
      saleData: { id: 'sale-2' },
      saleItemsData: [{ id: 'item-2', sale_id: 'sale-2' }],
      decrementTargets: [
        { productName: 'Widget', quantity: 1 },
        { productName: 'Gadget', quantity: 1 },
      ],
    });
    markProductDecremented('sale-2', 'Widget');

    const { useOfflineSalesSync } = await import('./useOfflineSalesSync');
    renderHook(() => useOfflineSalesSync());

    await waitFor(() => expect(listQueuedSales()).toHaveLength(0));

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('decrement_inventory_stock', { p_product_name: 'Gadget', p_quantity: 1 });
  });

  it('only decrements inventory for goods items in a mixed goods+service sale', async () => {
    // decrementTargets is built by MultiProductSalesForm.tsx already
    // filtered to goods-only — this confirms replay only ever acts on what
    // that array actually lists, regardless of what saleItemsData contains.
    enqueueSale({
      saleId: 'sale-4',
      saleData: { id: 'sale-4' },
      saleItemsData: [
        { id: 'item-4a', sale_id: 'sale-4', item_type: 'goods', product_name: 'Widget' },
        { id: 'item-4b', sale_id: 'sale-4', item_type: 'service', product_name: 'Haircut' },
      ],
      decrementTargets: [{ productName: 'Widget', quantity: 1 }],
    });

    const { useOfflineSalesSync } = await import('./useOfflineSalesSync');
    renderHook(() => useOfflineSalesSync());

    await waitFor(() => expect(listQueuedSales()).toHaveLength(0));

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('decrement_inventory_stock', { p_product_name: 'Widget', p_quantity: 1 });
  });

  it('leaves a still-failing replay in the queue instead of dropping it', async () => {
    upsertSalesMock.mockResolvedValue({ error: new TypeError('Failed to fetch') });
    enqueueSale({
      saleId: 'sale-3',
      saleData: { id: 'sale-3' },
      saleItemsData: [],
      decrementTargets: [],
    });

    const { useOfflineSalesSync } = await import('./useOfflineSalesSync');
    const { result } = renderHook(() => useOfflineSalesSync());

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(listQueuedSales()).toHaveLength(1);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
