import { supabase } from '../../utils/supabase';
import { sendPaymentApprovedEmail } from '../email/emailService';
import { BILLING_PLANS, type BillingPlanKey } from '../../utils/subscription';

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  suspendedUsers: number;
  expiredUsers: number;
  pendingPayments: number;
  monthRevenue: number;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const [{ data: profiles, error: profilesError }, { data: pending, error: pendingError }, { data: approved, error: approvedError }] =
    await Promise.all([
      supabase.from('profiles').select('subscription_status'),
      supabase.from('payment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('payment_submissions')
        .select('amount, reviewed_at')
        .eq('status', 'approved')
        .gte('reviewed_at', startOfMonthIso()),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (pendingError) throw new Error(pendingError.message);
  if (approvedError) throw new Error(approvedError.message);

  const rows = profiles ?? [];
  return {
    totalUsers: rows.length,
    activeUsers: rows.filter(p => p.subscription_status === 'active').length,
    trialUsers: rows.filter(p => p.subscription_status === 'trial').length,
    suspendedUsers: rows.filter(p => p.subscription_status === 'suspended').length,
    expiredUsers: rows.filter(p => p.subscription_status === 'expired').length,
    pendingPayments: pending?.length ?? 0,
    monthRevenue: (approved ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
  };
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export interface PaymentSubmission {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: number;
  paymentMethod: string;
  transactionReference: string | null;
  screenshotUrl: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string | null;
  /** 'manual' (admin reviewed it) or 'gateway' (Flutterwave webhook auto-verified it). */
  source: string;
  gateway: string | null;
}

export async function listPaymentSubmissions(statusFilter: string = 'all'): Promise<PaymentSubmission[]> {
  let query = supabase.from('payment_submissions').select('*').order('submitted_at', { ascending: false });
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const submissions = data ?? [];
  const userIds = Array.from(new Set(submissions.map(s => s.user_id)));
  const profileMap = await fetchProfileLookup(userIds);

  return submissions.map(s => ({
    id: s.id,
    userId: s.user_id,
    userName: profileMap[s.user_id]?.full_name ?? null,
    userEmail: profileMap[s.user_id]?.email ?? null,
    amount: Number(s.amount),
    paymentMethod: s.payment_method,
    transactionReference: s.transaction_reference,
    screenshotUrl: s.screenshot_url,
    status: s.status ?? 'pending',
    submittedAt: s.submitted_at,
    reviewedAt: s.reviewed_at,
    reviewedBy: s.reviewed_by,
    adminNotes: s.admin_notes,
    source: s.source ?? 'manual',
    gateway: s.gateway,
  }));
}

async function fetchProfileLookup(userIds: string[]): Promise<Record<string, { full_name: string | null; email: string | null }>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
  if (error) throw new Error(error.message);
  const map: Record<string, { full_name: string | null; email: string | null }> = {};
  (data ?? []).forEach(p => { map[p.id] = { full_name: p.full_name, email: p.email }; });
  return map;
}

export async function getPaymentScreenshotSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, 5 * 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export interface ApprovePaymentOptions {
  adminNotes?: string;
  extendDays: number;
  billingCycle: string;
}

export async function approvePaymentSubmission(submission: PaymentSubmission, options: ApprovePaymentOptions): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error: reviewError } = await supabase
    .from('payment_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      admin_notes: options.adminNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submission.id);
  if (reviewError) throw new Error(reviewError.message);

  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('subscription_expiry')
    .eq('id', submission.userId)
    .maybeSingle();
  if (profileFetchError) throw new Error(profileFetchError.message);

  const base = profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date()
    ? new Date(profile.subscription_expiry)
    : new Date();
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + options.extendDays);

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_expiry: newExpiry.toISOString(),
      current_billing_cycle: options.billingCycle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submission.userId);
  if (profileUpdateError) throw new Error(profileUpdateError.message);

  await writeAuditLog({
    action: 'approve_payment',
    tableName: 'payment_submissions',
    recordId: submission.id,
    newData: { amount: submission.amount, extendDays: options.extendDays, billingCycle: options.billingCycle },
  });

  const planKey = options.billingCycle as BillingPlanKey;
  const planLabel = BILLING_PLANS[planKey]?.label ?? options.billingCycle;
  sendPaymentApprovedEmail({ userId: submission.userId, amount: submission.amount, currency: 'KES', planLabel });
}

