import { useEffect, useRef, useState } from 'react';
import { useMetricsContext } from '../metrics/MetricsProvider';
import { useOpportunities } from '../opportunities/useOpportunities';
import { listGoals } from '../goals/goalService';
import { calculateGoalProgress } from '../goals/goalProgress';
import { toISODate } from '../../utils/dateRange';
import { getPreferences } from './notificationPreferencesService';
import { syncOpportunityNotifications, syncGoalNotifications } from './notificationSync';
import type { AtRiskGoalInput } from './notificationSync';

/**
 * Runs once per mount: reuses the same opportunity detection and goal
 * progress math the Opportunity Center and Business Goals pages already
 * compute, and publishes anything that crosses the "worth a notification"
 * bar into the shared notifications table. Mounted once near the top of
 * the dashboard so it runs regardless of which tab is open, matching the
 * "generated opportunistically while the app is open" model the
 * notification engine was built around.
 */
export function useNotificationSync(): void {
  const ctx = useMetricsContext();
  const { opportunities, loading: opportunitiesLoading } = useOpportunities();
  const [atRiskGoals, setAtRiskGoals] = useState<AtRiskGoalInput[] | null>(null);
  const hasSynced = useRef(false);

  useEffect(() => {
    const today = toISODate(new Date());
    listGoals()
      .then(async goals => {
        const active = goals.filter(g => g.status === 'active' && g.metricType !== 'custom');
        const results = await Promise.all(
          active.map(async g => {
            const range = { start: g.periodStart, end: g.periodEnd < today ? g.periodEnd : today };
            const metrics = await ctx.loadMetrics(range).catch(() => null);
            const progress = calculateGoalProgress(g, metrics);
            return progress.isAtRisk ? { id: g.id, name: g.name } : null;
          })
        );
        setAtRiskGoals(results.filter((g): g is AtRiskGoalInput => g !== null));
      })
      .catch(() => setAtRiskGoals([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasSynced.current || opportunitiesLoading || atRiskGoals === null) return;
    hasSynced.current = true;

    getPreferences()
      .then(prefs =>
        Promise.all([syncOpportunityNotifications(opportunities, prefs), syncGoalNotifications(atRiskGoals, prefs)])
      )
      .catch(() => {});
  }, [opportunitiesLoading, opportunities, atRiskGoals]);
}
