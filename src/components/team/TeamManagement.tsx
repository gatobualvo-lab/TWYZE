import React, { useEffect, useState } from 'react';
import { Users, Plus, X, Clock, CheckCircle2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listTeamMembers, inviteTeamMember, updateMemberSettings, revokeTeamMember,
  PERMISSION_SECTIONS, SECTION_LABELS,
} from '../../services/team/teamService';
import type { TeamMember, PermissionSection } from '../../services/team/teamService';
import { formatDate } from '../../utils/format';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

const PermissionToggles: React.FC<{ selected: PermissionSection[]; onChange: (next: PermissionSection[]) => void }> = ({ selected, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {PERMISSION_SECTIONS.map(section => {
      const active = selected.includes(section);
      return (
        <button
          key={section}
          type="button"
          onClick={() => onChange(active ? selected.filter(s => s !== section) : [...selected, section])}
          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all duration-150 active:scale-95 ${
            active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {SECTION_LABELS[section]}
        </button>
      );
    })}
  </div>
);

const SettingSwitch: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label, description, checked, onChange,
}) => (
  <label className="flex items-start justify-between gap-3 cursor-pointer py-1.5">
    <span className="min-w-0">
      <span className="block text-sm text-gray-700">{label}</span>
      <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
    </span>
    <span
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-150 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </span>
  </label>
);

const MemberRow: React.FC<{ member: TeamMember; onChanged: () => void }> = ({ member, onChanged }) => {
  const [permissions, setPermissions] = useState<PermissionSection[]>(member.permissions);
  const [restrictToOwnRecords, setRestrictToOwnRecords] = useState(member.restrictToOwnRecords);
  const [hideFinancialDetails, setHideFinancialDetails] = useState(member.hideFinancialDetails);
  const [saving, setSaving] = useState(false);

  const save = async (updates: Parameters<typeof updateMemberSettings>[1]) => {
    setSaving(true);
    try {
      await updateMemberSettings(member.id, updates);
    } catch {
      toast.error('Failed to save changes');
      setPermissions(member.permissions);
      setRestrictToOwnRecords(member.restrictToOwnRecords);
      setHideFinancialDetails(member.hideFinancialDetails);
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionsChange = (next: PermissionSection[]) => {
    setPermissions(next);
    save({ permissions: next });
  };

  const handleRevoke = async () => {
    if (!confirm(`Remove ${member.invitedEmail} from your team?`)) return;
    try {
      await revokeTeamMember(member.id);
      toast.success('Access revoked');
      onChanged();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-shadow hover:shadow-md animate-slide-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-medium text-gray-900">{member.invitedEmail}</p>
          <span className={`inline-flex items-center gap-1 text-xs mt-0.5 ${member.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
            {member.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {member.status === 'active' ? `Joined ${formatDate(member.acceptedAt)}` : 'Invited — waiting for them to sign up or log in'}
          </span>
        </div>
        <button onClick={handleRevoke} className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors" aria-label="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-1.5">Can access:</p>
      <PermissionToggles selected={permissions} onChange={handlePermissionsChange} />

      <div className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-50">
        <SettingSwitch
          label="Only their own records"
          description="They'll only see and edit records they personally entered, not the whole business's."
          checked={restrictToOwnRecords}
          onChange={v => { setRestrictToOwnRecords(v); save({ restrictToOwnRecords: v }); }}
        />
        <SettingSwitch
          label="Can see buying price & profit"
          description="Off by default — they can still record a sale, just without seeing what it cost or the margin."
          checked={!hideFinancialDetails}
          onChange={v => { setHideFinancialDetails(!v); save({ hideFinancialDetails: !v }); }}
        />
      </div>
      <p className="text-xs text-gray-300 mt-2">They can never delete records — only you can.</p>
      {saving && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
    </div>
  );
};

const TeamManagement: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<PermissionSection[]>([]);
  const [restrictToOwnRecords, setRestrictToOwnRecords] = useState(true);
  const [hideFinancialDetails, setHideFinancialDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listTeamMembers().then(setMembers).catch(() => setMembers([])); };
  useEffect(refresh, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid email address');
      return;
    }
    try {
      setSubmitting(true);
      await inviteTeamMember(email, permissions, { restrictToOwnRecords, hideFinancialDetails });
      toast.success('Invite sent — they can now sign up or log in with this email to join');
      setEmail('');
      setPermissions([]);
      setRestrictToOwnRecords(true);
      setHideFinancialDetails(true);
      setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite team member');
    } finally {
      setSubmitting(false);
    }
  };

  if (members === null) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-32 skeleton-shimmer rounded-md" />
          <div className="h-4 w-96 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Team"
        description="Invite staff and choose exactly which parts of the business each person can see and use."
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Invite Someone'}
          </button>
        }
      >
        {showForm && (
          <form onSubmit={handleInvite} className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-slide-up">
            <input
              type="email" placeholder="Their email address" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Access to grant:</p>
              <PermissionToggles selected={permissions} onChange={setPermissions} />
            </div>
            <div className="divide-y divide-gray-50 border-t border-gray-100 pt-1">
              <SettingSwitch
                label="Only their own records"
                description="They'll only see and edit records they personally entered, not the whole business's."
                checked={restrictToOwnRecords}
                onChange={setRestrictToOwnRecords}
              />
              <SettingSwitch
                label="Can see buying price & profit"
                description="Off by default — they can still record a sale, just without seeing what it cost or the margin."
                checked={!hideFinancialDetails}
                onChange={v => setHideFinancialDetails(!v)}
              />
            </div>
            <p className="text-xs text-gray-400">They can never delete records, regardless of these settings — only you can.</p>
            <button
              type="submit" disabled={submitting}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        )}
      </PageHeader>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet."
          description="Invite staff to give them access to specific parts of TrackWyze."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map(m => <MemberRow key={m.id} member={m} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
