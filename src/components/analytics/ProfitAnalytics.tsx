import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, Users, Truck } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import type { ProductProfit, VendorProfit, CustomerProfit } from '../../services/metrics/metricsService';
import { getPeriodRange, formatPeriodLabel, type PeriodKey } from '../../utils/dateRange';
import { formatCurrency, formatDate } from '../../utils/format';
import { PageHeader, EmptyState, StatCard } from '../ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const PERIODS: PeriodKey[] = ['week', 'month', 'quarter', 'year', 'all'];

type Dimension = 'product' | 'vendor' | 'customer';

const DIMENSION_TABS: { key: Dimension; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'product', label: 'By Product', icon: Package },
  { key: 'vendor', label: 'By Vendor', icon: Truck },
  { key: 'customer', label: 'By Customer', icon: Users },
];

const TONE_CLASSES: Record<'blue' | 'green' | 'red' | 'purple', { bg: string; color: string }> = {
  blue: { bg: 'bg-blue-100', color: 'text-blue-600' },
  green: { bg: 'bg-green-100', color: 'text-green-600' },
  red: { bg: 'bg-red-100', color: 'text-red-600' },
  purple: { bg: 'bg-purple-100', color: 'text-purple-600' },
};

const TableEmptyMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center py-10 text-gray-500 text-sm">{message}</div>
);

