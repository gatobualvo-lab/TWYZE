import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';

// Customer Timeline's data layer. Deliberately keys on the customer *name*
// (case-insensitive), not customer_id — the customers table (migration
// 20260807090000) was backfilled from existing sales/documents, but the
// sale/document creation forms don't set customer_id on new records, so
// name-matching is what actually stays correct for both historical and new
// data without touching those existing, working forms. customer_id is used
// only for the notes/status metadata this feature adds.

export type CustomerStatus = 'active' | 'inactive' | 'archived';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: CustomerStatus;
  notes: string | null;
}

export interface TimelineEntry {
  id: string;
  kind: 'sale' | 'quotation' | 'invoice' | 'receipt';
  date: string;
  title: string;
  amount: number;
  status: string | null;
}

export async function fetchOrCreateCustomer(name: string): Promise<Customer | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('id, name, phone, email, address, status, notes')
    .eq('user_id', user.id)
    .ilike('name', trimmed)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing as Customer;

  const { data: created, error: insertError } = await supabase
    .from('customers')
    .insert({ user_id: user.id, name: trimmed })
    .select('id, name, phone, email, address, status, notes')
    .single();

  if (insertError) throw new Error(insertError.message);
  return created as Customer;
}

export async function updateCustomer(id: string, updates: Partial<Pick<Customer, 'notes' | 'status' | 'phone' | 'email' | 'address'>>): Promise<void> {
  const { error } = await supabase.from('customers').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchCustomerTimeline(customerName: string): Promise<TimelineEntry[]> {
  const name = customerName.trim();
  if (!name) return [];

  const [salesResult, documentsResult] = await Promise.all([
    supabase
      .from('sales')
      .select('id, date, product_name, selling_price, payment_status')
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .ilike('client_name', name)
      .order('date', { ascending: false })
      .limit(100),
    supabase
      .from('documents')
      .select('id, document_type, date, document_number, total, status')
      .ilike('customer_name', name)
      .order('date', { ascending: false })
      .limit(100),
  ]);

  const entries: TimelineEntry[] = [];

  for (const row of salesResult.data ?? []) {
    entries.push({
      id: `sale-${row.id}`,
      kind: 'sale',
      date: row.date ?? '',
      title: row.product_name ?? 'Sale',
      amount: toNum(row.selling_price),
      status: row.payment_status,
    });
  }

  for (const row of documentsResult.data ?? []) {
    entries.push({
      id: `doc-${row.id}`,
      kind: (row.document_type as TimelineEntry['kind']) ?? 'invoice',
      date: row.date ?? '',
      title: row.document_number ?? row.document_type ?? 'Document',
      amount: toNum(row.total),
      status: row.status,
    });
  }

  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
