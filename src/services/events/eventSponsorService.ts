import { supabase } from '../../utils/supabase';

// event_sponsors is new this session (20261122140000_event_module_schema.sql) and isn't
// in the generated Supabase types yet — same `as never` cast used for event_guests.
const TABLE = 'event_sponsors' as never;

export interface EventSponsor {
  id: string;
  sponsorName: string;
  packageLabel: string | null;
  amount: number | null;
  deliverables: string | null;
  fulfilled: boolean;
  documentId: string | null;
}

interface SponsorRow {
  id: string; sponsor_name: string; package_label: string | null; amount: number | null;
  deliverables: string | null; fulfilled: boolean; document_id: string | null;
}

function mapRow(row: SponsorRow): EventSponsor {
  return {
    id: row.id,
    sponsorName: row.sponsor_name,
    packageLabel: row.package_label,
    amount: row.amount,
    deliverables: row.deliverables,
    fulfilled: row.fulfilled,
    documentId: row.document_id,
  };
}

export async function listSponsors(projectId: string): Promise<EventSponsor[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SponsorRow[]).map(mapRow);
}

export interface AddSponsorInput {
  projectId: string;
  sponsorName: string;
  packageLabel?: string;
  amount?: number;
  deliverables?: string;
}

export async function addSponsor(input: AddSponsorInput): Promise<EventSponsor> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      project_id: input.projectId,
      sponsor_name: input.sponsorName,
      package_label: input.packageLabel || null,
      amount: input.amount ?? null,
      deliverables: input.deliverables || null,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as SponsorRow);
}

export async function setSponsorFulfilled(id: string, fulfilled: boolean): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ fulfilled } as never).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function linkSponsorDocument(id: string, documentId: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ document_id: documentId } as never).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
