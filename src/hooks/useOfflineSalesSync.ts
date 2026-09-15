import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import {
  listQueuedSales,
  removeQueuedSale,
  markProductDecremented,
  isNetworkError,
  type QueuedSaleRecord,
} from '../services/offline/offlineSalesQueue';

/**
 * `.upsert()` on both tables, keyed on the client-generated ids assembled
 * before the sale ever went offline — safe to retry even after a partial
 * previous attempt (e.g. the sale row landed but the app closed before
 * sale_items did). The inventory decrement is the one non-idempotent step,
 * so it's replayed per-product and marked done individually as it succeeds.
 */
async function replayOne(record: QueuedSaleRecord): Promise<boolean> {
  const { error: saleError } = await supabase.from('sales').upsert(record.saleData as never);
  if (saleError) {
    if (!isNetworkError(saleError)) {
      console.error('Failed to sync offline sale (non-network error), leaving queued for manual review:', saleError);
    }
    return false;
  }

  const { error: itemsError } = await supabase.from('sale_items').upsert(record.saleItemsData as never);
  if (itemsError) {
    if (!isNetworkError(itemsError)) {
      console.error('Failed to sync offline sale items (non-network error), leaving queued for manual review:', itemsError);
    }
    return false;
  }

  for (const target of record.decrementTargets) {
    if (record.decrementedProductNames.includes(target.productName)) continue;
    const { error } = await supabase.rpc('decrement_inventory_stock', {
      p_product_name: target.productName,
      p_quantity: target.quantity,
    });
    if (!error) {
      markProductDecremented(record.saleId, target.productName);
    } else {
      console.error('Error decrementing inventory during offline sync for', target.productName, error);
    }
  }

  removeQueuedSale(record.saleId);
  return true;
}

export function useOfflineSalesSync(): { pendingCount: number } {
  const [pendingCount, setPendingCount] = useState(() => listQueuedSales().length);

  const sync = useCallback(async () => {
    const queue = listQueuedSales();
    if (queue.length === 0) return;

    let synced = 0;
    for (const record of queue) {
      if (await replayOne(record)) synced += 1;
    }

    setPendingCount(listQueuedSales().length);
    if (synced > 0) {
      toast.success(synced === 1 ? 'Offline sale synced' : `${synced} offline sales synced`);
    }
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [sync]);

  return { pendingCount };
}
