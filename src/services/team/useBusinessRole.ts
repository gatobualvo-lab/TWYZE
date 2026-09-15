import { useEffect, useState } from 'react';
import { claimPendingInvite, fetchMyBusinessRole } from './teamService';
import type { BusinessRole } from './teamService';

const DEFAULT_ROLE: BusinessRole = { isStaff: false, permissions: [], restrictToOwnRecords: false, hideFinancialDetails: false };

/** Resolves once per session whether the current login is a business owner or staff, claiming any pending invite first. */
export function useBusinessRole(): { role: BusinessRole; loading: boolean } {
  const [role, setRole] = useState<BusinessRole>(DEFAULT_ROLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    claimPendingInvite()
      .catch(() => {})
      .finally(() => {
        fetchMyBusinessRole()
          .then(setRole)
          .catch(() => setRole(DEFAULT_ROLE))
          .finally(() => setLoading(false));
      });
  }, []);

  return { role, loading };
}
