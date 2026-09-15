import type { BusinessMetrics } from '../metrics/metricsService';

// Pure progress/risk math for Business Goals — kept separate from data
// fetching so the "is this goal on pace" logic (the part someone could
// actually get wrong) is unit-testable on its own.

export type GoalMetricType = 'revenue' | 'profit' | 'sales_count' | 'expense_cap' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'missed' | 'archived';

export interface GoalRecord {
  id: string;
  name: string;
  metricType: GoalMetricType;
  targetValue: number;
  manualCurrentValue: number | null;
  periodStart: string;
  periodEnd: string;
  status: GoalStatus;
  notes: string | null;
}

export interface GoalProgress {
  currentValue: number;
  targetValue: number;
  progressPct: number; // 0-100+, uncapped so "exceeded" is visible
  isOnTrack: boolean;
  isAtRisk: boolean;
  isAchieved: boolean;
  isExpired: boolean;
  daysRemaining: number;
  paceExplanation: string;
}

/** For expense_cap goals, lower spend is "more progress" toward staying under budget. */
function currentValueFor(goal: GoalRecord, metrics: BusinessMetrics | null): number {
  if (goal.metricType === 'custom') return goal.manualCurrentValue ?? 0;
  if (!metrics) return 0;
  switch (goal.metricType) {
    case 'revenue': return metrics.salesRevenue + metrics.supplierRevenue;
    case 'profit': return metrics.netProfit;
    case 'sales_count': return metrics.transactionCount;
    case 'expense_cap': return metrics.totalExpenses;
    default: return 0;
  }
}

const AT_RISK_PACE_RATIO = 0.8; // more than 20% behind expected pace

export function calculateGoalProgress(goal: GoalRecord, metrics: BusinessMetrics | null, today: Date = new Date()): GoalProgress {
  const currentValue = currentValueFor(goal, metrics);
  const start = new Date(goal.periodStart + 'T00:00:00');
  const end = new Date(goal.periodEnd + 'T00:00:00');
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000) + 1));
  const daysRemaining = Math.max(0, totalDays - elapsedDays);
  const isExpired = today.getTime() > end.getTime();

  const isExpenseCap = goal.metricType === 'expense_cap';
  const progressPct = goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0;

  const isAchieved = isExpenseCap ? (isExpired && currentValue <= goal.targetValue) : currentValue >= goal.targetValue;
  const wentOverCap = isExpenseCap && currentValue > goal.targetValue;

  const expectedPct = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
  const paceRatio = expectedPct > 0 ? progressPct / expectedPct : progressPct > 0 ? Infinity : 0;

  let isOnTrack: boolean;
  let isAtRisk: boolean;

  if (isExpenseCap) {
    // Ahead of pace on spending is the risk here — spending faster than
    // the period has elapsed means you're on track to blow the cap.
    isAtRisk = !isExpired && !wentOverCap && paceRatio > 1 / AT_RISK_PACE_RATIO;
    isOnTrack = !wentOverCap && !isAtRisk;
  } else {
    isAtRisk = !isExpired && !isAchieved && paceRatio < AT_RISK_PACE_RATIO && elapsedDays > 0;
    isOnTrack = isAchieved || (!isAtRisk && !isExpired);
  }

  let paceExplanation: string;
  if (isAchieved) {
    paceExplanation = isExpenseCap ? 'Stayed within budget for the period.' : 'Goal reached.';
  } else if (isExpired) {
    paceExplanation = isExpenseCap ? 'Period ended over budget.' : 'Period ended short of the target.';
  } else if (wentOverCap) {
    paceExplanation = 'Already over budget for this period.';
  } else if (isAtRisk) {
    paceExplanation = isExpenseCap
      ? `Spending faster than expected — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in the period.`
      : `Behind pace — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to close the gap.`;
  } else {
    paceExplanation = `On track, ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`;
  }

  return {
    currentValue,
    targetValue: goal.targetValue,
    progressPct: Number.isFinite(progressPct) ? progressPct : 0,
    isOnTrack,
    isAtRisk,
    isAchieved,
    isExpired,
    daysRemaining,
    paceExplanation,
  };
}
