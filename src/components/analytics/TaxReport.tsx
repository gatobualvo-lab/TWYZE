import { useEffect, useMemo, useState } from 'react';
import { Download, Landmark, Percent, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, EmptyState, StatCard, PeriodPicker, Skeleton, SkeletonStatGrid } from '../ui';
import { fetchTaxReport, SOURCE_LABEL, type TaxLine } from '../../services/tax/taxReportService';
import { formatCurrency, formatDate } from '../../utils/format';
import { csvCell } from '../../utils/safeContent';
import { periodFor, describePeriod, type Period } from '../../utils/period';

const TONE = {
  blue: { bg: 'bg-blue-100', color: 'text-blue-600' },
  purple: { bg: 'bg-purple-100', color: 'text-purple-600' },
  amber: { bg: 'bg-amber-100', color: 'text-amber-600' },
  green: { bg: 'bg-green-100', color: 'text-green-600' },
};

/** A CSV of the taxed sales and documents in the period — enough detail to hand to an accountant or use when filing. */
function buildTaxCsv(lines: TaxLine[]): string {
  const header = ['Date', 'Source', 'Reference', 'Customer', 'Taxable amount', 'Tax', 'Tax amount'].map(csvCell).join(',');
  const rows = lines.map(l =>
    [formatDate(l.date), SOURCE_LABEL[l.source], l.reference, l.customerName ?? '', l.taxableAmount, l.taxLabel, l.taxAmount].map(csvCell).join(',')
  );
  return ['﻿' + header, ...rows].join('\r\n');
}

/**
 * What tax has been charged — on POS sales, wholesale sales, and invoices/receipts — over a period the
 * owner chooses. Totals VAT and Turnover Tax separately, since they are filed separately with KRA, plus
 * whatever tax was typed directly on a document. Nothing here is computed fresh; it only adds up what each
 * sale or document already recorded.
 */
export default function TaxReport() {
  const [period, setPeriod] = useState<Period>(() => periodFor('month'));
  const [lines, setLines] = useState<TaxLine[] | null>(null);
  const [totals, setTotals] = useState({ vat: 0, turnoverTax: 0, documentTax: 0, total: 0 });

  useEffect(() => {
    let current = true;
    setLines(null);
    fetchTaxReport(period)
      .then(report => {
        if (!current) return;
        setLines(report.lines);
        setTotals(report.totals);
      })
      .catch(() => {
        if (current) toast.error('Could not load the tax report');
      });
    return () => { current = false; };
  }, [period]);

  const exportCsv = () => {
    if (!lines || lines.length === 0) return;
    const blob = new Blob([buildTaxCsv(lines)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${period.start || 'all'}-to-${period.end || 'now'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = lines === null;
  const hasLines = useMemo(() => (lines?.length ?? 0) > 0, [lines]);

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} title="Tax Report" />

      <PeriodPicker value={period} onChange={setPeriod} />

      {loading ? (
        <>
          <SkeletonStatGrid />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </>
      ) : !hasLines ? (
        <EmptyState
          icon={Landmark}
          title={`No tax recorded for ${describePeriod(period).toLowerCase()}`}
          description="VAT, Turnover Tax and document tax all show up here once a sale or invoice carries one."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="VAT (16%)" value={formatCurrency(totals.vat)} icon={Percent} iconBg={TONE.blue.bg} iconColor={TONE.blue.color} />
            <StatCard label="Turnover Tax (1.5%)" value={formatCurrency(totals.turnoverTax)} icon={Percent} iconBg={TONE.purple.bg} iconColor={TONE.purple.color} />
            <StatCard label="Tax on invoices & receipts" value={formatCurrency(totals.documentTax)} icon={Receipt} iconBg={TONE.amber.bg} iconColor={TONE.amber.color} />
            <StatCard label="Total tax" value={formatCurrency(totals.total)} icon={Landmark} iconBg={TONE.green.bg} iconColor={TONE.green.color} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{lines!.length} taxed {lines!.length === 1 ? 'line' : 'lines'} · {describePeriod(period)}</p>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-4 font-medium">Date</th>
                    <th className="py-2 px-4 font-medium">Source</th>
                    <th className="py-2 px-4 font-medium">Reference</th>
                    <th className="py-2 px-4 font-medium">Customer</th>
                    <th className="py-2 px-4 font-medium text-right">Taxable</th>
                    <th className="py-2 px-4 font-medium">Tax</th>
                    <th className="py-2 px-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines!.map(line => (
                    <tr key={line.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-4 whitespace-nowrap text-gray-500">{formatDate(line.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-gray-500">{SOURCE_LABEL[line.source]}</td>
                      <td className="py-2.5 px-4 max-w-[180px] truncate text-gray-800">{line.reference}</td>
                      <td className="py-2.5 px-4 max-w-[160px] truncate text-gray-500">{line.customerName || '—'}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-500">{formatCurrency(line.taxableAmount)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-gray-500">{line.taxLabel}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-900">{formatCurrency(line.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
