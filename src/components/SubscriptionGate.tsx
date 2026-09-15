import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { EmptyState, Button } from './ui';
import type { AccessLevel } from '../services/subscription/subscriptionLapseService';

/** Persistent, hard-to-miss notice shown during the grace period or once restricted. Rendered once, above the page content, in the Dashboard shell. */
export const SubscriptionBanner: React.FC<{ accessLevel: AccessLevel; onNavigate: (tab: string) => void }> = ({ accessLevel, onNavigate }) => {
  if (accessLevel === 'full') return null;

  const isRestricted = accessLevel === 'restricted';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 mb-6 text-sm ${isRestricted ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          {isRestricted
            ? "Your subscription lapsed and the grace period has ended — you can still view your data, but adding or editing records is paused until you renew."
            : 'Your subscription has expired. You have a few days of grace before new records are paused — renew now to keep everything running smoothly.'}
        </span>
      </div>
      <Button size="sm" variant={isRestricted ? 'danger' : 'primary'} onClick={() => onNavigate('payment-management')} className="flex-shrink-0">
        Renew now
      </Button>
    </div>
  );
};

/** Wraps a creation-flow screen (Add Sale, Add Supplier, etc.) — renders the real form when access is full/grace, or a renewal prompt instead of it once restricted. Editing/viewing existing records elsewhere in the app is not gated by this in this pass — see SubscriptionGate's own notes. */
export const RestrictedFeatureGate: React.FC<{ accessLevel: AccessLevel; onNavigate: (tab: string) => void; children: React.ReactNode }> = ({ accessLevel, onNavigate, children }) => {
  if (accessLevel !== 'restricted') return <>{children}</>;

  return (
    <EmptyState
      icon={Lock}
      title="Renew to add new records"
      description="Your account is in view-only mode because your subscription lapsed more than 5 days ago. Your existing data is safe and visible — renewing restores full access immediately."
      action={<Button onClick={() => onNavigate('payment-management')}>Renew subscription</Button>}
    />
  );
};
