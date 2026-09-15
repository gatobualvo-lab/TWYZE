import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, Clock, DollarSign, TrendingUp, Phone, Mail, MapPin, FileText, ShoppingCart, Save, AlertCircle, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import type { CustomerProfit } from '../../services/metrics/metricsService';
import { getPeriodRange } from '../../utils/dateRange';
import { formatCurrency, formatDate } from '../../utils/format';
import { fetchOrCreateCustomer, updateCustomer, fetchCustomerTimeline } from '../../services/customers/customerService';
import type { Customer, TimelineEntry, CustomerStatus } from '../../services/customers/customerService';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import { PageHeader, EmptyState } from '../ui';

function isUnpaidEntry(entry: TimelineEntry): boolean {
  const status = entry.status?.toLowerCase();
  if (entry.kind === 'sale') return status === 'unpaid';
  if (entry.kind === 'invoice') return status === 'sent' || status === 'overdue';
  return false;
}

const INACTIVE_THRESHOLD_DAYS = 60;

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

const STATUS_STYLES: Record<CustomerStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-700',
};

const KIND_ICON: Record<TimelineEntry['kind'], React.ComponentType<{ className?: string }>> = {
  sale: ShoppingCart,
  quotation: FileText,
  invoice: FileText,
  receipt: FileText,
};

const KIND_LABEL: Record<TimelineEntry['kind'], string> = {
  sale: 'Sale',
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
};

function CustomerDetail({ summary, onBack }: { summary: CustomerProfit; onBack: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOrCreateCustomer(summary.customerName).then(c => {
      if (active && c) { setCustomer(c); setNotesDraft(c.notes ?? ''); }
    }).catch(() => {});
    fetchCustomerTimeline(summary.customerName).then(t => { if (active) setTimeline(t); }).catch(() => setTimeline([]));
    return () => { active = false; };
  }, [summary.customerName]);

  const inactiveDays = daysSince(summary.lastOrderDate);
  const isDormant = inactiveDays !== null && inactiveDays > INACTIVE_THRESHOLD_DAYS;

  const handleSaveNotes = async () => {
    if (!customer) return;
    try {
      setSavingNotes(true);
      await updateCustomer(customer.id, { notes: notesDraft });
      setCustomer({ ...customer, notes: notesDraft });
      toast.success('Notes saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusChange = async (status: CustomerStatus) => {
    if (!customer) return;
    setCustomer({ ...customer, status });
    try {
      await updateCustomer(customer.id, { status });
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <button onClick={onBack} className="group flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
        <ArrowLeft className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5" /> Back to customers
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{summary.customerName}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
              {customer?.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
              {customer?.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
              {customer?.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.address}</span>}
            </div>
          </div>
          {customer && (
            <select
              value={customer.status}
              onChange={e => handleStatusChange(e.target.value as CustomerStatus)}
              className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 cursor-pointer ${STATUS_STYLES[customer.status]}`}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          )}
        </div>

        {isDormant && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No orders in {inactiveDays} days — this customer may have gone dormant.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Lifetime Value</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(summary.revenue)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Profit</p>
            <p className={`text-lg font-bold tabular-nums ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summary.profit)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Orders</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{summary.transactionCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Last Order</p>
            <p className="text-sm font-semibold text-gray-900">{summary.lastOrderDate ? formatDate(summary.lastOrderDate) : '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-2">Notes</h3>
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          placeholder="Add a note about this customer — preferences, history, anything worth remembering."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
        <button
          onClick={handleSaveNotes}
          disabled={savingNotes || !customer}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> {savingNotes ? 'Saving…' : 'Save Notes'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Timeline</h3>
        {timeline === null ? (
          <p className="text-sm text-gray-400">Loading history…</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-gray-400">No sales or documents found for this customer yet.</p>
        ) : (
          <div className="space-y-3">
            {timeline.map(entry => {
              const Icon = KIND_ICON[entry.kind];
              const reminderLink = isUnpaidEntry(entry) && customer?.phone
                ? buildWhatsAppLink(
                    customer.phone,
                    `Hi ${summary.customerName}, this is a friendly reminder that you have an outstanding balance of ${formatCurrency(entry.amount)} for ${entry.title}. Kindly settle at your earliest convenience. Thank you!`
                  )
                : null;
              return (
                <div key={entry.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(entry.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{KIND_LABEL[entry.kind]} · {entry.date ? formatDate(entry.date) : 'Unknown date'}</span>
                      {entry.status && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{entry.status}</span>
                      )}
                      {reminderLink && (
                        <a
                          href={reminderLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 ml-auto"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Remind via WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomerTimeline: React.FC = () => {
  const ctx = useMetricsContext();
  const allTimeRange = useMemo(() => getPeriodRange('all'), []);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerProfit | null>(null);

  useEffect(() => {
    ctx.loadProfitByCustomer(allTimeRange, 200).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entry = ctx.getProfitByCustomer(allTimeRange, 200);
  const customers = entry.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => c.customerName.toLowerCase().includes(q));
  }, [customers, search]);

  if (entry.loading && !entry.data) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="h-6 w-48 skeleton-shimmer rounded-md" />
          <div className="h-10 w-full skeleton-shimmer rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <div className="h-4 w-2/3 skeleton-shimmer rounded" />
              <div className="h-3 w-1/2 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selected) {
    return <CustomerDetail summary={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title="Customer Timeline" description="Full history, lifetime value, and notes for every customer.">
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={customers.length === 0 ? 'No named customers on sales yet.' : 'No customers match your search.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const inactiveDays = daysSince(c.lastOrderDate);
            const isDormant = inactiveDays !== null && inactiveDays > INACTIVE_THRESHOLD_DAYS;
            return (
              <button
                key={c.customerName}
                onClick={() => setSelected(c)}
                className="text-left bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 truncate">{c.customerName}</p>
                  {isDormant && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Dormant</span>}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{c.transactionCount} order{c.transactionCount === 1 ? '' : 's'}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(c.revenue)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Last order {c.lastOrderDate ? formatDate(c.lastOrderDate) : 'unknown'}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerTimeline;
