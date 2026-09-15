import { supabase } from '../../utils/supabase';

export type RecurringFrequency = 'weekly' | 'monthly';

export interface RecurringExpense {
  id: string;
  description: string;
  expenseType: string;
  amount: number;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextRunDate: string;
  isActive: boolean;
}

function mapRow(row: {
  id: string; description: string; expense_type: string; amount: number;
  frequency: string; day_of_month: number | null; day_of_week: number | null;
  next_run_date: string; is_active: boolean;
}): RecurringExpense {
  return {
    id: row.id,
    description: row.description,
    expenseType: row.expense_type,
    amount: row.amount,
    frequency: row.frequency as RecurringFrequency,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    nextRunDate: row.next_run_date,
    isActive: row.is_active,
  };
}

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase.from('recurring_expenses').select('*').order('next_run_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateRecurringExpenseInput {
  description: string;
  expenseType: string;
  amount: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  nextRunDate: string;
}

export async function createRecurringExpense(input: CreateRecurringExpenseInput): Promise<RecurringExpense> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a recurring expense.');

  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert({
      user_id: user.id,
      description: input.description,
      expense_type: input.expenseType,
      amount: input.amount,
      frequency: input.frequency,
      day_of_month: input.frequency === 'monthly' ? input.dayOfMonth : null,
      day_of_week: input.frequency === 'weekly' ? input.dayOfWeek : null,
      next_run_date: input.nextRunDate,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function setRecurringExpenseActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Generates any general_expenses rows that came due since this was last called, and advances each template's next_run_date. Safe to call every session. */
export async function runDueRecurringExpenses(): Promise<number> {
  const { data, error } = await supabase.rpc('run_due_recurring_expenses');
  if (error) return 0;
  return data ?? 0;
}
