import { supabase } from '../../utils/supabase';

export type RecurringFrequency = 'weekly' | 'monthly';

export interface RecurringInvoice {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  description: string;
  amount: number;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextRunDate: string;
  isActive: boolean;
  projectId: string | null;
}

function mapRow(row: {
  id: string; customer_name: string; customer_email: string | null; customer_phone: string | null;
  description: string; amount: number; frequency: string; day_of_month: number | null;
  day_of_week: number | null; next_run_date: string; is_active: boolean; project_id: string | null;
}): RecurringInvoice {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    description: row.description,
    amount: row.amount,
    frequency: row.frequency as RecurringFrequency,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    nextRunDate: row.next_run_date,
    isActive: row.is_active,
    projectId: row.project_id,
  };
}

export async function listRecurringInvoices(): Promise<RecurringInvoice[]> {
  const { data, error } = await supabase.from('recurring_invoices').select('*').order('next_run_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateRecurringInvoiceInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  amount: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  nextRunDate: string;
  projectId?: string;
}

export async function createRecurringInvoice(input: CreateRecurringInvoiceInput): Promise<RecurringInvoice> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a recurring invoice.');

  const { data, error } = await supabase
    .from('recurring_invoices')
    .insert({
      user_id: user.id,
      customer_name: input.customerName,
      customer_email: input.customerEmail || null,
      customer_phone: input.customerPhone || null,
      description: input.description,
      amount: input.amount,
      frequency: input.frequency,
      day_of_month: input.frequency === 'monthly' ? input.dayOfMonth : null,
      day_of_week: input.frequency === 'weekly' ? input.dayOfWeek : null,
      next_run_date: input.nextRunDate,
      project_id: input.projectId || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function setRecurringInvoiceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('recurring_invoices').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Generates any invoice documents that came due since this was last called, and advances each template's next_run_date. Safe to call every session. */
export async function runDueRecurringInvoices(): Promise<number> {
  const { data, error } = await supabase.rpc('run_due_recurring_invoices');
  if (error) return 0;
  return data ?? 0;
}
