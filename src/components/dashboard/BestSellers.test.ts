import { describe, it, expect } from 'vitest';
import { topProducts } from './BestSellers';
import type { ProductProfit } from '../../services/metrics/metricsService';

const row = (productName: string, revenue: number): ProductProfit => ({ productName, unitsSold: 1, revenue, cost: 0, profit: revenue, marginPct: null, transactionCount: 1 });

describe('topProducts', () => {
  it('ranks by what each brought in, biggest first, and sizes the bars against the top one', () => {
    const result = topProducts([row('Sugar', 500), row('Rice', 2000), row('Salt', 1000)]);
    expect(result.map(r => r.productName)).toEqual(['Rice', 'Salt', 'Sugar']);
    expect(result.map(r => r.share)).toEqual([1, 0.5, 0.25]);
  });

  it('shows only the top five and skips products that sold nothing', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`P${i}`, (i + 1) * 100));
    rows.push(row('Unsold', 0));
    const result = topProducts(rows);
    expect(result).toHaveLength(5);
    expect(result[0].productName).toBe('P7');
    expect(result.some(r => r.productName === 'Unsold')).toBe(false);
  });

  it('is empty when nothing has sold', () => {
    expect(topProducts([])).toEqual([]);
    expect(topProducts([row('A', 0)])).toEqual([]);
  });
});
