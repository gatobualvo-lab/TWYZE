import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Wallet, TrendingUp, TrendingDown, Receipt, ShoppingBag } from 'lucide-react';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import { formatCurrency, formatDate } from '../../utils/format';
import { PageHeader, EmptyState } from '../ui';

// One-day operational summary. Deliberately built almost entirely on
// get_business_metrics scoped to a single day (start === end) rather than a
// new SQL function — the existing metrics engine already separates accrual
// revenue/profit from cash actually collected, which is the one thing a
// closing report absolutely cannot get wrong (conflating "sales recorded
// today" with "cash in hand today" is a classic bookkeeping mistake).

interface PaymentMethodTotal {
  method: string;
  amount: number;
  count: number;
}

function useLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchPaymentMethodBreakdown(date: string): Promise<PaymentMethodTotal[]> {
  // `date` is stored as timestamptz, not a plain date — a range comparison
  // (rather than exact equality against a date-only string) is robust
  // regardless of what time-of-day component a given row happens to carry.
  const nextDay = new Date(date + 'T00:00:00Z');
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sales')
    .select('payment_method, selling_price')
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .gte('date', date)
    .lt('date', nextDayStr);

  if (error || !data) return [];

  const totals = new Map<string, { amount: number; count: number }>();
  for (const row of data) {
    const method = row.payment_method?.trim() || 'Unspecified';
    const existing = totals.get(method) ?? { amount: 0, count: 0 };
    existing.amount += toNum(row.selling_price);
    existing.count += 1;
    totals.set(method, existing);
  }

  return Array.from(totals.entries())
    .map(([method, v]) => ({ method, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);
}

const Row: React.FC<{ label: string; value: string; emphasis?: boolean; tone?: 'default' | 'green' | 'red'; sub?: string }> = ({
  label, value, emphasis, tone = 'default', sub,
}) => (
  <div className={`flex items-center justify-between py-3 ${emphasis ? '' : 'border-b border-gray-100 last:border-b-0'}`}>
    <div>
      <span className={`text-sm ${emphasis ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    <span
      className={`tabular-nums ${emphasis ? 'text-lg font-bold' : 'text-sm font-medium'} ${
        tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
      }`}
    >
      {value}
    </span>
  </div>
);

const DailyClosingReport: React.FC = () => {
  const ctx = useMetricsContext();
  const today = useLocalToday();
  const [date, setDate] = useState(today);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodTotal[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);

  const range = useMemo(() => ({ start: date, end: date }), [date]);

  useEffect(() => {
    ctx.loadMetrics(range).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  useEffect(() => {
    let active = true;
    setPaymentMethodsLoading(true);
    fetchPaymentMethodBreakdown(date).then(result => {
      if (active) {
        setPaymentMethods(result);
        setPaymentMethodsLoading(false);
      }
    });
    return () => { active = false; };
  }, [date]);

  const entry = ctx.getMetrics(range);
  const metrics = entry.data;
  const isLoading = entry.loading && !metrics;

  const shiftDay = (delta: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const shifted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (shifted <= today) setDate(shifted);
  };

  const totalRevenue = (metrics?.salesRevenue ?? 0) + (metrics?.supplierRevenue ?? 0);
  const uncollected = totalRevenue - (metrics?.cashReceived ?? 0);
  const hasActivity = totalRevenue > 0 || (metrics?.totalExpenses ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Daily Closing Report"
        description="Today's numbers, reconciled — what came in, what's still owed, what it cost."
        actions={
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-md hover:bg-white text-gray-600 transition-colors" aria-label="Previous day">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex items-center gap-1.5 px-2 text-sm font-medium text-gray-800">
              <Calendar className="w-4 h-4 text-gray-500" />
              {date === today ? 'Today' : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => shiftDay(1)}
              disabled={date >= today}
              className="p-1.5 rounded-md hover:bg-white text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
              <div className="h-4 w-40 skeleton-shimmer rounded" />
              {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-5 w-full skeleton-shimmer rounded" />)}
            </div>
          ))}
        </div>
      ) : !hasActivity ? (
        <EmptyState icon={Receipt} title={`No sales or expenses recorded for ${date === today ? 'today' : formatDate(date)}.`} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" /> Revenue &amp; Profit
            </h3>
            <p className="text-xs text-gray-400 mb-2">Accrual basis — every sale recorded today, whether paid or not.</p>
            <Row label="Sales revenue" value={formatCurrency(metrics?.salesRevenue ?? 0)} />
            <Row label="Supplier-tracked revenue" value={formatCurrency(metrics?.supplierRevenue ?? 0)} />
            <Row label="Gross profit" value={formatCurrency(metrics?.grossProfit ?? 0)} tone={(metrics?.grossProfit ?? 0) >= 0 ? 'green' : 'red'} />
            <Row
              label="Net profit"
              value={formatCurrency(metrics?.netProfit ?? 0)}
              tone={(metrics?.netProfit ?? 0) >= 0 ? 'green' : 'red'}
              emphasis
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-600" /> Cash Collected
            </h3>
            <p className="text-xs text-gray-400 mb-2">Cash basis — only money actually received today. Not the same as profit.</p>
            <Row label="Cash received" value={formatCurrency(metrics?.cashReceived ?? 0)} tone="green" />
            <Row
              label="Still uncollected from today's sales"
              value={formatCurrency(Math.max(0, uncollected))}
              tone={uncollected > 0 ? 'red' : 'default'}
            />
            {paymentMethodsLoading ? (
              <p className="text-xs text-gray-400 mt-3">Loading payment methods…</p>
            ) : paymentMethods.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By payment method</p>
                {paymentMethods.map(pm => (
                  <div key={pm.method} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600">{pm.method} <span className="text-gray-400">×{pm.count}</span></span>
                    <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(pm.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" /> Expenses
            </h3>
            <p className="text-xs text-gray-400 mb-2">Money spent today.</p>
            <Row label="Ad spend" value={formatCurrency(metrics?.adExpenses ?? 0)} />
            <Row label="Vendor payments" value={formatCurrency(metrics?.vendorExpenses ?? 0)} />
            <Row label="General expenses" value={formatCurrency(metrics?.generalExpenses ?? 0)} />
            <Row label="Total expenses" value={formatCurrency(metrics?.totalExpenses ?? 0)} emphasis />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-600" /> Activity
            </h3>
            <p className="text-xs text-gray-400 mb-2">How busy today was.</p>
            <Row label="Sales recorded" value={String(metrics?.salesCount ?? 0)} />
            <Row label="Supplier transactions" value={String(metrics?.supplierCount ?? 0)} />
            <Row
              label="Total transactions"
              value={String(metrics?.transactionCount ?? 0)}
              emphasis
            />
          </div>
        </div>
      )}

      {hasActivity && uncollected > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-slide-up">
          <TrendingUp className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">{formatCurrency(uncollected)}</span> of today's sales hasn't been collected yet.
            Revenue and profit above already include it — cash in hand is {formatCurrency(metrics?.cashReceived ?? 0)} less.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyClosingReport;
