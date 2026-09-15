import { supabase } from '../../utils/supabase';

export const PERMISSION_SECTIONS = ['sales', 'suppliers', 'expenses', 'documents', 'customers', 'inventory'] as const;
export type PermissionSection = (typeof PERMISSION_SECTIONS)[number];

export const SECTION_LABELS: Record<PermissionSection, string> = {
  sales: 'Sales',
  suppliers: 'Suppliers',
  expenses: 'Expenses',
  documents: 'Documents',
  customers: 'Customers',
  inventory: 'Inventory',
};

export type MemberStatus = 'pending' | 'active' | 'revoked';

export interface TeamMember {
  id: string;
  /** Auth uid of this member once they've accepted — null while the invite is still pending. Matches `entered_by` on records they create. */
  memberId: string | null;
  invitedEmail: string;
  status: MemberStatus;
  permissions: PermissionSection[];
  invitedAt: string;
  acceptedAt: string | null;
  /** When true, this member's access within their granted sections is further limited to records they personally entered — not the whole business's data. */
  restrictToOwnRecords: boolean;
  /** When true, the app hides buying price / profit / margin figures from this member. Enforced in the UI, not a database-level column mask — see the migration comment for why. */
  hideFinancialDetails: boolean;
}

function mapRow(row: {
  id: string; member_id: string | null; invited_email: string; status: string; permissions: string[];
  invited_at: string; accepted_at: string | null;
  restrict_to_own_records: boolean; hide_financial_details: boolean;
}): TeamMember {
  return {
    id: row.id,
    memberId: row.member_id,
    invitedEmail: row.invited_email,
    status: row.status as MemberStatus,
    permissions: (row.permissions ?? []) as PermissionSection[],
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
    restrictToOwnRecords: row.restrict_to_own_records,
    hideFinancialDetails: row.hide_financial_details,
  };
}

/** Members of the business owned by the currently logged-in user (empty for a staff account — only owners manage their team). */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('*')
    .neq('status', 'revoked')
    .order('invited_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface InviteTeamMemberOptions {
  restrictToOwnRecords?: boolean;
  hideFinancialDetails?: boolean;
}

export async function inviteTeamMember(email: string, permissions: PermissionSection[], options: InviteTeamMemberOptions = {}): Promise<TeamMember> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to invite a team member.');

  const { data, error } = await supabase
    .from('business_members')
    .insert({
      owner_id: user.id,
      invited_email: email.trim().toLowerCase(),
      permissions,
      restrict_to_own_records: options.restrictToOwnRecords ?? true,
      hide_financial_details: options.hideFinancialDetails ?? true,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('This email has already been invited.');
    throw new Error(error.message);
  }
  return mapRow(data);
}

export interface UpdateMemberSettingsInput {
  permissions?: PermissionSection[];
  restrictToOwnRecords?: boolean;
  hideFinancialDetails?: boolean;
}

export async function updateMemberSettings(id: string, updates: UpdateMemberSettingsInput): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.permissions !== undefined) payload.permissions = updates.permissions;
  if (updates.restrictToOwnRecords !== undefined) payload.restrict_to_own_records = updates.restrictToOwnRecords;
  if (updates.hideFinancialDetails !== undefined) payload.hide_financial_details = updates.hideFinancialDetails;

  const { error } = await supabase.from('business_members').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function revokeTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('business_members').update({ status: 'revoked' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface BusinessRole {
  /** True if this account is staff on someone else's business (rather than its own owner). */
  isStaff: boolean;
  /** Section permissions granted, only meaningful when isStaff is true. */
  permissions: PermissionSection[];
  /** True if this staff member is limited to records they personally entered. Always false for an owner. */
  restrictToOwnRecords: boolean;
  /** True if this staff member should not see buying price / profit / margin figures. Always false for an owner. */
  hideFinancialDetails: boolean;
}

const OWNER_ROLE: BusinessRole = { isStaff: false, permissions: [], restrictToOwnRecords: false, hideFinancialDetails: false };

/** Resolves whether the current user is a business owner or staff, and if staff, which sections and record/financial restrictions apply to them. */
export async function fetchMyBusinessRole(): Promise<BusinessRole> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return OWNER_ROLE;

  const { data, error } = await supabase
    .from('business_members')
    .select('permissions, restrict_to_own_records, hide_financial_details')
    .eq('member_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) return OWNER_ROLE;
  return {
    isStaff: true,
    permissions: (data.permissions ?? []) as PermissionSection[],
    restrictToOwnRecords: data.restrict_to_own_records,
    hideFinancialDetails: data.hide_financial_details,
  };
}

/** Links the current login to any pending invite matching their email. Safe to call every session — a no-op if there's nothing to claim. */
export async function claimPendingInvite(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_pending_invite');
  if (error) return false;
  return data !== null;
}
