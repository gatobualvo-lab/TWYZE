import { describe, it, expect } from 'vitest';
import { lineProfit, lineRevenue, summarizePerformance, UNCATEGORISED, type CatalogItem, type SaleLine } from './performance';

const ALL = { start: '', end: '' };
const line = (over: Partial<SaleLine>): SaleLine => ({ product_name: 'Desk', quantity: 1, selling_price: 100, buying_price: 60, date: '2026-10-10', ...over });

describe('lineRevenue / lineProfit', () => {
  it('prefer the recorded subtotal and profit', () => {
    expect(lineRevenue(line({ subtotal: 250, quantity: 2, selling_price: 100 }))).toBe(250);
    expect(lineProfit(line({ profit: 40, subtotal: 250 }))).toBe(40);
  });

  it('fall back to quantity x price, and to price minus cost', () => {
    expect(lineRevenue(line({ subtotal: null, quantity: 3, selling_price: 100 }))).toBe(300);
    expect(lineRevenue(line({ subtotal: null, selling_price: null, unit_price: 80, quantity: 2 }))).toBe(160);
    expect(lineProfit(line({ profit: null, subtotal: null, quantity: 3, selling_price: 100, buying_price: 60 }))).toBe(120);
  });

  it('treats a recorded zero as zero, not as missing', () => {
    expect(lineRevenue(line({ subtotal: 0, selling_price: 100 }))).toBe(0);
    expect(lineProfit(line({ profit: 0 }))).toBe(0);
  });

  it('survives junk', () => {
    expect(lineRevenue(line({ subtotal: 'abc' as unknown as number, quantity: 'x' as unknown as number }))).toBe(0);
  });
});

describe('summarizePerformance', () => {
  const catalog: CatalogItem[] = [
    { product_name: 'Desk', category: 'Furniture', current_stock: 5 },
    { product_name: 'Chair', category: 'Furniture', current_stock: 20 },
    { product_name: 'Lamp', category: 'Lighting', current_stock: 8 },
    { product_name: 'Haircut', category: null, item_type: 'service' },
  ];

  it('totals units, revenue and profit per product', () => {
    const { products, totals } = summarizePerformance(
      [line({ quantity: 2, subtotal: 200, profit: 80 }), line({ quantity: 1, subtotal: 100, profit: 40 }), line({ product_name: 'chair', quantity: 4, subtotal: 400, profit: 100 })],
      catalog,
      ALL
    );
    const desk = products.find(p => p.name === 'Desk')!;
    expect(desk).toMatchObject({ units: 3, orders: 2, revenue: 300, profit: 120, stock: 5, category: 'Furniture' });
    expect(desk.margin).toBeCloseTo(0.4);
    expect(products.find(p => p.name === 'Chair')).toMatchObject({ units: 4, revenue: 400 });
    expect(totals).toMatchObject({ units: 7, orders: 3, revenue: 700, profit: 220 });
    expect(totals.margin).toBeCloseTo(220 / 700);
  });

  it('rolls products up into categories with shares that add up', () => {
    const { categories } = summarizePerformance(
      [line({ subtotal: 300, profit: 100 }), line({ product_name: 'Chair', subtotal: 100, profit: 20 }), line({ product_name: 'Lamp', subtotal: 100, profit: 50 })],
      catalog,
      ALL
    );
    const furniture = categories.find(c => c.name === 'Furniture')!;
    expect(furniture).toMatchObject({ revenue: 400, profit: 120, products: 2 });
    expect(furniture.share).toBeCloseTo(0.8);
    expect(categories.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
    expect(categories[0].name).toBe('Furniture');
  });

  it('groups categories that differ only by letter case', () => {
    const cased: CatalogItem[] = [
      { product_name: 'Desk A', category: 'Office Desk', current_stock: 1 },
      { product_name: 'Desk B', category: 'office desk', current_stock: 1 },
    ];
    const { categories } = summarizePerformance(
      [line({ product_name: 'Desk A', subtotal: 100, profit: 10 }), line({ product_name: 'Desk B', subtotal: 300, profit: 30 })],
      cased,
      ALL
    );
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: 'office desk', revenue: 400, products: 2 });
  });

  it('only counts sales inside the period', () => {
    const { totals, products } = summarizePerformance(
      [line({ date: '2026-09-30', subtotal: 999 }), line({ date: '2026-10-01', subtotal: 100, profit: 10 }), line({ date: '2026-10-31T20:00:00Z', subtotal: 100, profit: 10 }), line({ date: '2026-11-01', subtotal: 999 })],
      catalog,
      { start: '2026-10-01', end: '2026-10-31' }
    );
    expect(totals.revenue).toBe(200);
    expect(products.find(p => p.name === 'Desk')!.orders).toBe(2);
  });

  it('keeps unsold catalog items, at the bottom, with no margin', () => {
    const { products } = summarizePerformance([line({ subtotal: 100, profit: 10 })], catalog, ALL);
    expect(products[0].name).toBe('Desk');
    const lamp = products.find(p => p.name === 'Lamp')!;
    expect(lamp).toMatchObject({ units: 0, revenue: 0, margin: null, share: 0 });
  });

  it('lists a sold product that is not in the catalog as uncategorised', () => {
    const { products, categories } = summarizePerformance([line({ product_name: 'Mystery', subtotal: 50, profit: 5 })], catalog, ALL);
    expect(products.find(p => p.name === 'Mystery')).toMatchObject({ category: UNCATEGORISED, stock: null });
    expect(categories.some(c => c.name === UNCATEGORISED)).toBe(true);
  });

  it('services have no stock figure', () => {
    const { products } = summarizePerformance([], catalog, ALL);
    expect(products.find(p => p.name === 'Haircut')!.stock).toBeNull();
  });

  it('handles an empty business', () => {
    const out = summarizePerformance([], [], ALL);
    expect(out.products).toEqual([]);
    expect(out.totals).toEqual({ units: 0, orders: 0, revenue: 0, profit: 0, margin: null });
  });

  it('ignores lines with no product name', () => {
    expect(summarizePerformance([line({ product_name: '  ' }), line({ product_name: null })], [], ALL).totals.orders).toBe(0);
  });
});
