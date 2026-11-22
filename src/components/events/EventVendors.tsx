import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Landmark, Plus } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  addVendorExpense, setExpenseCleared, EXPENSE_TYPE_OPTIONS, type ExpenseType, type VendorExpense,
} from '../../features/vendor-expenses/api';

// Vendor deposit/payment schedules reuse vendor_expenses as-is (it already has project_id
// and is_cleared/cleared_at — exactly "deposit pending vs paid") rather than a new table;
// this just scopes the existing addVendorExpense/setExpenseCleared API to one event.

const EventVendors: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [expenses, setExpenses] = useState<VendorExpense[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('Payment');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const { data, error } = await supabase
      .from('vendor_expenses')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('occurred_on', { ascending: true });
    if (error) { setExpenses([]); return; }
    setExpenses((data ?? []) as VendorExpense[]);
  };
  useEffect(() => { refresh(); }, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !amount) { toast.error('Enter a vendor name and amount'); return; }
    setSubmitting(true);
    try {
      await addVendorExpense({ vendorName: vendorName.trim(), expenseType, amountKES: amount, dateString: dueDate, projectId });
      setVendorName(''); setAmount(''); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCleared = async (expense: VendorExpense) => {
    setExpenses(prev => prev && prev.map(e => (e.id === expense.id ? { ...e, is_cleared: !e.is_cleared } : e)));
    try {
      await setExpenseCleared(expense.id, !expense.is_cleared);
    } catch {
      toast.error('Could not update that payment');
      refresh();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" /> Vendor payments ({expenses?.length ?? 0})
        </p>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add payment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pb-3 border-b border-gray-100">
          <input type="text" placeholder="Vendor (e.g. Catering Co.)" value={vendorName} onChange={e => setVendorName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={expenseType} onChange={e => setExpenseType(e.target.value as ExpenseType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {EXPENSE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" min="0" placeholder="Amount (e.g. deposit)" value={amount} onChange={e => setAmount(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Due date" />
          <button type="submit" disabled={submitting}
            className="sm:col-span-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save payment'}
          </button>
        </form>
      )}

      {!expenses ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-gray-400">No vendor payments scheduled yet (e.g. a catering deposit, venue balance).</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {expenses.map(exp => (
            <li key={exp.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate"><span className="font-medium">{exp.vendor_name}</span> <span className="text-gray-400">· {exp.expense_type}</span></span>
                <span className="block text-xs text-gray-400">{formatDate(exp.occurred_on)}</span>
              </span>
              <span className="flex items-center gap-3 flex-shrink-0">
                <span className="font-medium tabular-nums">{formatCurrency(exp.amount_kes)}</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={exp.is_cleared} onChange={() => handleToggleCleared(exp)} className="h-4 w-4 rounded border-gray-300" />
                  <span className={`text-xs font-medium ${exp.is_cleared ? 'text-green-700' : 'text-gray-500'}`}>
                    {exp.is_cleared ? 'Paid' : 'Mark paid'}
                  </span>
                </label>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventVendors;
