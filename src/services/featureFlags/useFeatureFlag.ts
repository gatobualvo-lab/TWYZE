import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';

// First end-user consumer of the feature_flags table — until now only the
// admin Feature Flags tab read it (src/services/admin/adminService.ts). RLS
// already permits any authenticated user to SELECT, so this is a plain read.

export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.from('feature_flags').select('enabled').eq('key', key).maybeSingle();
      if (!cancelled) {
        setEnabled(data?.enabled === true);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [key]);

  return { enabled, loading };
}
