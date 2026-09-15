import { describe, it, expect } from 'vitest';
import { calculateGoalProgress } from './goalProgress';
import type { GoalRecord } from './goalProgress';
import type { BusinessMetrics } from '../metrics/metricsService';

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

function goal(overrides: Partial<GoalRecord> = {}): GoalRecord {
  return {
    id: 'g1', name: 'Test Goal', metricType: 'revenue', targetValue: 100000,
    manualCurrentValue: null, periodStart: '2026-08-01', periodEnd: '2026-08-31',
    status: 'active', notes: null,
    ...overrides,
  };
}

describe('calculateGoalProgress — revenue goal', () => {
  it('reports on-track progress when pace matches elapsed time', () => {
    // Day 15 of 31 (~48% through), revenue at 50% of target -> on pace
    const today = new Date('2026-08-15T12:00:00');
    const result = calculateGoalProgress(goal(), metrics({ salesRevenue: 50000 }), today);
    expect(result.isOnTrack).toBe(true);
    expect(result.isAtRisk).toBe(false);
    expect(result.progressPct).toBeCloseTo(50, 0);
  });

  it('flags at-risk when significantly behind pace', () => {
    // Day 20 of 31 (~65% elapsed), only 10% of revenue target reached
    const today = new Date('2026-08-20T12:00:00');
    const result = calculateGoalProgress(goal(), metrics({ salesRevenue: 10000 }), today);
    expect(result.isAtRisk).toBe(true);
    expect(result.isOnTrack).toBe(false);
  });

  it('marks a goal achieved once the target is met, even mid-period', () => {
    const today = new Date('2026-08-10T12:00:00');
    const result = calculateGoalProgress(goal(), metrics({ salesRevenue: 120000 }), today);
    expect(result.isAchieved).toBe(true);
    expect(result.progressPct).toBeGreaterThan(100);
  });

  it('marks a goal expired-and-missed when the period ends short', () => {
    const today = new Date('2026-09-05T12:00:00'); // after Aug 31
    const result = calculateGoalProgress(goal(), metrics({ salesRevenue: 40000 }), today);
    expect(result.isExpired).toBe(true);
    expect(result.isAchieved).toBe(false);
  });

  it('combines sales and supplier revenue for a revenue goal, matching the metrics engine convention', () => {
    const today = new Date('2026-08-15T12:00:00');
    const result = calculateGoalProgress(goal(), metrics({ salesRevenue: 30000, supplierRevenue: 20000 }), today);
    expect(result.currentValue).toBe(50000);
  });
});

describe('calculateGoalProgress — expense_cap goal (inverted logic)', () => {
  const capGoal = goal({ metricType: 'expense_cap', targetValue: 50000 });

  it('is on track when spending is below the cap and pace is reasonable', () => {
    const today = new Date('2026-08-15T12:00:00');
    const result = calculateGoalProgress(capGoal, metrics({ totalExpenses: 20000 }), today);
    expect(result.isOnTrack).toBe(true);
  });

  it('flags at-risk when spending is running ahead of the elapsed period', () => {
    // Day 5 of 31 (~16% elapsed) but already 60% of the cap spent
    const today = new Date('2026-08-05T12:00:00');
    const result = calculateGoalProgress(capGoal, metrics({ totalExpenses: 30000 }), today);
    expect(result.isAtRisk).toBe(true);
  });

  it('is never "achieved" while mid-period, even if under budget so far', () => {
    const today = new Date('2026-08-15T12:00:00');
    const result = calculateGoalProgress(capGoal, metrics({ totalExpenses: 10000 }), today);
    expect(result.isAchieved).toBe(false); // can't know you stayed under budget until the period ends
  });

  it('is achieved once the period ends under budget', () => {
    const today = new Date('2026-09-01T12:00:00');
    const result = calculateGoalProgress(capGoal, metrics({ totalExpenses: 40000 }), today);
    expect(result.isAchieved).toBe(true);
  });

  it('is never "on track" once spending exceeds the cap', () => {
    const today = new Date('2026-08-15T12:00:00');
    const result = calculateGoalProgress(capGoal, metrics({ totalExpenses: 60000 }), today);
    expect(result.isOnTrack).toBe(false);
  });
});

describe('calculateGoalProgress — custom goal', () => {
  it('uses the manually entered value, ignoring metrics entirely', () => {
    const customGoal = goal({ metricType: 'custom', targetValue: 5, manualCurrentValue: 3 });
    const result = calculateGoalProgress(customGoal, null, new Date('2026-08-15T12:00:00'));
    expect(result.currentValue).toBe(3);
    expect(result.progressPct).toBe(60);
  });

  it('treats a missing manual value as zero, not a crash', () => {
    const customGoal = goal({ metricType: 'custom', targetValue: 5, manualCurrentValue: null });
    const result = calculateGoalProgress(customGoal, null, new Date('2026-08-15T12:00:00'));
    expect(result.currentValue).toBe(0);
    expect(Number.isFinite(result.progressPct)).toBe(true);
  });
});

describe('calculateGoalProgress — edge cases', () => {
  it('never produces NaN or Infinity for a same-day goal', () => {
    const oneDayGoal = goal({ periodStart: '2026-08-15', periodEnd: '2026-08-15' });
    const result = calculateGoalProgress(oneDayGoal, metrics({ salesRevenue: 1000 }), new Date('2026-08-15T12:00:00'));
    expect(Number.isFinite(result.progressPct)).toBe(true);
    expect(Number.isFinite(result.daysRemaining)).toBe(true);
  });

  it('handles null metrics gracefully for a non-custom goal', () => {
    const result = calculateGoalProgress(goal(), null, new Date('2026-08-15T12:00:00'));
    expect(result.currentValue).toBe(0);
    expect(Number.isFinite(result.progressPct)).toBe(true);
  });
});
