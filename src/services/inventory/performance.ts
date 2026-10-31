import { isWithin, type Period } from '../../utils/period';

/** One product line from a recorded sale. */
export interface SaleLine {
  product_name: string | null;
  quantity: number | string | null;
  buying_price?: number | string | null;
  selling_price?: number | string | null;
  unit_price?: number | string | null;
  subtotal?: number | string | null;
  profit?: number | string | null;
  /** Day of the sale. */
  date: string | null;
}

export interface CatalogItem {
  product_name: string;
  category: string | null;
  current_stock?: number | null;
  item_type?: string | null;
}

export interface PerformanceRow {
  key: string;
  name: string;
  category: string;
  units: number;
  /** Sales that included it (one per recorded sale line). */
  orders: number;
  revenue: number;
  profit: number;
  /** Profit as a share of revenue, or null when nothing was sold. */
  margin: number | null;
  /** Share of all revenue in the period (0 to 1). */
  share: number;
  /** Stock on hand for a single product; null for a category. */
  stock: number | null;
  /** Products in a category row; 1 for a product. */
  products: number;
}

export interface PerformanceSummary {
  products: PerformanceRow[];
  categories: PerformanceRow[];
  totals: { units: number; orders: number; revenue: number; profit: number; margin: number | null };
}

export const UNCATEGORISED = 'Uncategorised';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const has = (v: unknown): boolean => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const norm = (name: string | null | undefined) => (name ?? '').trim().toLowerCase();

/** What the line brought in: the recorded subtotal, else quantity times the selling price. */
export function lineRevenue(line: SaleLine): number {
  if (has(line.subtotal)) return num(line.subtotal);
  const price = has(line.selling_price) ? num(line.selling_price) : num(line.unit_price);
  return num(line.quantity) * price;
}

/** The line's profit: the recorded figure, else revenue minus what the goods cost. */
export function lineProfit(line: SaleLine): number {
  if (has(line.profit)) return num(line.profit);
  return lineRevenue(line) - num(line.quantity) * num(line.buying_price);
}

const margin = (profit: number, revenue: number) => (revenue > 0 ? profit / revenue : null);

/**
 * Sales per product and per category over a period. Products that sold nothing are kept (at
 * the bottom) so slow stock is visible too.
 */
export function summarizePerformance(
  lines: SaleLine[],
  catalog: CatalogItem[],
  period: Pick<Period, 'start' | 'end'>
): PerformanceSummary {
  const catalogByName = new Map<string, CatalogItem>();
  for (const item of catalog) catalogByName.set(norm(item.product_name), item);

  const byProduct = new Map<string, PerformanceRow>();
  const ensure = (name: string): PerformanceRow => {
    const key = norm(name);
    let row = byProduct.get(key);
    if (!row) {
      const item = catalogByName.get(key);
      row = {
        key,
        name: item?.product_name ?? name.trim(),
        category: item?.category?.trim() || UNCATEGORISED,
        units: 0,
        orders: 0,
        revenue: 0,
        profit: 0,
        margin: null,
        share: 0,
        stock: item && item.item_type !== 'service' ? num(item.current_stock) : null,
        products: 1,
      };
      byProduct.set(key, row);
    }
    return row;
  };

  for (const item of catalog) ensure(item.product_name);

  const totals = { units: 0, orders: 0, revenue: 0, profit: 0, margin: null as number | null };
  for (const line of lines) {
    if (!line.product_name?.trim() || !isWithin(line.date, period)) continue;
    const row = ensure(line.product_name);
    const revenue = lineRevenue(line);
    const profit = lineProfit(line);
    row.units += num(line.quantity);
    row.orders += 1;
    row.revenue += revenue;
    row.profit += profit;
    totals.units += num(line.quantity);
    totals.orders += 1;
    totals.revenue += revenue;
    totals.profit += profit;
  }
  totals.margin = margin(totals.profit, totals.revenue);

  // "Office Chair" and "office chair" are one category. The best-selling product's spelling is the one shown.
  const best = (a: PerformanceRow, b: PerformanceRow) => b.revenue - a.revenue || b.profit - a.profit || a.name.localeCompare(b.name);
  const byCategory = new Map<string, PerformanceRow>();
  for (const row of [...byProduct.values()].sort(best)) {
    row.margin = margin(row.profit, row.revenue);
    row.share = totals.revenue > 0 ? row.revenue / totals.revenue : 0;

    const catKey = row.category.toLowerCase();
    let cat = byCategory.get(catKey);
    if (!cat) {
      cat = { key: catKey, name: row.category, category: row.category, units: 0, orders: 0, revenue: 0, profit: 0, margin: null, share: 0, stock: null, products: 0 };
      byCategory.set(catKey, cat);
    }
    cat.units += row.units;
    cat.orders += row.orders;
    cat.revenue += row.revenue;
    cat.profit += row.profit;
    cat.products += 1;
  }
  for (const cat of byCategory.values()) {
    cat.margin = margin(cat.profit, cat.revenue);
    cat.share = totals.revenue > 0 ? cat.revenue / totals.revenue : 0;
  }

  return {
    products: [...byProduct.values()].sort(best),
    categories: [...byCategory.values()].sort(best),
    totals,
  };
}
