import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';

export interface ProjectDocumentEntry {
  id: string;
  type: string;
  number: string;
  customer: string;
  date: string | null;
  total: number;
  status: string;
}

export interface ProjectExpenseEntry {
  id: string;
  kind: 'General' | 'Ad' | 'Vendor';
  label: string;
  date: string | null;
  amount: number;
}

export interface ProjectContents {
  documents: ProjectDocumentEntry[];
  expenses: ProjectExpenseEntry[];
}

/** Everything filed under a project: its invoices/quotations/receipts and its expenses. */
export async function fetchProjectContents(projectId: string): Promise<ProjectContents> {
  const [docs, general, ads, vendors] = await Promise.all([
    supabase
      .from('documents')
      .select('id, document_type, document_number, customer_name, date, total, status')
      .eq('project_id', projectId)
      .order('date', { ascending: false }),
    supabase
      .from('general_expenses')
      .select('id, expense_type, amount, date')
      .eq('project_id', projectId)
      .eq('is_deleted', false),
    supabase
      .from('ad_expenses')
      .select('id, ad_platform, amount_kes, occurred_on')
      .eq('project_id', projectId)
      .eq('is_deleted', false),
    supabase
      .from('vendor_expenses')
      .select('id, vendor_name, expense_type, amount_kes, date')
      .eq('project_id', projectId)
      .eq('is_deleted', false),
  ]);

  const documents: ProjectDocumentEntry[] = (docs.data ?? []).map(d => ({
    id: d.id,
    type: d.document_type,
    number: d.document_number,
    customer: d.customer_name ?? '',
    date: d.date,
    total: toNum(d.total),
    status: d.status ?? '',
  }));

  const expenses: ProjectExpenseEntry[] = [
    ...(general.data ?? []).map(e => ({
      id: e.id, kind: 'General' as const, label: e.expense_type, date: e.date, amount: toNum(e.amount),
    })),
    ...(ads.data ?? []).map(e => ({
      id: e.id, kind: 'Ad' as const, label: e.ad_platform, date: e.occurred_on, amount: toNum(e.amount_kes),
    })),
    ...(vendors.data ?? []).map(e => ({
      id: e.id, kind: 'Vendor' as const, label: `${e.vendor_name} - ${e.expense_type}`, date: e.date, amount: toNum(e.amount_kes),
    })),
  ].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  return { documents, expenses };
}
