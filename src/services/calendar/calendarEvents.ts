import type { DailyMetric } from '../metrics/metricsService';
import type { DueDocument } from './calendarService';
import { formatCurrency } from '../../utils/format';

// The calendar never stores its own events — everything here is derived,
// on read, from records that already exist elsewhere (sales/expenses via
// the daily metrics series, goal deadlines, task due dates, document due
// dates, and inventory stockout projections). This keeps the calendar from
// drifting out of sync with the records it's summarizing.

export type CalendarEventType = 'revenue' | 'expense' | 'goal-deadline' | 'task' | 'stockout' | 'document-due';
export type CalendarEventSeverity = 'info' | 'warning' | 'critical';

export interface CalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  actionTab: string;
  severity: CalendarEventSeverity;
}

export interface GoalDeadlineInput {
  id: string;
  name: string;
  periodEnd: string;
  status: string;
}

export interface TaskInput {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
}

export interface StockoutForecastInput {
  productName: string;
  stockoutDate: string;
  risk: 'high' | 'medium';
}

export interface CalendarEventInputs {
  dailySeries?: DailyMetric[];
  goals?: GoalDeadlineInput[];
  tasks?: TaskInput[];
  dueDocuments?: DueDocument[];
  stockoutForecasts?: StockoutForecastInput[];
}

export function buildCalendarEvents(inputs: CalendarEventInputs): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  const push = (event: CalendarEvent) => {
    const existing = byDay.get(event.date);
    if (existing) existing.push(event);
    else byDay.set(event.date, [event]);
  };

  for (const day of inputs.dailySeries ?? []) {
    if (day.revenue > 0) {
      push({
        id: `revenue:${day.day}`,
        date: day.day,
        type: 'revenue',
        title: `${formatCurrency(day.revenue)} in sales`,
        subtitle: `${day.transactionCount} transaction${day.transactionCount === 1 ? '' : 's'}`,
        actionTab: 'view-sales',
        severity: 'info',
      });
    }
    if (day.expenses > 0) {
      push({
        id: `expense:${day.day}`,
        date: day.day,
        type: 'expense',
        title: `${formatCurrency(day.expenses)} in expenses`,
        subtitle: null,
        actionTab: 'expense-overview',
        severity: 'info',
      });
    }
  }

  for (const goal of inputs.goals ?? []) {
    if (goal.status !== 'active') continue;
    push({
      id: `goal:${goal.id}`,
      date: goal.periodEnd,
      type: 'goal-deadline',
      title: `Goal deadline: ${goal.name}`,
      subtitle: null,
      actionTab: 'goals',
      severity: 'warning',
    });
  }

  for (const task of inputs.tasks ?? []) {
    if (task.completed || !task.dueDate) continue;
    push({
      id: `task:${task.id}`,
      date: task.dueDate,
      type: 'task',
      title: task.title,
      subtitle: null,
      actionTab: 'dashboard',
      severity: 'info',
    });
  }

  for (const doc of inputs.dueDocuments ?? []) {
    push({
      id: `document:${doc.id}`,
      date: doc.dueDate,
      type: 'document-due',
      title: `${doc.documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${doc.documentNumber} due`,
      subtitle: [doc.customerName, formatCurrency(doc.total)].filter(Boolean).join(' · '),
      actionTab: doc.actionTab,
      severity: 'warning',
    });
  }

  for (const forecast of inputs.stockoutForecasts ?? []) {
    push({
      id: `stockout:${forecast.productName}`,
      date: forecast.stockoutDate,
      type: 'stockout',
      title: `${forecast.productName} may run out`,
      subtitle: null,
      actionTab: 'inventory-predictions',
      severity: forecast.risk === 'high' ? 'critical' : 'warning',
    });
  }

  return byDay;
}
