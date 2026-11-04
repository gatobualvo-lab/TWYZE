import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui';
import { acceptTeamInvite, declineTeamInvite, listMyTeamInvites, SECTION_LABELS } from '../../services/team/teamService';
import type { TeamInvite } from '../../services/team/teamService';

/**
 * Shows pending team invites addressed to the signed-in user and lets them accept or decline.
 * Joining a team moves the account's data view to the inviting business, so it must be the
 * user's own explicit choice: nothing here runs without a click.
 */
export function TeamInvitesBanner() {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listMyTeamInvites().then(setInvites).catch(() => setInvites([]));
  }, []);

  if (invites.length === 0) return null;

  const accept = async (invite: TeamInvite) => {
    if (!confirm(`Join ${invite.businessName} as staff? While you are on their team you will work on their records, not your own.`)) return;
    setBusyId(invite.id);
    try {
      await acceptTeamInvite(invite.id);
      toast.success(`You joined ${invite.businessName}`);
      // Every screen resolves the account's role on mount, so reload to switch to the team view.
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept the invite');
      setBusyId(null);
    }
  };

  const decline = async (invite: TeamInvite) => {
    setBusyId(invite.id);
    try {
      await declineTeamInvite(invite.id);
      setInvites(current => current.filter(i => i.id !== invite.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline the invite');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      {invites.map(invite => (
        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong>{invite.businessName}</strong> invited you to join their team
              {invite.permissions.length > 0 && <> with access to {invite.permissions.map(p => SECTION_LABELS[p] ?? p).join(', ')}</>}.
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" disabled={busyId !== null} onClick={() => decline(invite)}>
              Decline
            </Button>
            <Button size="sm" loading={busyId === invite.id} disabled={busyId !== null} onClick={() => accept(invite)}>
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
