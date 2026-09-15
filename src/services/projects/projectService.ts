import { supabase } from '../../utils/supabase';

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  clientName: string | null;
  budget: number | null;
  status: ProjectStatus;
  notes: string | null;
  createdAt: string;
}

function mapRow(row: {
  id: string; name: string; client_name: string | null; budget: number | null;
  status: string; notes: string | null; created_at: string;
}): Project {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    budget: row.budget,
    status: row.status as ProjectStatus,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateProjectInput {
  name: string;
  clientName?: string;
  budget?: number;
  notes?: string;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a project.');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: input.name,
      client_name: input.clientName || null,
      budget: input.budget ?? null,
      notes: input.notes || null,
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
