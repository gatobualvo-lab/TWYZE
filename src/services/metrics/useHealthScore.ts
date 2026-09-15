import { useEffect, useMemo } from 'react';
import { useMetricsContext } from './MetricsProvider';
import { calculateHealthScore } from './healthScore';
import type { HealthScoreResult } from './healthScore';
import { getPeriodRange } from '../../utils/dateRange';

function previousEqualPeriod(range: { start: string; end: string }) {
  const start = new Date(range.start + 'T00:00:00');
  const end = new Date(range.end + 'T00:00:00');
  const lengthMs = end.getTime() - start.getTime();

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

/**
 * Shared by BusinessHealthScore (the widget) and the AI Business Advisor
 * (which narrates the same score) so both read from one computation
 * instead of two independent metrics fetches + scoring passes.
 */
export function useHealthScore(): { result: HealthScoreResult | null; loading: boolean } {
  const ctx = useMetricsContext();
  const range = useMemo(() => getPeriodRange('month'), []);
  const prevRange = useMemo(() => previousEqualPeriod(range), [range]);

  useEffect(() => {
    ctx.loadMetrics(range).catch(() => {});
    ctx.loadMetrics(prevRange).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const currentEntry = ctx.getMetrics(range);
  const prevEntry = ctx.getMetrics(prevRange);

  const result = currentEntry.data ? calculateHealthScore(currentEntry.data, prevEntry.data) : null;
  return { result, loading: currentEntry.loading && !currentEntry.data };
}

export { previousEqualPeriod };
