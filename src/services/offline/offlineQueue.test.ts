import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueWrite, listQueuedWrites, removeQueuedWrite } from './offlineQueue';

const STORAGE_KEY = 'trackwyze_offline_write_queue';

const baseRecord = {
  id: 'expense-1',
  kind: 'general_expense' as const,
  table: 'general_expenses',
  payload: { id: 'expense-1', amount: 500 },
  label: 'Rent — KES 500',
};

beforeEach(() => {
  localStorage.clear();
});

describe('enqueueWrite / listQueuedWrites', () => {
  it('round-trips a queued write', () => {
    enqueueWrite(baseRecord);

    const queue = listQueuedWrites();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject(baseRecord);
    expect(typeof queue[0].queuedAt).toBe('string');
  });

  it('keeps multiple queued writes of different kinds independent', () => {
    enqueueWrite(baseRecord);
    enqueueWrite({ ...baseRecord, id: 'sale-1', kind: 'supplier_sale', table: 'suppliers', label: 'Client — Product' });

    expect(listQueuedWrites().map(r => r.id)).toEqual(['expense-1', 'sale-1']);
  });
});

describe('removeQueuedWrite', () => {
  it('removes only the matching record', () => {
    enqueueWrite(baseRecord);
    enqueueWrite({ ...baseRecord, id: 'expense-2' });

    removeQueuedWrite('expense-1');

    expect(listQueuedWrites().map(r => r.id)).toEqual(['expense-2']);
  });
});

describe('corrupted localStorage', () => {
  it('does not throw and treats the queue as empty', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => listQueuedWrites()).not.toThrow();
    expect(listQueuedWrites()).toEqual([]);
  });

  it('treats a non-array value as an empty queue', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(listQueuedWrites()).toEqual([]);
  });
});
