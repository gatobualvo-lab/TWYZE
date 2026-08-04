import { supabase } from '../../utils/supabase';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '../../utils/security';

export type ExpenseType = 'Payment' | 'Refund' | 'Adjustment' | 'Other';

export type AddVendorExpenseInput = {
  vendorName: string;
  expenseType: ExpenseType;
  amountKES: string | number;
  dateString: string;
  notes?: string;
};

export type VendorExpense = {
  id: string;
  vendor_name: string;
  expense_type: ExpenseType;
  amount_kes: number;
  occurred_on: string;
  notes: string | null;
  is_cleared: boolean;
  cleared_at: string | null;
  cleared_by: string | null;
  created_by: string;
  created_at: string;
};

/**
 * Convert date string to ISO format (YYYY-MM-DD)
 * Accepts: "DD/MM/YYYY" or "YYYY-MM-DD"
 */
function toISODate(dateString: string): string {
  // Check if format is DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [dd, mm, yyyy] = dateString.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Assume already ISO format
  return dateString;
}

/**
 * Parse amount from string or number
 * Removes non-numeric characters except decimal point
 */
function parseAmount(amount: string | number): number {
  const parsed = typeof amount === 'string'
    ? Number(amount.replace(/[^\d.]/g, ''))
    : Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Amount must be a positive number');
  }

  return parsed;
}

/**
 * Add a vendor expense
 */
export async function addVendorExpense(input: AddVendorExpenseInput): Promise<VendorExpense> {
  const amount = parseAmount(input.amountKES);
  const occurred_on = toISODate(input.dateString);

  if (!(await checkRateLimit('vendor_expense.create'))) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }

  const { data, error } = await supabase
    .from('vendor_expenses')
    .insert({
      vendor_name: input.vendorName,
      expense_type: input.expenseType,
      amount_kes: amount,
      occurred_on,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as VendorExpense;
}

/**
 * Get vendor expenses for a specific vendor
 */
export async function getVendorExpenses(
  vendorName: string,
  showCleared: boolean = true
): Promise<VendorExpense[]> {
  let query = supabase
    .from('vendor_expenses')
    .select('*')
    .eq('vendor_name', vendorName)
    .order('occurred_on', { ascending: false });

  // Optionally filter out cleared expenses
  if (!showCleared) {
    query = query.eq('is_cleared', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Update a vendor expense
 */
export async function updateVendorExpense(
  id: string,
  updates: Partial<Omit<AddVendorExpenseInput, 'vendorName'>>
): Promise<VendorExpense> {
  const payload: Record<string, any> = {};

  if (updates.expenseType) {
    payload.expense_type = updates.expenseType;
  }

  if (updates.amountKES !== undefined) {
    payload.amount_kes = parseAmount(updates.amountKES);
  }

  if (updates.dateString) {
    payload.occurred_on = toISODate(updates.dateString);
  }

  if (updates.notes !== undefined) {
    payload.notes = updates.notes || null;
  }

  const { data, error } = await supabase
    .from('vendor_expenses')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as VendorExpense;
}

/**
 * Delete a vendor expense
 */
export async function deleteVendorExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('vendor_expenses')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Mark an expense as cleared (paid) or uncleared
 */
export async function setExpenseCleared(
  id: string,
  cleared: boolean
): Promise<VendorExpense> {
  const { data: { user } } = await supabase.auth.getUser();

  const payload: Record<string, any> = {
    is_cleared: cleared,
    cleared_at: cleared ? new Date().toISOString() : null,
    cleared_by: cleared ? user?.id ?? null : null,
  };

  const { data, error } = await supabase
    .from('vendor_expenses')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as VendorExpense;
}

/**
 * Mark all uncleared expenses for a vendor as paid
 * Returns the number of expenses marked as paid
 */
export async function markAllPaidForVendor(vendorName: string): Promise<number> {
  // Try RPC function first (preferred method)
  const { data, error } = await supabase.rpc('vendor_expenses_mark_all_paid', {
    v_vendor_name: vendorName,
  });

  if (!error && typeof data === 'number') {
    return data;
  }

  // Fallback: client-side update if RPC not available
  const { data: { user } } = await supabase.auth.getUser();

  const { error: updateError } = await supabase
    .from('vendor_expenses')
    .update({
      is_cleared: true,
      cleared_at: new Date().toISOString(),
      cleared_by: user?.id ?? null,
    })
    .eq('vendor_name', vendorName)
    .eq('is_cleared', false);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return 0; // Fallback doesn't return count
}
