import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from './healthScore';
import type { BusinessMetrics } from './metricsService';

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

describe('calculateHealthScore', () => {
  it('returns null score with no data at all, never a fabricated number', () => {
    const result = calculateHealthScore(metrics(), null);
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.insufficientDataReason).toBeTruthy();
    expect(result.factors).toHaveLength(0);
  });

  it('scores a healthy, profitable, well-collected business highly', () => {
    const current = metrics({
      salesRevenue: 100000, netProfit: 25000, totalExpenses: 10000,
      outstandingReceivables: 0, outstandingPayables: 0,
    });
    const previous = metrics({ salesRevenue: 90000 });
    const result = calculateHealthScore(current, previous);

    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe('excellent');
  });

  it('scores a lossmaking business with heavy outstanding balances poorly', () => {
    const current = metrics({
      salesRevenue: 50000, netProfit: -10000, totalExpenses: 60000,
      outstandingReceivables: 40000, outstandingPayables: 30000,
    });
    const result = calculateHealthScore(current, null);

    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThan(40);
  });

  it('excludes revenue trend rather than treating a new business as -100% decline', () => {
    const current = metrics({ salesRevenue: 20000, netProfit: 5000 });
    // previous period genuinely had zero revenue (business just started)
    const result = calculateHealthScore(current, metrics());

    const trendFactor = result.factors.find(f => f.key === 'revenueTrend');
    expect(trendFactor).toBeUndefined();
    expect(result.factorsIncluded).toBeLessThan(result.factorsPossible);
    // the other 4 factors should still produce a real score
    expect(result.score).not.toBeNull();
  });

  it('never produces NaN or Infinity even with a zero-revenue-but-active period', () => {
    const current = metrics({ totalExpenses: 5000 }); // expenses with no revenue at all
    const result = calculateHealthScore(current, null);

    if (result.score !== null) {
      expect(Number.isFinite(result.score)).toBe(true);
    }
    for (const f of result.factors) {
      expect(Number.isFinite(f.score)).toBe(true);
    }
  });

  it('clamps factor scores to the 0-100 range for extreme inputs', () => {
    const current = metrics({
      salesRevenue: 1000, netProfit: 100000, // absurd margin
      outstandingReceivables: 1000000, // absurd receivables
    });
    const result = calculateHealthScore(current, null);
    for (const f of result.factors) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
    }
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('does not present a misleading 0/critical score off a single factor', () => {
    // Real scenario: this period has zero sales (so profitability,
    // collections, expense discipline, and payables can't be computed —
    // they're all revenue-relative), but the previous period had real
    // revenue, so revenue trend alone computes to a harsh -100%. Before the
    // fix this produced a confident "0/100 Critical" off one data point.
    const current = metrics({ totalExpenses: 8500 });
    const previous = metrics({ salesRevenue: 198200 });
    const result = calculateHealthScore(current, previous);

    expect(result.factorsIncluded).toBe(1);
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.insufficientDataReason).toContain('1 of 5');
    // The one real data point should still be surfaced, just not as a verdict.
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].key).toBe('revenueTrend');
  });

  it('factor weights always sum to 1 after renormalization', () => {
    const current = metrics({ salesRevenue: 10000, netProfit: 1000 });
    const result = calculateHealthScore(current, null); // no previous period -> 4 factors
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});
