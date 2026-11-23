import { supabase } from '../../utils/supabase';

// General expenses incurred for an event (venue, catering, security, decor...),
// logged entirely within the Events tab rather than the general Expenses page.
// Reuses general_expenses as-is (it already has project_id) via its own
// expense_type free-text column for the category.

export const EVENT_EXPENSE_CATEGORIES = [
  'Venue', 'Catering', 'Decor', 'Security', 'Sound & Lighting', 'Permits', 'Marketing', 'Transport', 'Other',
] as const;

export interface EventExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
}

function mapRow(row: { id: string; expense_type: string | null; amount: number | null; date: string | null; notes: string | null }): EventExpense {
  return {
    id: row.id,
    category: row.expense_type ?? '',
    amount: row.amount ?? 0,
    date: row.date ?? '',
    notes: row.notes,
  };
}

export async function listEventExpenses(projectId: string): Promise<EventExpense[]> {
  const { data, error } = await supabase
    .from('general_expenses')
    .select('id, expense_type, amount, date, notes')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface AddEventExpenseInput {
  projectId: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

export async function addEventExpense(input: AddEventExpenseInput): Promise<EventExpense> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to log an expense.');

  const { data, error } = await supabase
    .from('general_expenses')
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      expense_type: input.category,
      amount: input.amount,
      date: input.date,
      notes: input.notes || null,
      project_id: input.projectId,
    })
    .select('id, expense_type, amount, date, notes')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}
