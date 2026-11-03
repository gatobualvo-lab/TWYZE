import type { ReactNode } from 'react';
import { AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { Button, EmptyState } from '../ui';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import {
  FEATURE_MIN_TIER,
  FEATURE_NAMES,
  TIER_LABELS,
  TIER_PRICES,
  tierToLiftLimit,
  type Feature,
  type LimitedResource,
  type Tier,
} from '../../services/subscription/entitlements';

const money = (n: number) => `KES ${n.toLocaleString('en-US')}`;

export const RESOURCE_WORDS: Record<LimitedResource, { one: string; many: string; per: string }> = {
  sales: { one: 'sale', many: 'sales', per: 'a month' },
  products: { one: 'product', many: 'products', per: '' },
  customers: { one: 'customer', many: 'customers', per: '' },
  users: { one: 'user', many: 'users', per: '' },
};

/** "Upgrade to Starter (KES 500/month)" */
export const upgradeLabel = (tier: Tier) => `Upgrade to ${TIER_LABELS[tier]}`;

export function UpgradePrompt({
  title,
  description,
  tier,
  onUpgrade,
}: {
  title: string;
  description: ReactNode;
  tier: Tier;
  onUpgrade: () => void;
}) {
  return (
    <EmptyState
      icon={Lock}
      title={title}
      description={
        <>
          {description}{' '}
          <span className="block mt-2 text-gray-500">
            {TIER_LABELS[tier]} is {money(TIER_PRICES[tier])} a month. Everything you have already added stays exactly as it is.
          </span>
        </>
      }
      action={<Button onClick={onUpgrade}>{upgradeLabel(tier)}</Button>}
    />
  );
}

/** Shows a whole page only when the account's tier includes it; otherwise explains what to upgrade to. */
export function TabGate({ id, children }: { id: string; children: ReactNode }) {
  const { has, goToPlans } = useEntitlements();
  if (!(id in FEATURE_MIN_TIER)) return <>{children}</>;
  const feature = id as Feature;
  if (has(feature)) return <>{children}</>;
  const tier = FEATURE_MIN_TIER[feature];
  return (
    <UpgradePrompt
      tier={tier}
      onUpgrade={goToPlans}
      title={`${FEATURE_NAMES[feature]} is on the ${TIER_LABELS[tier]} plan`}
      description={`Upgrade to ${TIER_LABELS[tier]} to use ${FEATURE_NAMES[feature].toLowerCase()}.`}
    />
  );
}

/** Wraps a screen that adds sales, products or customers: once the Free cap is reached, it explains instead. */
export function LimitGate({ resource, children }: { resource: Exclude<LimitedResource, 'users'>; children: ReactNode }) {
  const { limit, tier, goToPlans } = useEntitlements();
  const check = limit(resource);
  if (check.allowed) return <>{children}</>;
  const words = RESOURCE_WORDS[resource];
  const next = tierToLiftLimit(tier, resource);
  return (
    <UpgradePrompt
      tier={next}
      onUpgrade={goToPlans}
      title="You've reached the Free plan limit"
      description={`The Free plan includes up to ${check.limit} ${words.many}${words.per ? ` ${words.per}` : ''}, and you have ${check.used}. ${
        resource === 'sales' ? 'The count starts again on the 1st of next month, or upgrade for unlimited sales.' : `Upgrade for unlimited ${words.many}.`
      }`}
    />
  );
}

/** A smaller version of the upgrade message, for one locked section inside a page that otherwise works. */
export function LockedSection({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { has, goToPlans } = useEntitlements();
  if (has(feature)) return <>{children}</>;
  const tier = FEATURE_MIN_TIER[feature];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <Lock className="w-5 h-5 mt-0.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold text-gray-900">{FEATURE_NAMES[feature]} is on the {TIER_LABELS[tier]} plan</p>
          <p className="text-sm text-gray-600 mt-0.5">
            Your documents use the standard TrackWyze look until you upgrade. {TIER_LABELS[tier]} is {money(TIER_PRICES[tier])} a month, and anything you set up is kept.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={goToPlans}>{upgradeLabel(tier)}</Button>
    </div>
  );
}

/** A short line under an "Add" button on the Free plan, e.g. "12 of 20 products used". */
export function LimitMeter({ resource }: { resource: Exclude<LimitedResource, 'users'> }) {
  const { limit } = useEntitlements();
  const check = limit(resource);
  if (check.limit === null) return null;
  const words = RESOURCE_WORDS[resource];
  const nearing = check.remaining !== null && check.remaining <= Math.max(2, Math.floor(check.limit * 0.2));
  if (check.used > check.limit) {
    return (
      <p className="text-xs text-amber-700 font-medium">
        You have {check.used} {words.many}; the Free plan includes {check.limit}{words.per ? ` ${words.per}` : ''}
      </p>
    );
  }
  return (
    <p className={`text-xs ${nearing ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
      {check.used} of {check.limit} {words.many}
      {words.per ? ` ${words.per}` : ''} used on the Free plan
    </p>
  );
}

/** A small "Starter" / "Business" pill next to something locked. */
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-800">
      <Lock className="w-2.5 h-2.5" aria-hidden="true" />
      {TIER_LABELS[tier]}
    </span>
  );
}

/** The one banner at the top of the app: the free-month countdown, or a suspended account. */
export function PlanBanner({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { entitlements } = useEntitlements();

  if (entitlements.suspended) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 mb-6 text-sm text-red-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        Your account has been suspended. You can view your data, but adding or editing records is paused. Please contact support.
      </div>
    );
  }

  if (entitlements.source === 'free-month' && entitlements.freeMonthDaysLeft !== null && entitlements.freeMonthDaysLeft <= 10) {
    const days = entitlements.freeMonthDaysLeft;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4 mb-6 text-sm text-accent-900">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>
            Your free month ends in <strong>{days} day{days === 1 ? '' : 's'}</strong>. After that you can stay on the Free plan, or choose Starter or Business to keep every feature.
          </span>
        </div>
        <Button size="sm" onClick={() => onNavigate('payment-management')} className="flex-shrink-0">
          See plans
        </Button>
      </div>
    );
  }
  return null;
}
