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

export interface ProjectTaskEntry {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
}

export interface ProjectSaleEntry {
  id: string;
  productName: string;
  date: string | null;
  amount: number;
}

export interface ProjectContents {
  documents: ProjectDocumentEntry[];
  expenses: ProjectExpenseEntry[];
  tasks: ProjectTaskEntry[];
  /** e.g. ticket sales for an event, recorded through the Sales module rather than as invoices. */
  sales: ProjectSaleEntry[];
}

/** Everything filed under a project: its invoices/quotations/receipts, its sales, its expenses, and its timeline tasks. */
export async function fetchProjectContents(projectId: string): Promise<ProjectContents> {
  const [docs, general, ads, vendors, tasks, sales] = await Promise.all([
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
    supabase
      .from('business_tasks')
      .select('id, title, completed, due_date')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('sales')
      .select('id, product_name, date, selling_price')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('date', { ascending: false }),
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

  const taskEntries: ProjectTaskEntry[] = (tasks.data ?? []).map(t => ({
    id: t.id,
    title: t.title,
    completed: t.completed ?? false,
    dueDate: t.due_date,
  }));

  const saleEntries: ProjectSaleEntry[] = (sales.data ?? []).map(s => ({
    id: s.id,
    productName: s.product_name ?? '',
    date: s.date,
    amount: toNum(s.selling_price),
  }));

  return { documents, expenses, tasks: taskEntries, sales: saleEntries };
}
