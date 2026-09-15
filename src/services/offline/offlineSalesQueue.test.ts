import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueSale,
  listQueuedSales,
  removeQueuedSale,
  markProductDecremented,
  isNetworkError,
} from './offlineSalesQueue';

const STORAGE_KEY = 'trackwyze_offline_sales_queue';

const baseRecord = {
  saleId: 'sale-1',
  saleData: { id: 'sale-1', product_name: 'Widget' },
  saleItemsData: [{ id: 'item-1', sale_id: 'sale-1', product_name: 'Widget' }],
  decrementTargets: [{ productName: 'Widget', quantity: 3 }],
};

beforeEach(() => {
  localStorage.clear();
});

describe('enqueueSale / listQueuedSales', () => {
  it('round-trips a queued sale with an empty decrementedProductNames list', () => {
    enqueueSale(baseRecord);

    const queue = listQueuedSales();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ saleId: 'sale-1', decrementedProductNames: [] });
    expect(typeof queue[0].queuedAt).toBe('string');
  });

  it('keeps multiple queued sales independent', () => {
    enqueueSale(baseRecord);
    enqueueSale({ ...baseRecord, saleId: 'sale-2' });

    expect(listQueuedSales().map(r => r.saleId)).toEqual(['sale-1', 'sale-2']);
  });
});

describe('markProductDecremented', () => {
  it('persists so a second read excludes the already-decremented product', () => {
    enqueueSale(baseRecord);
    markProductDecremented('sale-1', 'Widget');

    const [record] = listQueuedSales();
    expect(record.decrementedProductNames).toEqual(['Widget']);
  });

  it('does not add duplicate entries when called twice for the same product', () => {
    enqueueSale(baseRecord);
    markProductDecremented('sale-1', 'Widget');
    markProductDecremented('sale-1', 'Widget');

    expect(listQueuedSales()[0].decrementedProductNames).toEqual(['Widget']);
  });

  it('is a no-op for a sale id that is not queued', () => {
    enqueueSale(baseRecord);
    markProductDecremented('does-not-exist', 'Widget');

    expect(listQueuedSales()[0].decrementedProductNames).toEqual([]);
  });
});

describe('removeQueuedSale', () => {
  it('removes only the matching record', () => {
    enqueueSale(baseRecord);
    enqueueSale({ ...baseRecord, saleId: 'sale-2' });

    removeQueuedSale('sale-1');

    expect(listQueuedSales().map(r => r.saleId)).toEqual(['sale-2']);
  });
});

describe('corrupted localStorage', () => {
  it('does not throw and treats the queue as empty', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => listQueuedSales()).not.toThrow();
    expect(listQueuedSales()).toEqual([]);
  });

  it('treats a non-array value as an empty queue', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(listQueuedSales()).toEqual([]);
  });
});

describe('isNetworkError', () => {
  it('treats a "Failed to fetch" message as a network error', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('treats a real Postgres error as not a network error', () => {
    expect(isNetworkError({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(false);
  });

  it('treats navigator.onLine === false as a network error regardless of message', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    try {
      expect(isNetworkError({ message: 'some unrelated error' })).toBe(true);
    } finally {
      if (original) Object.defineProperty(window.navigator, 'onLine', original);
    }
  });
});
