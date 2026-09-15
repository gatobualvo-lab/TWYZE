import React, { useEffect, useState } from 'react';
import { Repeat, Plus, X, Trash2, Pause, Play, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listRecurringExpenses, createRecurringExpense, setRecurringExpenseActive, deleteRecurringExpense,
} from '../../services/expenses/recurringExpenseService';
import type { RecurringExpense, RecurringFrequency } from '../../services/expenses/recurringExpenseService';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import { toISODate } from '../../utils/dateRange';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function scheduleLabel(expense: RecurringExpense): string {
  if (expense.frequency === 'monthly') return `Monthly on day ${expense.dayOfMonth}`;
  return `Weekly on ${WEEKDAY_LABELS[expense.dayOfWeek ?? 0]}`;
}

const ExpenseRow: React.FC<{ expense: RecurringExpense; onChanged: () => void }> = ({ expense, onChanged }) => {
  // Replaces window.confirm() — confirm()/alert() weren't reliably showing
  // anything in the packaged Electron shell, so a click would silently
  // no-op with no dialog and no error. An in-app arm-then-confirm step
  // needs no native API at all (same fix as VendorTransactions.tsx).
  const [pendingDelete, setPendingDelete] = useState(false);

  const handleToggle = async () => {
    try {
      await setRecurringExpenseActive(expense.id, !expense.isActive);
      onChanged();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRecurringExpense(expense.id);
      toast.success('Deleted');
      onChanged();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setPendingDelete(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-md animate-slide-up ${!expense.isActive ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{expense.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {expense.expenseType} · {scheduleLabel(expense)} · Next: {formatDate(expense.nextRunDate)}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(expense.amount)}</span>
        <button onClick={handleToggle} className="text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-90" aria-label={expense.isActive ? 'Pause' : 'Resume'}>
          {expense.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        {pendingDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} className="text-red-500 hover:text-red-700 transition-all duration-150 active:scale-90" aria-label="Confirm delete">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setPendingDelete(false)} className="text-gray-300 hover:text-gray-500 transition-all duration-150 active:scale-90" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setPendingDelete(true)} className="text-gray-300 hover:text-red-500 transition-all duration-150 active:scale-90" aria-label="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const RecurringExpenses: React.FC = () => {
  const [expenses, setExpenses] = useState<RecurringExpense[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: '', expenseType: 'General', amount: '',
    frequency: 'monthly' as RecurringFrequency, dayOfMonth: '1', dayOfWeek: '1',
    startDate: toISODate(new Date()),
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listRecurringExpenses().then(setExpenses).catch(() => setExpenses([])); };
  useEffect(refresh, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toNum(form.amount);
    if (!form.description.trim() || amount <= 0) {
      toast.error('Enter a description and a positive amount');
      return;
    }
    try {
      setSubmitting(true);
      await createRecurringExpense({
        description: form.description.trim(),
        expenseType: form.expenseType.trim() || 'General',
        amount,
        frequency: form.frequency,
        dayOfMonth: form.frequency === 'monthly' ? toNum(form.dayOfMonth) : undefined,
        dayOfWeek: form.frequency === 'weekly' ? toNum(form.dayOfWeek) : undefined,
        nextRunDate: form.startDate,
      });
      toast.success('Recurring expense added');
      setShowForm(false);
      setForm({ description: '', expenseType: 'General', amount: '', frequency: 'monthly', dayOfMonth: '1', dayOfWeek: '1', startDate: toISODate(new Date()) });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add recurring expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (expenses === null) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-52 skeleton-shimmer rounded-md" />
          <div className="h-4 w-80 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Repeat}
        title="Recurring Expenses"
        description="Rent, salaries, subscriptions — set it up once and it logs itself each period."
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Recurring Expense'}
          </button>
        }
      >
        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input
              type="text" placeholder="Description (e.g. Shop rent)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text" placeholder="Category (e.g. Rent, Salaries)" value={form.expenseType}
              onChange={e => setForm(f => ({ ...f, expenseType: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="number" placeholder="Amount" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
            {form.frequency === 'monthly' ? (
              <select
                value={form.dayOfMonth}
                onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Day {d} of the month</option>
                ))}
              </select>
            ) : (
              <select
                value={form.dayOfWeek}
                onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            )}
            <div>
              <label className="text-xs text-gray-500">Start date</label>
              <input
                type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="sm:col-span-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Saving…' : 'Save Recurring Expense'}
            </button>
          </form>
        )}
      </PageHeader>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring expenses set up yet."
          description="Add rent, salaries, or subscriptions once instead of re-entering them every period."
        />
      ) : (
        <div className="space-y-2">
          {expenses.map(e => <ExpenseRow key={e.id} expense={e} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
};

export default RecurringExpenses;
