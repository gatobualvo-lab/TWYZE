import { useEffect, useState } from 'react';
import { fetchMyBusinessRole } from './teamService';
import type { BusinessRole } from './teamService';

const DEFAULT_ROLE: BusinessRole = { isStaff: false, permissions: [], restrictToOwnRecords: false, hideFinancialDetails: false };

/**
 * Resolves once per session whether the current login is a business owner or staff.
 * Invites are never accepted here: joining a team is an explicit choice made in TeamInvitesBanner.
 */
export function useBusinessRole(): { role: BusinessRole; loading: boolean } {
  const [role, setRole] = useState<BusinessRole>(DEFAULT_ROLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBusinessRole()
      .then(setRole)
      .catch(() => setRole(DEFAULT_ROLE))
      .finally(() => setLoading(false));
  }, []);

  return { role, loading };
}
