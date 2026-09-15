import { describe, it, expect } from 'vitest';
import {
  detectOverdueBalances,
  detectDormantCustomers,
  detectLowMarginProducts,
  detectInventoryRisks,
  detectForgottenQuotations,
  detectExpenseSpike,
  sortOpportunities,
} from './opportunityEngine';
import type { CustomerProfit, ProductProfit, BusinessMetrics } from '../metrics/metricsService';
import type { StockForecast } from '../inventory/inventoryForecast';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

function metrics(overrides: Partial<BusinessMetrics> = {}): BusinessMetrics {
  return {
    salesRevenue: 0, salesProfit: 0, salesCount: 0,
    supplierRevenue: 0, supplierProfit: 0, supplierCount: 0,
    adExpenses: 0, vendorExpenses: 0, generalExpenses: 0, totalExpenses: 0,
    grossProfit: 0, netProfit: 0,
    outstandingReceivables: 0, outstandingPayables: 0, cashReceived: 0,
    transactionCount: 0, netMarginPct: null,
    ...overrides,
  };
}

describe('detectOverdueBalances', () => {
  it('sums unpaid sales per customer as the real, non-fabricated impact amount', () => {
    const result = detectOverdueBalances([
      { clientName: 'Jane', sellingPrice: 5000, date: daysAgo(10) },
      { clientName: 'Jane', sellingPrice: 3000, date: daysAgo(40) },
      { clientName: 'Bob', sellingPrice: 1000, date: daysAgo(5) },
    ]);
    const jane = result.find(o => o.title.includes('Jane'));
    expect(jane?.estimatedImpact?.amount).toBe(8000);
    expect(jane?.priority).toBe('high'); // >30 days old
  });

  it('skips sales with no customer name — nothing to act on', () => {
    const result = detectOverdueBalances([{ clientName: null, sellingPrice: 5000, date: daysAgo(5) }]);
    expect(result).toHaveLength(0);
  });
});

describe('detectDormantCustomers', () => {
  const base: CustomerProfit = {
    customerName: 'Alice', customerId: null, revenue: 30000, profit: 5000, transactionCount: 3, lastOrderDate: daysAgo(90),
  };

  it('flags a repeat customer with no recent orders, with a real average-order-value impact', () => {
    const result = detectDormantCustomers([base]);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedImpact?.amount).toBeCloseTo(10000, 0); // 30000/3
  });

  it('does not flag a one-time buyer as a lapsed "regular"', () => {
    const result = detectDormantCustomers([{ ...base, transactionCount: 1 }]);
    expect(result).toHaveLength(0);
  });

  it('does not flag a customer who ordered recently', () => {
    const result = detectDormantCustomers([{ ...base, lastOrderDate: daysAgo(5) }]);
    expect(result).toHaveLength(0);
  });
});

