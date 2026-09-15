import React, { useEffect, useState } from 'react';
import { Repeat, Plus, X, Trash2, Pause, Play, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listRecurringInvoices, createRecurringInvoice, setRecurringInvoiceActive, deleteRecurringInvoice,
} from '../../services/documents/recurringInvoiceService';
import type { RecurringInvoice, RecurringFrequency } from '../../services/documents/recurringInvoiceService';
import { listProjects, type Project } from '../../services/projects/projectService';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import { toISODate } from '../../utils/dateRange';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function scheduleLabel(invoice: RecurringInvoice): string {
  if (invoice.frequency === 'monthly') return `Monthly on day ${invoice.dayOfMonth}`;
  return `Weekly on ${WEEKDAY_LABELS[invoice.dayOfWeek ?? 0]}`;
}

const InvoiceRow: React.FC<{ invoice: RecurringInvoice; onChanged: () => void }> = ({ invoice, onChanged }) => {
  const [pendingDelete, setPendingDelete] = useState(false);

  const handleToggle = async () => {
    try {
      await setRecurringInvoiceActive(invoice.id, !invoice.isActive);
      onChanged();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRecurringInvoice(invoice.id);
      toast.success('Deleted');
      onChanged();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setPendingDelete(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-md animate-slide-up ${!invoice.isActive ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{invoice.customerName} — {invoice.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {scheduleLabel(invoice)} · Next: {formatDate(invoice.nextRunDate)}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(invoice.amount)}</span>
        <button onClick={handleToggle} className="text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-90" aria-label={invoice.isActive ? 'Pause' : 'Resume'}>
          {invoice.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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

const RecurringInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<RecurringInvoice[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', description: '', amount: '',
    frequency: 'monthly' as RecurringFrequency, dayOfMonth: '1', dayOfWeek: '1',
    startDate: toISODate(new Date()), projectId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listRecurringInvoices().then(setInvoices).catch(() => setInvoices([])); };
  useEffect(refresh, []);
  useEffect(() => { listProjects().then(setProjects).catch(() => setProjects([])); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toNum(form.amount);
    if (!form.customerName.trim() || !form.description.trim() || amount <= 0) {
      toast.error('Enter a customer, description, and a positive amount');
      return;
    }
    try {
      setSubmitting(true);
      await createRecurringInvoice({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        customerPhone: form.customerPhone.trim() || undefined,
        description: form.description.trim(),
        amount,
        frequency: form.frequency,
        dayOfMonth: form.frequency === 'monthly' ? toNum(form.dayOfMonth) : undefined,
        dayOfWeek: form.frequency === 'weekly' ? toNum(form.dayOfWeek) : undefined,
        nextRunDate: form.startDate,
        projectId: form.projectId || undefined,
      });
      toast.success('Recurring invoice added');
      setShowForm(false);
      setForm({ customerName: '', customerEmail: '', customerPhone: '', description: '', amount: '', frequency: 'monthly', dayOfMonth: '1', dayOfWeek: '1', startDate: toISODate(new Date()), projectId: '' });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add recurring invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (invoices === null) {
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
        title="Recurring Invoices"
        description="A repeat client billed the same amount every period — set it up once and a real invoice is generated automatically each time it's due."
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Recurring Invoice'}
          </button>
        }
      >
        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input
              type="text" placeholder="Customer name" value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="email" placeholder="Customer email (optional)" value={form.customerEmail}
              onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="tel" placeholder="Customer phone (optional)" value={form.customerPhone}
              onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text" placeholder="Description (e.g. Monthly retainer)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {projects.length > 0 && (
              <select
                value={form.projectId}
                onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
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
              {submitting ? 'Saving…' : 'Save Recurring Invoice'}
            </button>
          </form>
        )}
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring invoices set up yet."
          description="Add a repeat client billed the same amount every period instead of creating the same invoice by hand each time."
        />
      ) : (
        <div className="space-y-2">
          {invoices.map(i => <InvoiceRow key={i.id} invoice={i} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
};

export default RecurringInvoices;
