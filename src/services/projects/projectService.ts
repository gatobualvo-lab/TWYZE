import { supabase } from '../../utils/supabase';

export type ProjectStatus = 'active' | 'completed' | 'archived';
export type ProjectKind = 'general' | 'event';
export type EventType = 'wedding' | 'corporate' | 'birthday' | 'conference' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate function',
  birthday: 'Birthday / Party',
  conference: 'Conference',
  other: 'Other event',
};

export interface Project {
  id: string;
  name: string;
  clientName: string | null;
  budget: number | null;
  status: ProjectStatus;
  notes: string | null;
  createdAt: string;
  kind: ProjectKind;
  eventType: EventType | null;
  /** YYYY-MM-DD, when `kind` is 'event'. */
  eventDate: string | null;
  guestCount: number | null;
}

function mapRow(row: {
  id: string; name: string; client_name: string | null; budget: number | null;
  status: string; notes: string | null; created_at: string;
  project_kind?: string | null; event_type?: string | null; event_date?: string | null; guest_count?: number | null;
}): Project {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    budget: row.budget,
    status: row.status as ProjectStatus,
    notes: row.notes,
    createdAt: row.created_at,
    kind: row.project_kind === 'event' ? 'event' : 'general',
    eventType: (row.event_type as EventType) ?? null,
    eventDate: row.event_date ?? null,
    guestCount: row.guest_count ?? null,
  };
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

/** Projects of kind 'event' only — the standalone Events page's list. */
export async function listEvents(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('project_kind', 'event')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateProjectInput {
  name: string;
  clientName?: string;
  budget?: number;
  notes?: string;
  kind?: ProjectKind;
  eventType?: EventType;
  /** YYYY-MM-DD */
  eventDate?: string;
  guestCount?: number;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a project.');

  const isEvent = input.kind === 'event';
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: input.name,
      client_name: input.clientName || null,
      budget: input.budget ?? null,
      notes: input.notes || null,
      project_kind: isEvent ? 'event' : 'general',
      event_type: isEvent ? input.eventType || null : null,
      event_date: isEvent ? input.eventDate || null : null,
      guest_count: isEvent ? input.guestCount ?? null : null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const { error } = await supabase.from('projects').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
