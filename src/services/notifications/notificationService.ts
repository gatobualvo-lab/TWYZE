import { supabase } from '../../utils/supabase';

// Shared notification engine — every feature that needs to tell the user
// "something needs attention" (Opportunity Center, Smart Inventory,
// Business Goals) publishes here instead of building its own read/unread/
// dismiss logic. See migration 20260807093000 for the schema/RLS.

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AppNotification {
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  actionTab: string | null;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  type: string;
  priority: NotificationPriority;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  actionTab?: string;
  /** Stable key so re-detecting the same condition doesn't create a duplicate. */
  dedupeKey: string;
}

function mapRow(row: {
  id: string; type: string; priority: string; title: string; body: string | null;
  entity_type: string | null; entity_id: string | null; action_tab: string | null;
  is_read: boolean; is_archived: boolean; created_at: string;
}): AppNotification {
  return {
    id: row.id,
    type: row.type,
    priority: (row.priority as NotificationPriority) ?? 'medium',
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionTab: row.action_tab,
    isRead: row.is_read,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function listNotifications(options?: { includeArchived?: boolean; limit?: number }): Promise<AppNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50);

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_archived', false)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Create a notification, silently skipping if one with the same dedupe_key
 * already exists for this user (the unique index enforces this — the
 * `ignoreDuplicates` option means Postgres treats the conflict as a no-op
 * rather than raising an error). Returns whether a row was actually
 * inserted — `ignoreDuplicates` means a conflicting upsert comes back with
 * no row, so a falsy result means "this condition was already notified."
 * Callers that only want to react to a genuinely new notification (e.g.
 * firing an email) should check this instead of assuming every call means
 * something new happened.
 */
export async function publishNotification(input: CreateNotificationInput): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('notifications')
    .upsert(
      {
        user_id: user.id,
        type: input.type,
        priority: input.priority,
        title: input.title,
        body: input.body ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        action_tab: input.actionTab ?? null,
        dedupe_key: input.dedupeKey,
      },
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }
    )
    .select('id');

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
}

export async function archiveNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_archived: true }).eq('id', id);
  if (error) throw new Error(error.message);
}
