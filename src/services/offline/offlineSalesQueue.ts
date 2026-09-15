// Offline queue for the sale-recording flow only (see plan: Offline Sale
// Recording). A shopkeeper's connection can drop mid-sale — this lets the
// sale be captured locally and replayed once the connection returns,
// instead of the data being lost. Deliberately scoped to sales; the app has
// no shared data-access layer, so generalizing this to every write path
// would be a much larger undertaking than what was actually asked for.

const STORAGE_KEY = 'trackwyze_offline_sales_queue';

export interface DecrementTarget {
  productName: string;
  quantity: number;
}

export interface QueuedSaleRecord {
  saleId: string;
  saleData: Record<string, unknown>;
  saleItemsData: Record<string, unknown>[];
  decrementTargets: DecrementTarget[];
  decrementedProductNames: string[];
  queuedAt: string;
}

function readQueue(): QueuedSaleRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted/unparseable value shouldn't crash the app — treat as empty.
    return [];
  }
}

function writeQueue(queue: QueuedSaleRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function listQueuedSales(): QueuedSaleRecord[] {
  return readQueue();
}

export function enqueueSale(record: Omit<QueuedSaleRecord, 'decrementedProductNames' | 'queuedAt'>): void {
  const queue = readQueue();
  queue.push({ ...record, decrementedProductNames: [], queuedAt: new Date().toISOString() });
  writeQueue(queue);
}

export function removeQueuedSale(saleId: string): void {
  writeQueue(readQueue().filter(r => r.saleId !== saleId));
}

/** Persists that a product's inventory decrement has already been applied for this queued sale, so a later replay (even after an app restart) doesn't double-decrement it. */
export function markProductDecremented(saleId: string, productName: string): void {
  const queue = readQueue();
  const record = queue.find(r => r.saleId === saleId);
  if (!record) return;
  if (!record.decrementedProductNames.includes(productName)) {
    record.decrementedProductNames.push(productName);
    writeQueue(queue);
  }
}

/**
 * Heuristic for "this failed because there's no connection" vs. a real
 * validation/business error. Supabase-js doesn't throw on a fetch failure —
 * it resolves with an error object carrying the underlying fetch/TypeError
 * message and no real Postgres error code, which is what these patterns
 * target.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error);
  return /failed to fetch|network ?error|load failed|err_internet_disconnected|err_network|err_connection/i.test(message);
}
