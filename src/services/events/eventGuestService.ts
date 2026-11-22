import { supabase } from '../../utils/supabase';

// event_guests is new this session (20261122140000_event_module_schema.sql) and isn't in
// the generated Supabase types yet, so `.from()` needs the same `as never` cast used
// elsewhere for new tables/RPCs not yet reflected in database.types.ts.
const TABLE = 'event_guests' as never;

export type RsvpStatus = 'invited' | 'confirmed' | 'declined' | 'attended';

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  invited: 'Invited',
  confirmed: 'Confirmed',
  declined: 'Declined',
  attended: 'Attended',
};

export interface EventGuest {
  id: string;
  name: string;
  phone: string | null;
  partySize: number;
  rsvpStatus: RsvpStatus;
  notes: string | null;
}

interface GuestRow {
  id: string; name: string; phone: string | null; party_size: number; rsvp_status: string; notes: string | null;
}

function mapRow(row: GuestRow): EventGuest {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    partySize: row.party_size,
    rsvpStatus: row.rsvp_status as RsvpStatus,
    notes: row.notes,
  };
}

export async function listGuests(projectId: string): Promise<EventGuest[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GuestRow[]).map(mapRow);
}

export interface AddGuestInput {
  projectId: string;
  name: string;
  phone?: string;
  partySize?: number;
  notes?: string;
}

export async function addGuest(input: AddGuestInput): Promise<EventGuest> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      project_id: input.projectId,
      name: input.name,
      phone: input.phone || null,
      party_size: input.partySize && input.partySize > 0 ? Math.round(input.partySize) : 1,
      notes: input.notes || null,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as GuestRow);
}

export async function updateRsvp(id: string, rsvpStatus: RsvpStatus): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ rsvp_status: rsvpStatus } as never).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteGuest(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
