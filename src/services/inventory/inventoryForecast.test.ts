import { describe, it, expect } from 'vitest';
import { forecastStock } from './inventoryForecast';

const oldDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

describe('forecastStock', () => {
  it('treats a new product with no sales as "new", not "dead"', () => {
    const result = forecastStock({
      productName: 'New Widget',
      currentStock: 50,
      reorderLevel: 5,
      createdAt: oldDate(3),
      unitsSoldInWindow: 0,
    });
    expect(result.movement).toBe('new');
    expect(result.stockoutRisk).toBe('unknown');
    expect(result.daysOfStockRemaining).toBeNull();
    expect(result.recommendedReorderQty).toBeNull();
  });

  it('treats an old product with zero recent sales as dead stock', () => {
    const result = forecastStock({
      productName: 'Stale Widget',
      currentStock: 50,
      reorderLevel: 5,
      createdAt: oldDate(200),
      unitsSoldInWindow: 0,
    });
    expect(result.movement).toBe('dead');
    expect(result.stockoutRisk).toBe('unknown');
  });

  it('flags high stockout risk when days remaining is low', () => {
    // 30 units sold in 30 days = 1/day; 5 in stock = 5 days remaining
    const result = forecastStock({
      productName: 'Hot Item',
      currentStock: 5,
      reorderLevel: 10,
      createdAt: oldDate(200),
      unitsSoldInWindow: 30,
    });
    expect(result.movement).toBe('fast');
    expect(result.daysOfStockRemaining).toBeCloseTo(5, 0);
    expect(result.stockoutRisk).toBe('high');
    expect(result.recommendedReorderQty).toBeGreaterThan(0);
  });

  it('classifies low-velocity items as slow-moving, not dead', () => {
    // 3 units in 30 days = 0.1/day, below the 0.3 fast threshold
    const result = forecastStock({
      productName: 'Occasional Seller',
      currentStock: 20,
      reorderLevel: 5,
      createdAt: oldDate(200),
      unitsSoldInWindow: 3,
    });
    expect(result.movement).toBe('slow');
    expect(result.stockoutRisk).not.toBe('unknown');
  });

  it('does not recommend reordering when stock comfortably covers the buffer period', () => {
    // 30/month velocity, 200 in stock = 200 days remaining, way over the 45-day buffer
    const result = forecastStock({
      productName: 'Well Stocked',
      currentStock: 200,
      reorderLevel: 10,
      createdAt: oldDate(200),
      unitsSoldInWindow: 30,
    });
    expect(result.recommendedReorderQty).toBeNull();
    expect(result.stockoutRisk).toBe('low');
  });

  it('never produces NaN or Infinity for any classification', () => {
    const cases = [
      { productName: 'A', currentStock: 0, reorderLevel: 0, createdAt: null, unitsSoldInWindow: 0 },
      { productName: 'B', currentStock: 0, reorderLevel: 0, createdAt: oldDate(500), unitsSoldInWindow: 0 },
      { productName: 'C', currentStock: -5, reorderLevel: 0, createdAt: oldDate(500), unitsSoldInWindow: 10 },
    ];
    for (const c of cases) {
      const result = forecastStock(c);
      if (result.unitsPerDay !== null) expect(Number.isFinite(result.unitsPerDay)).toBe(true);
      if (result.daysOfStockRemaining !== null) expect(Number.isFinite(result.daysOfStockRemaining)).toBe(true);
      if (result.recommendedReorderQty !== null) expect(Number.isFinite(result.recommendedReorderQty)).toBe(true);
    }
  });

  it('handles a missing/null createdAt gracefully rather than crashing', () => {
    const result = forecastStock({
      productName: 'Unknown Age',
      currentStock: 10,
      reorderLevel: 5,
      createdAt: null,
      unitsSoldInWindow: 5,
    });
    expect(result.movement).not.toBe('new'); // no age info -> can't claim "new"
    expect(Number.isFinite(result.daysOfStockRemaining ?? 0)).toBe(true);
  });
});
