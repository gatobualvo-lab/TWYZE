import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

// Dismissal follows the same localStorage convention as useDownloadReminder
// — this is low-stakes UI state, not worth a schema change for.
const DISMISS_KEY = 'trackwyze_onboarding_dismissed';

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  actionTab: string;
}

export function useOnboardingChecklist(): { steps: OnboardingStep[]; loading: boolean; dismissed: boolean; dismiss: () => void } {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');

  useEffect(() => {
    if (dismissed) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [inventoryRes, salesRes, settingsRes] = await Promise.all([
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('sales').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('business_settings').select('business_name').eq('user_id', user.id).maybeSingle(),
      ]);

      const nextSteps: OnboardingStep[] = [
        { id: 'add-product', label: 'Add your first product to inventory', done: (inventoryRes.count ?? 0) > 0, actionTab: 'inventory' },
        { id: 'record-sale', label: 'Record your first sale', done: (salesRes.count ?? 0) > 0, actionTab: 'add-sale' },
        { id: 'business-details', label: 'Add your business details for invoices & receipts', done: !!settingsRes.data?.business_name, actionTab: 'documents-settings' },
      ];

      setSteps(nextSteps);
      setLoading(false);

      // Auto-dismiss once every step is genuinely done — nothing left to nag about.
      if (nextSteps.every(s => s.done)) {
        localStorage.setItem(DISMISS_KEY, 'true');
        setDismissed(true);
      }
    })();
  }, [dismissed]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return { steps, loading, dismissed, dismiss };
}
