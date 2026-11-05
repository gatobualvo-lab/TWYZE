import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Package } from 'lucide-react';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import type { ProductProfit } from '../../services/metrics/metricsService';
import { fetchProductImages } from '../../services/inventory/productImages';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency } from '../../utils/format';
import { toISODate } from '../../utils/dateRange';

const DAYS = 30;
const SHOWN = 5;

/** The products that brought in the most over the period, biggest first, with how big each is next to the top one. */
export function topProducts(rows: ProductProfit[], count = SHOWN): Array<ProductProfit & { share: number }> {
  const best = rows
    .filter(r => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, count);
  const max = best[0]?.revenue ?? 0;
  return best.map(r => ({ ...r, share: max > 0 ? r.revenue / max : 0 }));
}

interface BestSellersProps {
  onOpen: () => void;
}

const RANK_BADGE = [
  'bg-amber-100 text-amber-700', // 1st
  'bg-gray-100 text-gray-600', // 2nd
  'bg-orange-50 text-orange-700', // 3rd
];

/**
 * A compact "what is selling" panel for the dashboard: a ranked leaderboard of the top products, biggest
 * first, each row a horizontal bar sized against the leader (the same form the Part-to-whole chart guidance
 * calls for when the reader needs to compare and rank parts, not just see one whole). Built in plain HTML
 * rather than a canvas chart so a product's own photo can sit on the row, which the shop owner recognises
 * faster than the name alone. Shows nothing until there are sales to rank.
 */
export default function BestSellers({ onOpen }: BestSellersProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const ctx = useMetricsContext();
  const [rows, setRows] = useState<ProductProfit[] | null>(null);
  const [images, setImages] = useState<Map<string, string>>(new Map());

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - DAYS);
    return { start: toISODate(start), end: toISODate(end) };
  }, []);

  useEffect(() => {
    let current = true;
    ctx.loadProfitByProduct(range, 50)
      .then(data => { if (current) setRows(data); })
      .catch(() => { if (current) setRows([]); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const best = useMemo(() => topProducts(rows ?? []), [rows]);

  useEffect(() => {
    if (best.length === 0) return;
    let current = true;
    fetchProductImages(best.map(p => p.productName))
      .then(map => { if (current) setImages(map); })
      .catch(() => {});
    return () => { current = false; };
  }, [best]);

  if (!rows || best.length === 0) return null;

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Best sellers · {DAYS} days</h2>
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          All <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <ol className="mt-3 space-y-3">
        {best.map((product, index) => {
          const image = images.get(product.productName);
          return (
            <li key={product.productName} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                  RANK_BADGE[index] ?? (isDark ? 'bg-slate-700 text-gray-400' : 'bg-gray-50 text-gray-400')
                }`}
              >
                {index + 1}
              </span>
              {image ? (
                <img src={image} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  <Package className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 truncate text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{product.productName}</span>
                  <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatCurrency(product.revenue)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className={`h-2 flex-1 overflow-hidden rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`} aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-smooth"
                      style={{ width: `${Math.max(4, Math.round(product.share * 100))}%` }}
                    />
                  </div>
                  <span className={`flex-shrink-0 text-xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {product.unitsSold} sold
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
