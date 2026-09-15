import type { BusinessMetrics } from './metricsService';

// Business Health Score: a single explainable number summarizing financial
// condition. Every formula here is deliberately simple and linear so it can
// be explained in one sentence per factor — a black-box score a business
// owner can't interrogate isn't trustworthy, per the brief. Not
// industry-adaptive: there's no industry/business-type field anywhere in
// the schema to adapt against, so building that would mean inventing data
// that doesn't exist rather than reading it — noted as a real limitation,
// not silently ignored.

export type HealthFactorKey = 'profitability' | 'revenueTrend' | 'collections' | 'expenseDiscipline' | 'payables';

export interface HealthFactor {
  key: HealthFactorKey;
  label: string;
  score: number; // 0-100
  weight: number; // 0-1, of the factors actually included
  explanation: string;
}

export interface HealthScoreResult {
  /** null when there isn't enough data to responsibly produce a score at all. */
  score: number | null;
  band: 'excellent' | 'good' | 'fair' | 'needs_attention' | 'critical' | null;
  bandLabel: string;
  factors: HealthFactor[];
  /** How many of the 5 possible factors actually had enough data to score. */
  factorsIncluded: number;
  factorsPossible: number;
  insufficientDataReason: string | null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function bandFor(score: number): { band: HealthScoreResult['band']; label: string } {
  if (score >= 80) return { band: 'excellent', label: 'Excellent' };
  if (score >= 60) return { band: 'good', label: 'Good' };
  if (score >= 40) return { band: 'fair', label: 'Fair' };
  if (score >= 20) return { band: 'needs_attention', label: 'Needs Attention' };
  return { band: 'critical', label: 'Critical' };
}

export function calculateHealthScore(current: BusinessMetrics, previous: BusinessMetrics | null): HealthScoreResult {
  const currentRevenue = current.salesRevenue + current.supplierRevenue;
  const previousRevenue = previous ? previous.salesRevenue + previous.supplierRevenue : 0;
  const hasAnyActivity = currentRevenue > 0 || current.totalExpenses > 0;

  if (!hasAnyActivity) {
    return {
      score: null,
      band: null,
      bandLabel: 'Not enough data',
      factors: [],
      factorsIncluded: 0,
      factorsPossible: 5,
      insufficientDataReason: 'No sales or expenses recorded yet for this period — record a few transactions and check back.',
    };
  }

  const factors: HealthFactor[] = [];

  // 1. Profitability — net margin. Centered at 0% margin = 50; each point
  // of margin moves the score 2 points either way.
  if (currentRevenue > 0) {
    const marginPct = (current.netProfit / currentRevenue) * 100;
    const score = clamp(50 + marginPct * 2, 0, 100);
    factors.push({
      key: 'profitability',
      label: 'Profitability',
      score,
      weight: 0.3,
      explanation:
        marginPct >= 0
          ? `Your net margin is ${marginPct.toFixed(1)}% — you're keeping ${marginPct.toFixed(0)} cents of profit per KES 1 in revenue.`
          : `You're operating at a ${Math.abs(marginPct).toFixed(1)}% loss this period — costs exceeded revenue.`,
    });
  }

  // 2. Revenue trend — only meaningful with a real previous-period
  // baseline. A brand-new business with no prior period isn't "declining
  // 100%", it just doesn't have a trend yet — excluded, not penalized.
  if (previousRevenue > 0) {
    const pctChange = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    const score = clamp(50 + clamp(pctChange, -50, 50), 0, 100);
    factors.push({
      key: 'revenueTrend',
      label: 'Revenue Trend',
      score,
      weight: 0.2,
      explanation:
        pctChange >= 0
          ? `Revenue is up ${pctChange.toFixed(0)}% compared to the previous period.`
          : `Revenue is down ${Math.abs(pctChange).toFixed(0)}% compared to the previous period.`,
    });
  }

  // 3. Collections — how much of revenue is still sitting as unpaid
  // balances. This is a running total, not period-scoped, compared against
  // period revenue as a rough scale.
  if (currentRevenue > 0) {
    const ratio = current.outstandingReceivables / currentRevenue;
    const score = clamp(100 - ratio * 200, 0, 100);
    factors.push({
      key: 'collections',
      label: 'Collections',
      score,
      weight: 0.2,
      explanation:
        ratio > 0
          ? `Customers currently owe you ${(ratio * 100).toFixed(0)}% of this period's revenue in unpaid balances.`
          : `No outstanding customer balances right now.`,
    });
  }

  // 4. Expense discipline — expenses as a share of revenue.
  if (currentRevenue > 0) {
    const ratio = current.totalExpenses / currentRevenue;
    const score = clamp(100 - ratio * 100, 0, 100);
    factors.push({
      key: 'expenseDiscipline',
      label: 'Expense Discipline',
      score,
      weight: 0.15,
      explanation: `Expenses are ${(ratio * 100).toFixed(0)}% of revenue this period.`,
    });
  }

  // 5. Payables — money owed to vendors/suppliers, same scale logic as
  // collections but for the other side of the ledger.
  if (currentRevenue > 0) {
    const ratio = current.outstandingPayables / currentRevenue;
    const score = clamp(100 - ratio * 200, 0, 100);
    factors.push({
      key: 'payables',
      label: 'Vendor Payables',
      score,
      weight: 0.15,
      explanation:
        ratio > 0
          ? `You currently owe vendors ${(ratio * 100).toFixed(0)}% of this period's revenue.`
          : `No outstanding vendor balances right now.`,
    });
  }

  if (factors.length === 0) {
    return {
      score: null,
      band: null,
      bandLabel: 'Not enough data',
      factors: [],
      factorsIncluded: 0,
      factorsPossible: 5,
      insufficientDataReason: 'There’s activity this period, but not enough to score reliably yet (e.g. expenses with no revenue). Check back after a few sales.',
    };
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weighted = factors.reduce((sum, f) => sum + f.score * (f.weight / totalWeight), 0);
  const score = Math.round(clamp(weighted, 0, 100));
  const { band, label } = bandFor(score);

  return {
    score,
    band,
    bandLabel: label,
    factors: factors.map(f => ({ ...f, weight: f.weight / totalWeight })),
    factorsIncluded: factors.length,
    factorsPossible: 5,
    insufficientDataReason: null,
  };
}
