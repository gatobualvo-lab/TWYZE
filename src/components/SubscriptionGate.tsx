import React from 'react';
import { Lock } from 'lucide-react';
import { EmptyState, Button } from './ui';
import type { AccessLevel } from '../services/subscription/subscriptionLapseService';

/**
 * Wraps a creation-flow screen (Add Sale, Add Supplier, etc.). It shows the real form normally, and
 * an explanation instead when an admin has suspended the account. (An ended subscription is not
 * view-only any more: the account continues on the Free plan, whose limits are handled by LimitGate
 * and TabGate in components/subscription/Gates.tsx.)
 */
export const RestrictedFeatureGate: React.FC<{ accessLevel: AccessLevel; onNavigate: (tab: string) => void; children: React.ReactNode }> = ({ accessLevel, onNavigate, children }) => {
  if (accessLevel !== 'restricted') return <>{children}</>;

  return (
    <EmptyState
      icon={Lock}
      title="This account is suspended"
      description="You can still view your existing data, but adding or editing records is paused. Please contact support to restore full access."
      action={<Button onClick={() => onNavigate('account')}>Open account</Button>}
    />
  );
};