describe('detectLowMarginProducts', () => {
  it('only flags products below both the fixed threshold AND the business\'s own average', () => {
    const products: ProductProfit[] = [
      { productName: 'High margin', unitsSold: 5, revenue: 10000, cost: 4000, profit: 6000, marginPct: 60, transactionCount: 5 },
      { productName: 'Low margin', unitsSold: 10, revenue: 20000, cost: 19000, profit: 1000, marginPct: 5, transactionCount: 10 },
    ];
    const result = detectLowMarginProducts(products);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain('Low margin');
    expect(result[0].estimatedImpact?.amount).toBeGreaterThan(0);
  });

  it('produces no opportunities when there is no sales data at all', () => {
    expect(detectLowMarginProducts([])).toHaveLength(0);
  });

  it('never produces a negative or NaN impact amount', () => {
    const products: ProductProfit[] = [
      { productName: 'A', unitsSold: 1, revenue: 100, cost: 90, profit: 10, marginPct: 10, transactionCount: 1 },
      { productName: 'B', unitsSold: 1, revenue: 100, cost: 200, profit: -100, marginPct: -100, transactionCount: 1 },
    ];
    const result = detectLowMarginProducts(products);
    for (const o of result) {
      if (o.estimatedImpact) {
        expect(Number.isFinite(o.estimatedImpact.amount)).toBe(true);
        expect(o.estimatedImpact.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('detectInventoryRisks', () => {
  it('flags high stockout risk without fabricating a lost-revenue estimate', () => {
    const forecasts: StockForecast[] = [{
      productName: 'Hot Item', currentStock: 3, movement: 'fast', unitsPerDay: 1, daysOfStockRemaining: 3,
      stockoutRisk: 'high', recommendedReorderQty: 20, explanation: 'test',
    }];
    const result = detectInventoryRisks(forecasts);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedImpact).toBeNull(); // deliberately not estimated
    expect(result[0].priority).toBe('high');
  });

  it('flags dead stock as low priority with no impact estimate', () => {
    const forecasts: StockForecast[] = [{
      productName: 'Stale Item', currentStock: 40, movement: 'dead', unitsPerDay: 0, daysOfStockRemaining: null,
      stockoutRisk: 'unknown', recommendedReorderQty: null, explanation: 'test',
    }];
    const result = detectInventoryRisks(forecasts);
    expect(result[0].priority).toBe('low');
    expect(result[0].estimatedImpact).toBeNull();
  });

  it('ignores healthy stock levels', () => {
    const forecasts: StockForecast[] = [{
      productName: 'Fine Item', currentStock: 100, movement: 'slow', unitsPerDay: 0.2, daysOfStockRemaining: 500,
      stockoutRisk: 'low', recommendedReorderQty: null, explanation: 'test',
    }];
    expect(detectInventoryRisks(forecasts)).toHaveLength(0);
  });
});

describe('detectForgottenQuotations', () => {
  it('flags an old, unconverted quotation with its real total as impact', () => {
    const result = detectForgottenQuotations([
      { documentNumber: 'QT-001', customerName: 'Sam', total: 15000, date: daysAgo(20), status: 'draft' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedImpact?.amount).toBe(15000);
  });

  it('does not flag a recently sent quotation', () => {
    const result = detectForgottenQuotations([
      { documentNumber: 'QT-002', customerName: 'Sam', total: 15000, date: daysAgo(2), status: 'draft' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('does not flag a quotation that was already converted or rejected', () => {
    const result = detectForgottenQuotations([
      { documentNumber: 'QT-003', customerName: 'Sam', total: 15000, date: daysAgo(30), status: 'converted' },
      { documentNumber: 'QT-004', customerName: 'Sam', total: 15000, date: daysAgo(30), status: 'rejected' },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('detectExpenseSpike', () => {
  it('flags a real, large increase in expenses', () => {
    const current = metrics({ totalExpenses: 20000 });
    const previous = metrics({ totalExpenses: 10000 });
    const result = detectExpenseSpike(current, previous);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedImpact?.amount).toBe(10000);
  });

  it('ignores small fluctuations', () => {
    const current = metrics({ totalExpenses: 10500 });
    const previous = metrics({ totalExpenses: 10000 });
    expect(detectExpenseSpike(current, previous)).toHaveLength(0);
  });

  it('does nothing without a previous-period baseline', () => {
    expect(detectExpenseSpike(metrics({ totalExpenses: 20000 }), null)).toHaveLength(0);
  });
});

describe('sortOpportunities', () => {
  it('orders by priority first, then by impact amount', () => {
    const opportunities = [
      { id: '1', category: 'expenses' as const, priority: 'low' as const, title: '', detected: '', whyItMatters: '', estimatedImpact: { amount: 100000, label: '' }, evidence: [], recommendedAction: '', actionTab: '' },
      { id: '2', category: 'expenses' as const, priority: 'high' as const, title: '', detected: '', whyItMatters: '', estimatedImpact: { amount: 100, label: '' }, evidence: [], recommendedAction: '', actionTab: '' },
      { id: '3', category: 'expenses' as const, priority: 'high' as const, title: '', detected: '', whyItMatters: '', estimatedImpact: { amount: 5000, label: '' }, evidence: [], recommendedAction: '', actionTab: '' },
    ];
    const sorted = sortOpportunities(opportunities);
    expect(sorted.map(o => o.id)).toEqual(['3', '2', '1']);
  });
});