export async function rejectPaymentSubmission(submission: PaymentSubmission, reason: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('payment_submissions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      admin_notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submission.id);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: 'reject_payment',
    tableName: 'payment_submissions',
    recordId: submission.id,
    newData: { reason },
  });
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  tableName: string | null;
  recordId: string | null;
  oldData: unknown;
  newData: unknown;
  createdAt: string | null;
}

export interface AuditLogFilters {
  tableName?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listAuditLog(filters: AuditLogFilters): Promise<{ entries: AuditLogEntry[]; total: number }> {
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.tableName && filters.tableName !== 'all') {
    query = query.eq('table_name', filters.tableName);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map(r => r.user_id).filter((id): id is string => !!id)));
  const profileMap = await fetchProfileLookup(userIds);

  let entries: AuditLogEntry[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_id ? profileMap[r.user_id]?.full_name ?? null : null,
    userEmail: r.user_id ? profileMap[r.user_id]?.email ?? null : null,
    action: r.action,
    tableName: r.table_name,
    recordId: r.record_id,
    oldData: r.old_data,
    newData: r.new_data,
    createdAt: r.created_at,
  }));

  if (filters.search) {
    const term = filters.search.toLowerCase();
    entries = entries.filter(e =>
      e.action.toLowerCase().includes(term) ||
      (e.userName ?? '').toLowerCase().includes(term) ||
      (e.userEmail ?? '').toLowerCase().includes(term)
    );
  }

  return { entries, total: count ?? entries.length };
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.from('feature_flags').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(f => ({
    id: f.id,
    key: f.key,
    name: f.name,
    description: f.description,
    enabled: f.enabled,
    updatedAt: f.updated_at,
  }));
}

export async function setFeatureFlag(id: string, enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export interface SubscriptionUpdate {
  subscriptionStatus?: string;
  subscriptionExpiry?: string | null;
  currentBillingCycle?: string;
  trialEndDate?: string | null;
}

export async function updateUserSubscription(userId: string, update: SubscriptionUpdate): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.subscriptionStatus !== undefined) payload.subscription_status = update.subscriptionStatus;
  if (update.subscriptionExpiry !== undefined) payload.subscription_expiry = update.subscriptionExpiry;
  if (update.currentBillingCycle !== undefined) payload.current_billing_cycle = update.currentBillingCycle;
  if (update.trialEndDate !== undefined) payload.trial_end_date = update.trialEndDate;

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: 'admin_update_subscription',
    tableName: 'profiles',
    recordId: userId,
    newData: update as Record<string, unknown>,
  });
}

export interface EmailBroadcast {
  id: string;
  subject: string;
  body: string;
  audience: string;
  recipientCount: number;
  createdAt: string;
}

export async function listEmailBroadcasts(): Promise<EmailBroadcast[]> {
  const { data, error } = await supabase
    .from('email_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map(b => ({
    id: b.id,
    subject: b.subject,
    body: b.body,
    audience: b.audience,
    recipientCount: b.recipient_count,
    createdAt: b.created_at,
  }));
}

export async function logEmailBroadcast(entry: { subject: string; body: string; audience: string; recipientCount: number }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({
      created_by: user?.id ?? null,
      subject: entry.subject,
      body: entry.body,
      audience: entry.audience,
      recipient_count: entry.recipientCount,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: 'send_broadcast_email',
    tableName: 'email_broadcasts',
    recordId: data.id,
    newData: { subject: entry.subject, audience: entry.audience, recipientCount: entry.recipientCount },
  });
}

async function writeAuditLog(entry: { action: string; tableName: string; recordId: string; newData?: Record<string, unknown>; oldData?: Record<string, unknown> }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    action: entry.action,
    table_name: entry.tableName,
    record_id: entry.recordId,
    new_data: entry.newData ?? null,
    old_data: entry.oldData ?? null,
  });
}
