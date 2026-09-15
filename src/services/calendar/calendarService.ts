import { supabase } from '../../utils/supabase';
import type { DateRange } from '../../utils/dateRange';

export interface DueDocument {
  id: string;
  documentNumber: string;
  documentType: string;
  customerName: string | null;
  total: number;
  dueDate: string;
  actionTab: string;
}

const ACTION_TAB_BY_TYPE: Record<string, string> = {
  quotation: 'documents-quotations',
  invoice: 'documents-invoices',
  receipt: 'documents-receipts',
};

/** Documents that still need to be paid/actioned, with a due date landing in the given range. Drafts and dead documents are excluded — nagging about an unsent draft's due date isn't useful. */
export async function fetchDueDocuments(range: DateRange): Promise<DueDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, document_number, document_type, customer_name, total, due_date, status')
    .not('due_date', 'is', null)
    .gte('due_date', range.start)
    .lte('due_date', range.end)
    .in('status', ['sent', 'overdue', 'accepted']);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter(row => row.due_date)
    .map(row => ({
      id: row.id,
      documentNumber: row.document_number,
      documentType: row.document_type,
      customerName: row.customer_name,
      total: row.total ?? 0,
      dueDate: row.due_date as string,
      actionTab: ACTION_TAB_BY_TYPE[row.document_type] ?? 'documents-invoices',
    }));
}
