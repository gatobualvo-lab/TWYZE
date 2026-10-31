import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabase';
import { formatCurrency } from '../../utils/format';
import PeriodPicker from '../ui/PeriodPicker';
import Spinner from '../ui/Spinner';
import { periodFor, describePeriod, type Period } from '../../utils/period';
import {
  summarizePerformance,
  type CatalogItem,
  type PerformanceRow,
  type SaleLine,
} from '../../services/inventory/performance';

type Grouping = 'product' | 'category';
type SortKey = 'revenue' | 'profit' | 'units' | 'margin';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'revenue', label: 'Sales' },
  { key: 'profit', label: 'Profit' },
  { key: 'units', label: 'Units' },
  { key: 'margin', label: 'Margin' },
];

interface Props {
  /** The business's products, for categories and stock levels. */
  items: CatalogItem[];
}

interface SaleItemRow {
  product_name: string | null;
  quantity: number | null;
  buying_price: number | null;
  selling_price: number | null;
  unit_price: number | null;
  subtotal: number | null;
  profit: number | null;
  sale: { date: string | null; sale_date: string | null; is_deleted: boolean | null; is_archived: boolean | null } | { date: string | null; sale_date: string | null; is_deleted: boolean | null; is_archived: boolean | null }[] | null;
}

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);

/** Best and slowest sellers, per product and per category, over a period the owner chooses. */
export default function ProductPerformance({ items }: Props) {
  const [lines, setLines] = useState<SaleLine[] | null>(null);
  const [period, setPeriod] = useState<Period>(() => periodFor('month'));
  const [grouping, setGrouping] = useState<Grouping>('product');
  const [sort, setSort] = useState<SortKey>('revenue');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await supabase
          .from('sale_items')
          .select(`
            product_name, quantity, buying_price, selling_price, unit_price, subtotal, profit,
            sale:sales!sale_items_sale_id_fkey ( date, sale_date, is_deleted, is_archived )
          `)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .range(0, 49999);
        if (error) throw error;
        if (cancelled) return;
        const mapped: SaleLine[] = [];
        for (const row of (data ?? []) as unknown as SaleItemRow[]) {
          const sale = Array.isArray(row.sale) ? row.sale[0] : row.sale;
          if (!sale || sale.is_deleted || sale.is_archived) continue;
          mapped.push({
            product_name: row.product_name,
            quantity: row.quantity,
            buying_price: row.buying_price,
            selling_price: row.selling_price,
            unit_price: row.unit_price,
            subtotal: row.subtotal,
            profit: row.profit,
            date: sale.date ?? sale.sale_date,
          });
        }
        setLines(mapped);
      } catch (err) {
        console.error('Error loading product performance:', err);
        toast.error('Could not load sales for the performance view');
        if (!cancelled) setLines([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => summarizePerformance(lines ?? [], items, period), [lines, items, period]);

  const rows = useMemo(() => {
    const list = [...(grouping === 'product' ? summary.products : summary.categories)];
    const value = (r: PerformanceRow) => (sort === 'margin' ? r.margin ?? -1 : r[sort]);
    return list.sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
  }, [summary, grouping, sort]);

  if (lines === null) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
        <Spinner className="w-5 h-5" tone="brand" /> Loading performance…
      </div>
    );
  }

  const { totals } = summary;
  const cards = [
    { label: 'Sales', value: formatCurrency(totals.revenue), tone: 'text-gray-900' },
    { label: 'Profit', value: formatCurrency(totals.profit), tone: totals.profit < 0 ? 'text-red-600' : 'text-green-600' },
    { label: 'Margin', value: percent(totals.margin), tone: 'text-gray-900' },
    { label: 'Units sold', value: String(totals.units), tone: 'text-gray-900' },
  ];
  const sold = rows.filter(r => r.orders > 0);
  const unsold = rows.filter(r => r.orders === 0);

  return (
    <div className="space-y-5">
      <PeriodPicker value={period} onChange={setPeriod} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label={`Totals for ${describePeriod(period)}`}>
        {cards.map(card => (
          <div key={card.label} className="rounded-lg bg-gray-50 border border-gray-100 p-3 min-w-0">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-lg font-bold truncate ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Group by" className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['product', 'category'] as Grouping[]).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={grouping === option}
              onClick={() => setGrouping(option)}
              className={`px-4 py-2 text-sm font-medium ${grouping === option ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              By {option}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rank by
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
          >
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {sold.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" aria-hidden="true" />
          No sales recorded for {describePeriod(period).toLowerCase()}.
        </div>
      ) : (
        <ol className="space-y-3">
          {sold.map((row, index) => (
            <li key={row.key} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    <span className="text-gray-400 font-normal mr-2">{index + 1}.</span>
                    {row.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {grouping === 'product'
                      ? `${row.category}${row.stock !== null ? ` · ${row.stock} in stock` : ''}`
                      : `${row.products} product${row.products === 1 ? '' : 's'}`}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">{Math.round(row.share * 100)}% of sales</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-xs text-gray-500">Sales</dt><dd className="font-medium">{formatCurrency(row.revenue)}</dd></div>
                <div><dt className="text-xs text-gray-500">Profit</dt><dd className={`font-medium ${row.profit < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(row.profit)}</dd></div>
                <div><dt className="text-xs text-gray-500">Margin</dt><dd className="font-medium">{percent(row.margin)}</dd></div>
                <div><dt className="text-xs text-gray-500">Units sold</dt><dd className="font-medium">{row.units}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      )}

      {unsold.length > 0 && sold.length > 0 && (
        <details className="rounded-xl border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            {unsold.length} {grouping === 'product' ? 'product' : 'categor'}{grouping === 'product' ? (unsold.length === 1 ? '' : 's') : (unsold.length === 1 ? 'y' : 'ies')} with no sales in this period
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            {unsold.map(row => (
              <li key={row.key} className="flex justify-between gap-3">
                <span className="truncate">{row.name}</span>
                <span className="text-gray-400 whitespace-nowrap">
                  {grouping === 'product' ? (row.stock !== null ? `${row.stock} in stock` : row.category) : `${row.products} product${row.products === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
