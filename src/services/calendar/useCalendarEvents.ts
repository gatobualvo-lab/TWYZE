import { useEffect, useMemo, useState } from 'react';
import { useMetricsContext } from '../metrics/MetricsProvider';
import { toISODate } from '../../utils/dateRange';
import type { DateRange } from '../../utils/dateRange';
import { listGoals } from '../goals/goalService';
import type { GoalRecord } from '../goals/goalProgress';
import { listTasks } from '../tasks/taskService';
import type { BusinessTask } from '../tasks/taskService';
import { fetchDueDocuments } from './calendarService';
import type { DueDocument } from './calendarService';
import { fetchInventoryWithMeta } from '../../components/inventory/SmartInventoryPredictions';
import { forecastStock, INVENTORY_FORECAST_CONSTANTS } from '../inventory/inventoryForecast';
import { buildCalendarEvents } from './calendarEvents';
import type { CalendarEvent, StockoutForecastInput } from './calendarEvents';

function monthRange(year: number, month: number): DateRange {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

/**
 * Combines the shared metrics engine (daily revenue/expense series), goal
 * deadlines, task due dates, document due dates, and inventory stockout
 * projections into one day-keyed event map for the given displayed month.
 * Nothing is fetched or computed twice: it reuses the exact same cached
 * daily series and profit-by-product data the other BI features already
 * pull through MetricsProvider, and the same forecastStock() math Smart
 * Inventory Predictions and the Opportunity Center use.
 */
export function useCalendarEvents(year: number, month: number): { events: Map<string, CalendarEvent[]>; loading: boolean } {
  const ctx = useMetricsContext();
  const range = useMemo(() => monthRange(year, month), [year, month]);
  const velocityRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - INVENTORY_FORECAST_CONSTANTS.VELOCITY_WINDOW_DAYS);
    return { start: toISODate(start), end: toISODate(end) };
  }, []);

  const [goals, setGoals] = useState<GoalRecord[] | null>(null);
  const [tasks, setTasks] = useState<BusinessTask[] | null>(null);
  const [dueDocuments, setDueDocuments] = useState<DueDocument[] | null>(null);
  const [stockoutForecasts, setStockoutForecasts] = useState<StockoutForecastInput[] | null>(null);

  useEffect(() => {
    ctx.loadDailySeries(range).catch(() => {});
    listGoals().then(setGoals).catch(() => setGoals([]));
    listTasks().then(setTasks).catch(() => setTasks([]));
    fetchDueDocuments(range).then(setDueDocuments).catch(() => setDueDocuments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  useEffect(() => {
    Promise.all([fetchInventoryWithMeta(), ctx.loadProfitByProduct(velocityRange, 500)])
      .then(([items, products]) => {
        const salesByName = new Map(products.map(p => [p.productName.trim().toLowerCase(), p.unitsSold]));
        const today = new Date();
        const forecasts: StockoutForecastInput[] = [];
        for (const item of items) {
          if (!item.product_name) continue;
          const forecast = forecastStock({
            productName: item.product_name,
            currentStock: item.current_stock ?? 0,
            reorderLevel: item.reorder_level ?? 0,
            createdAt: item.created_at,
            unitsSoldInWindow: salesByName.get(item.product_name.trim().toLowerCase()) ?? 0,
          });
          if ((forecast.stockoutRisk === 'high' || forecast.stockoutRisk === 'medium') && forecast.daysOfStockRemaining !== null) {
            const stockoutDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.round(forecast.daysOfStockRemaining));
            forecasts.push({ productName: forecast.productName, stockoutDate: toISODate(stockoutDate), risk: forecast.stockoutRisk });
          }
        }
        setStockoutForecasts(forecasts);
      })
      .catch(() => setStockoutForecasts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailySeriesEntry = ctx.getDailySeries(range);
  const loading = !dailySeriesEntry.data || !goals || !tasks || !dueDocuments || !stockoutForecasts;

  const events = useMemo(() => {
    if (loading) return new Map<string, CalendarEvent[]>();
    return buildCalendarEvents({
      dailySeries: dailySeriesEntry.data!,
      goals: goals!.map(g => ({ id: g.id, name: g.name, periodEnd: g.periodEnd, status: g.status })),
      tasks: tasks!.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, completed: t.completed })),
      dueDocuments: dueDocuments!,
      stockoutForecasts: stockoutForecasts!,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return { events, loading };
}
