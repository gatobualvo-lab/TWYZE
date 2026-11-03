import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { periodFor } from '../utils/period';
import {
  checkLimit,
  resolveEntitlements,
  tierIncludes,
  type Entitlements,
  type Feature,
  type LimitCheck,
  type LimitedResource,
  type SubscriptionProfile,
  type Tier,
} from '../services/subscription/entitlements';
import { setTierSnapshot } from '../services/subscription/tierSnapshot';

type CountedResource = Exclude<LimitedResource, 'users'>;

interface EntitlementsValue {
  entitlements: Entitlements;
  tier: Tier;
  /** Whether the account's tier includes a feature. */
  has: (feature: Feature) => boolean;
  /** Whether one more sale / product / customer can be added right now. */
  limit: (resource: CountedResource) => LimitCheck;
  /** Re-counts what has been used (cheap; only does anything on the Free tier). */
  refreshUsage: (force?: boolean) => Promise<void>;
  /** Opens the plans screen. */
  goToPlans: () => void;
}

// Outside the provider (an isolated component, a test) nothing is locked.
const OPEN: EntitlementsValue = {
  entitlements: { tier: 'business', source: 'paid', freeMonthDaysLeft: null, paidUntil: null, suspended: false },
  tier: 'business',
  has: () => true,
  limit: (resource) => checkLimit('business', resource, 0),
  refreshUsage: async () => {},
  goToPlans: () => {},
};

const EntitlementsContext = createContext<EntitlementsValue>(OPEN);

type Usage = Partial<Record<CountedResource, number>>;
const REFRESH_EVERY_MS = 15000;

async function countUsage(): Promise<Usage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const monthStart = periodFor('month').start;
  const head = { count: 'exact' as const, head: true };

  const [sales, products, customers] = await Promise.all([
    supabase.from('sales').select('id', head).eq('user_id', user.id).eq('is_deleted', false).gte('date', monthStart),
    supabase.from('inventory_items').select('id', head).eq('user_id', user.id).eq('is_deleted', false).or('item_type.is.null,item_type.neq.service'),
    supabase.from('customers').select('id', head).eq('user_id', user.id),
  ]);
  return { sales: sales.count ?? 0, products: products.count ?? 0, customers: customers.count ?? 0 };
}

export function EntitlementsProvider({
  profile,
  onNavigate,
  activeTab,
  children,
}: {
  profile: SubscriptionProfile | null | undefined;
  onNavigate: (tab: string) => void;
  /** The page the user is on; usage is re-counted when it changes. */
  activeTab?: string;
  children: ReactNode;
}) {
  const entitlements = useMemo(
    () => resolveEntitlements(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.subscription_status, profile?.subscription_expiry, profile?.trial_end_date, profile?.current_billing_cycle]
  );
  const { tier } = entitlements;
  const [usage, setUsage] = useState<Usage>({});
  const lastCount = useRef(0);

  useEffect(() => {
    setTierSnapshot(tier);
  }, [tier]);

  const refreshUsage = useCallback(
    async (force = false) => {
      if (tier !== 'free') return; // only the Free tier has caps worth counting
      if (!force && Date.now() - lastCount.current < REFRESH_EVERY_MS) return;
      lastCount.current = Date.now();
      try {
        setUsage(await countUsage());
      } catch {
        // an unknown count never blocks anything
      }
    },
    [tier]
  );

  useEffect(() => {
    lastCount.current = 0;
    if (tier === 'free') refreshUsage(true);
  }, [tier, refreshUsage]);

  useEffect(() => {
    refreshUsage();
  }, [activeTab, refreshUsage]);

  const value = useMemo<EntitlementsValue>(
    () => ({
      entitlements,
      tier,
      has: (feature) => tierIncludes(tier, feature),
      limit: (resource) => checkLimit(tier, resource, usage[resource] ?? 0),
      refreshUsage,
      goToPlans: () => onNavigate('payment-management'),
    }),
    [entitlements, tier, usage, refreshUsage, onNavigate]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntitlements(): EntitlementsValue {
  return useContext(EntitlementsContext);
}