function ProductTable({ rows }: { rows: ProductProfit[] }) {
  if (rows.length === 0) return <TableEmptyMessage message="No product sales in this period yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">Product</th>
            <th className="py-2 px-3 font-medium text-right">Units</th>
            <th className="py-2 px-3 font-medium text-right">Revenue</th>
            <th className="py-2 px-3 font-medium text-right">Profit</th>
            <th className="py-2 pl-3 font-medium text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.productName} className="border-b border-gray-100 last:border-b-0">
              <td className="py-2.5 pr-3 text-gray-900 font-medium">{r.productName}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{r.unitsSold}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.revenue)}</td>
              <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(r.profit)}
              </td>
              <td className="py-2.5 pl-3 text-right text-gray-500 tabular-nums">
                {r.marginPct === null ? '—' : `${r.marginPct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorTable({ rows }: { rows: VendorProfit[] }) {
  if (rows.length === 0) return <TableEmptyMessage message="No vendor purchases in this period yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">Vendor</th>
            <th className="py-2 px-3 font-medium text-right">Units</th>
            <th className="py-2 px-3 font-medium text-right">Revenue</th>
            <th className="py-2 pl-3 font-medium text-right">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.vendorName} className="border-b border-gray-100 last:border-b-0">
              <td className="py-2.5 pr-3 text-gray-900 font-medium">{r.vendorName}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{r.unitsBought}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.revenue)}</td>
              <td className={`py-2.5 pl-3 text-right font-medium tabular-nums ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(r.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTable({ rows }: { rows: CustomerProfit[] }) {
  if (rows.length === 0) return <TableEmptyMessage message="No named customers in this period yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">Customer</th>
            <th className="py-2 px-3 font-medium text-right">Orders</th>
            <th className="py-2 px-3 font-medium text-right">Revenue</th>
            <th className="py-2 px-3 font-medium text-right">Profit</th>
            <th className="py-2 pl-3 font-medium text-right">Last Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.customerName} className="border-b border-gray-100 last:border-b-0">
              <td className="py-2.5 pr-3 text-gray-900 font-medium">{r.customerName}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{r.transactionCount}</td>
              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.revenue)}</td>
              <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(r.profit)}
              </td>
              <td className="py-2.5 pl-3 text-right text-gray-500 tabular-nums">
                {r.lastOrderDate ? formatDate(r.lastOrderDate) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ProfitAnalytics: React.FC = () => {
  const ctx = useMetricsContext();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [dimension, setDimension] = useState<Dimension>('product');

  const range = useMemo(() => getPeriodRange(period), [period]);

  useEffect(() => {
    ctx.loadMetrics(range).catch(() => {});
    ctx.loadDailySeries(range).catch(() => {});
    ctx.loadProfitByProduct(range).catch(() => {});
    ctx.loadProfitByVendor(range).catch(() => {});
    ctx.loadProfitByCustomer(range).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const metricsEntry = ctx.getMetrics(range);
  const dailyEntry = ctx.getDailySeries(range);
  const productEntry = ctx.getProfitByProduct(range);
  const vendorEntry = ctx.getProfitByVendor(range);
  const customerEntry = ctx.getProfitByCustomer(range);

  const metrics = metricsEntry.data;
  const isInitialLoad = metricsEntry.loading && !metrics;

  const chartData = useMemo(() => {
    const daily = dailyEntry.data ?? [];
    return {
      labels: daily.map(d => formatDate(d.day, { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Revenue',
          data: daily.map(d => d.revenue),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Profit',
          data: daily.map(d => d.profit),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.08)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  }, [dailyEntry.data]);

  if (isInitialLoad) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-40 skeleton-shimmer rounded-md" />
          <div className="h-4 w-64 skeleton-shimmer rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <div className="w-9 h-9 skeleton-shimmer rounded-lg" />
              <div className="h-3 w-20 skeleton-shimmer rounded" />
              <div className="h-6 w-16 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalRevenue = (metrics?.salesRevenue ?? 0) + (metrics?.supplierRevenue ?? 0);
  const hasAnyData = totalRevenue > 0 || (metrics?.totalExpenses ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Percent}
        title="Profit Analytics"
        description="What's actually making you money, and what isn't."
        actions={
          <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all duration-150 active:scale-95 ${
                  period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {formatPeriodLabel(p)}
              </button>
            ))}
          </div>
        }
      />

      {!hasAnyData ? (
        <EmptyState
          icon={TrendingUp}
          title={`No sales or expenses recorded for ${formatPeriodLabel(period).toLowerCase()} yet.`}
          description="Record a sale and this page fills in automatically."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} iconBg={TONE_CLASSES.blue.bg} iconColor={TONE_CLASSES.blue.color} />
            <StatCard
              label="Net Profit"
              value={formatCurrency(metrics?.netProfit ?? 0)}
              icon={(metrics?.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
              iconBg={TONE_CLASSES[(metrics?.netProfit ?? 0) >= 0 ? 'green' : 'red'].bg}
              iconColor={TONE_CLASSES[(metrics?.netProfit ?? 0) >= 0 ? 'green' : 'red'].color}
            />
            <StatCard
              label="Net Margin"
              value={metrics?.netMarginPct === null || metrics?.netMarginPct === undefined ? '—' : `${metrics.netMarginPct.toFixed(1)}%`}
              icon={Percent}
              iconBg={TONE_CLASSES.purple.bg}
              iconColor={TONE_CLASSES.purple.color}
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(metrics?.totalExpenses ?? 0)}
              sublabel={`Ads ${formatCurrency(metrics?.adExpenses ?? 0)} · Vendor ${formatCurrency(metrics?.vendorExpenses ?? 0)} · General ${formatCurrency(metrics?.generalExpenses ?? 0)}`}
              icon={TrendingDown}
              iconBg={TONE_CLASSES.red.bg}
              iconColor={TONE_CLASSES.red.color}
            />
          </div>

          {(dailyEntry.data?.length ?? 0) > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fadeIn">
              <h3 className="font-semibold text-gray-800 mb-4">Revenue vs. Profit</h3>
              <div className="h-64">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: { ticks: { callback: v => formatCurrency(Number(v)) } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fadeIn">
            <div className="flex gap-1 mb-4 border-b border-gray-100 -mx-6 px-6">
              {DIMENSION_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDimension(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    dimension === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {dimension === 'product' && <ProductTable rows={productEntry.data ?? []} />}
            {dimension === 'vendor' && <VendorTable rows={vendorEntry.data ?? []} />}
            {dimension === 'customer' && <CustomerTable rows={customerEntry.data ?? []} />}
          </div>
        </>
      )}
    </div>
  );
};

export default ProfitAnalytics;
