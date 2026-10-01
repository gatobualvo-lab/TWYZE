// Generic offline write queue for simple single-table "recording" forms
// (general expenses, wholesale/supplier sales, ad spend, new inventory
// items). Sales keep their own queue (offlineSalesQueue.ts) since a sale
// is a multi-table write with an inventory-decrement side effect that
// doesn't fit this generic shape; this covers everything else that's just
// "insert one row, retry with upsert later."

import { isNetworkError } from './networkError';
export { isNetworkError };

const STORAGE_KEY = 'trackwyze_offline_write_queue';

export type OfflineWriteKind = 'general_expense' | 'supplier_sale' | 'ad_expense' | 'inventory_item';

export interface QueuedWriteRecord {
  id: string;
  kind: OfflineWriteKind;
  /** Table the payload replays into via `.upsert()`, keyed on `payload.id`. */
  table: string;
  payload: Record<string, unknown>;
  /** Short human-readable description shown if a pending entry needs review. */
  label: string;
  queuedAt: string;
}

function readQueue(): QueuedWriteRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWriteRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function listQueuedWrites(): QueuedWriteRecord[] {
  return readQueue();
}

export function enqueueWrite(record: Omit<QueuedWriteRecord, 'queuedAt'>): void {
  const queue = readQueue();
  queue.push({ ...record, queuedAt: new Date().toISOString() });
  writeQueue(queue);
}

export function removeQueuedWrite(id: string): void {
  writeQueue(readQueue().filter(r => r.id !== id));
}
