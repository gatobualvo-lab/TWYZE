import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Wallet, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import {
  listEventExpenses, addEventExpense, EVENT_EXPENSE_CATEGORIES, type EventExpense,
} from '../../services/events/eventExpenseService';

const EventExpenses: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [expenses, setExpenses] = useState<EventExpense[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>(EVENT_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listEventExpenses(projectId).then(setExpenses).catch(() => setExpenses([]));
  };
  useEffect(refresh, [projectId]);

  const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (toNum(amount) <= 0) { toast.error('Enter an amount above 0'); return; }
    setSubmitting(true);
    try {
      await addEventExpense({ projectId, category, amount: toNum(amount), date, notes: notes.trim() || undefined });
      toast.success('Expense logged');
      setAmount(''); setNotes(''); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log that expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Expenses ({expenses?.length ?? 0})
        </p>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Log expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pb-3 border-b border-gray-100">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {EVENT_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="0" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Expense date" />
          <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
            className="sm:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={submitting}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {!expenses ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-gray-400">No expenses logged yet for this event (venue, catering, security, decor...).</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {expenses.map(exp => (
              <li key={exp.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{exp.category}</span>
                  <span className="block text-xs text-gray-400 truncate">{formatDate(exp.date)}{exp.notes ? ` · ${exp.notes}` : ''}</span>
                </span>
                <span className="font-medium tabular-nums text-red-600 flex-shrink-0">{formatCurrency(exp.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-sm">
            <span className="text-gray-400">Total</span>
            <span className="font-semibold tabular-nums text-red-600">{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default EventExpenses;
