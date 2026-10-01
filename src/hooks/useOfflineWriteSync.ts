import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import {
  listQueuedWrites,
  removeQueuedWrite,
  isNetworkError,
  type QueuedWriteRecord,
} from '../services/offline/offlineQueue';

async function replayOne(record: QueuedWriteRecord): Promise<boolean> {
  // `record.table` is a dynamic string — the generated Database types only
  // accept its known table-name union, so this one call needs an escape
  // hatch (same pattern already unavoidable in utils/security.ts).
  const { error } = await supabase.from(record.table as never).upsert(record.payload as never);
  if (error) {
    if (!isNetworkError(error)) {
      console.error(`Failed to sync offline ${record.kind} (non-network error), leaving queued for manual review:`, error);
    }
    return false;
  }
  removeQueuedWrite(record.id);
  return true;
}

export function useOfflineWriteSync(): { pendingCount: number } {
  const [pendingCount, setPendingCount] = useState(() => listQueuedWrites().length);

  const sync = useCallback(async () => {
    const queue = listQueuedWrites();
    if (queue.length === 0) return;

    let synced = 0;
    for (const record of queue) {
      if (await replayOne(record)) synced += 1;
    }

    setPendingCount(listQueuedWrites().length);
    if (synced > 0) {
      toast.success(synced === 1 ? 'Offline entry synced' : `${synced} offline entries synced`);
    }
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [sync]);

  return { pendingCount };
}
