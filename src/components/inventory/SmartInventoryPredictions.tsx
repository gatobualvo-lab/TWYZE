import React, { useEffect, useMemo, useState } from 'react';
import { Package, AlertTriangle, TrendingUp, TrendingDown, Ban, Sparkles, ShoppingCart } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import { forecastStock, INVENTORY_FORECAST_CONSTANTS, type StockForecast, type StockoutRisk } from '../../services/inventory/inventoryForecast';
import { formatDate } from '../../utils/format';
import { PageHeader, EmptyState, SkeletonStatGrid } from '../ui';

export interface InventoryRow {
  product_name: string | null;
  current_stock: number | null;
  reorder_level: number | null;
  created_at: string | null;
}

const RISK_STYLES: Record<StockoutRisk, { badge: string; label: string }> = {
  high: { badge: 'bg-red-100 text-red-700', label: 'High Risk' },
  medium: { badge: 'bg-amber-100 text-amber-700', label: 'Medium Risk' },
  low: { badge: 'bg-green-100 text-green-700', label: 'Low Risk' },
  unknown: { badge: 'bg-gray-100 text-gray-500', label: 'Unknown' },
};

const MOVEMENT_META = {
  fast: { icon: TrendingUp, label: 'Fast-Moving', color: 'text-green-600' },
  slow: { icon: TrendingDown, label: 'Slow-Moving', color: 'text-amber-600' },
  dead: { icon: Ban, label: 'Dead Stock', color: 'text-red-600' },
  new: { icon: Sparkles, label: 'New Product', color: 'text-blue-600' },
} as const;

export async function fetchInventoryWithMeta(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('product_name, current_stock, reorder_level, created_at')
    .eq('is_deleted', false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const ForecastCard: React.FC<{ forecast: StockForecast }> = ({ forecast }) => {
  const movement = MOVEMENT_META[forecast.movement];
  const risk = RISK_STYLES[forecast.stockoutRisk];
  const MovementIcon = movement.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-900 truncate">{forecast.productName}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${risk.badge}`}>{risk.label}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <MovementIcon className={`w-4 h-4 ${movement.color}`} />
        <span className={`text-xs font-medium ${movement.color}`}>{movement.label}</span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{forecast.explanation}</p>
      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
        <span className="text-gray-500">In stock</span>
        <span className="font-medium text-gray-900 tabular-nums">{forecast.currentStock}</span>
      </div>
      {forecast.recommendedReorderQty !== null && forecast.recommendedReorderQty > 0 && (
        <div className="mt-2 flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg px-2.5 py-1.5">
          <ShoppingCart className="w-3.5 h-3.5" />
          Reorder ~{forecast.recommendedReorderQty} units
        </div>
      )}
    </div>
  );
};

type FilterKey = 'all' | 'reorder' | 'fast' | 'slow' | 'dead' | 'new';

const SmartInventoryPredictions: React.FC = () => {
  const ctx = useMetricsContext();
  const velocityRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - INVENTORY_FORECAST_CONSTANTS.VELOCITY_WINDOW_DAYS);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(start), end: fmt(end) };
  }, []);

  const [inventory, setInventory] = useState<InventoryRow[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    fetchInventoryWithMeta().then(setInventory).catch(() => setInventory([]));
    ctx.loadProfitByProduct(velocityRange, 500).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salesEntry = ctx.getProfitByProduct(velocityRange, 500);

  const forecasts = useMemo(() => {
    if (!inventory || !salesEntry.data) return null;
    const salesByName = new Map(salesEntry.data.map(row => [row.productName.trim().toLowerCase(), row.unitsSold]));

    return inventory
      .filter(item => item.product_name)
      .map(item =>
        forecastStock({
          productName: item.product_name!,
          currentStock: item.current_stock ?? 0,
          reorderLevel: item.reorder_level ?? 0,
          createdAt: item.created_at,
          unitsSoldInWindow: salesByName.get(item.product_name!.trim().toLowerCase()) ?? 0,
        })
      )
      .sort((a, b) => {
        const order: Record<StockoutRisk, number> = { high: 0, medium: 1, unknown: 2, low: 3 };
        return order[a.stockoutRisk] - order[b.stockoutRisk];
      });
  }, [inventory, salesEntry.data]);

  const isLoading = forecasts === null;

  const filtered = useMemo(() => {
    if (!forecasts) return [];
    switch (filter) {
      case 'reorder': return forecasts.filter(f => (f.recommendedReorderQty ?? 0) > 0);
      case 'fast': return forecasts.filter(f => f.movement === 'fast');
      case 'slow': return forecasts.filter(f => f.movement === 'slow');
      case 'dead': return forecasts.filter(f => f.movement === 'dead');
      case 'new': return forecasts.filter(f => f.movement === 'new');
      default: return forecasts;
    }
  }, [forecasts, filter]);

  const counts = useMemo(() => {
    if (!forecasts) return { reorder: 0, fast: 0, slow: 0, dead: 0, new: 0 };
    return {
      reorder: forecasts.filter(f => (f.recommendedReorderQty ?? 0) > 0).length,
      fast: forecasts.filter(f => f.movement === 'fast').length,
      slow: forecasts.filter(f => f.movement === 'slow').length,
      dead: forecasts.filter(f => f.movement === 'dead').length,
      new: forecasts.filter(f => f.movement === 'new').length,
    };
  }, [forecasts]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-64 skeleton-shimmer rounded-md" />
          <div className="h-4 w-full max-w-xl skeleton-shimmer rounded-md" />
        </div>
        <SkeletonStatGrid count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Smart Inventory Predictions">
        <p className="text-gray-500 text-sm mt-0.5">
          Based on sales over the last {INVENTORY_FORECAST_CONSTANTS.VELOCITY_WINDOW_DAYS} days ({formatDate(velocityRange.start)} – {formatDate(velocityRange.end)}).
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Products added in the last {INVENTORY_FORECAST_CONSTANTS.NEW_PRODUCT_GRACE_DAYS} days are marked "New" rather than predicted — there isn't enough sales history yet to trust a forecast.
        </p>
      </PageHeader>

      {forecasts && forecasts.length === 0 ? (
        <EmptyState icon={Package} title="No inventory items yet." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', `All (${forecasts?.length ?? 0})`],
              ['reorder', `Needs Reorder (${counts.reorder})`],
              ['fast', `Fast-Moving (${counts.fast})`],
              ['slow', `Slow-Moving (${counts.slow})`],
              ['dead', `Dead Stock (${counts.dead})`],
              ['new', `New (${counts.new})`],
            ] as [FilterKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 active:scale-95 ${
                  filter === key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {counts.reorder > 0 && filter === 'all' && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 animate-slide-up">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {counts.reorder} product{counts.reorder === 1 ? '' : 's'} should be reordered soon — filter by "Needs Reorder" to see them.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f, i) => (
              <div key={f.productName} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, animationFillMode: 'backwards' }}>
                <ForecastCard forecast={f} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SmartInventoryPredictions;
