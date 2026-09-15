// Canonical period helpers. Replaces the ad-hoc `new Date().toISOString().split('T')[0]`
// / `Date.now() - 7*24*60*60*1000` date math duplicated across DashboardHome,
// SalesList, MonthlyDashboard and ReportsAnalytics — one definition of "this
// week" / "this month" etc. for every BI feature to share.

export type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface DateRange {
  start: string; // ISO 'YYYY-MM-DD'
  end: string;   // ISO 'YYYY-MM-DD'
}

// Deliberately NOT `d.toISOString().split('T')[0]` — that converts to UTC
// first, which rolls the date back by one for any timezone ahead of UTC
// (e.g. Africa/Nairobi, UTC+3: local midnight Jan 1 becomes UTC 21:00 Dec
// 31). Formatting from the Date's own local components avoids that.
export const toISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Earliest date any business record could plausibly have — used for "all time". */
const EPOCH_START = '2000-01-01';

export function getPeriodRange(period: PeriodKey, reference: Date = new Date()): DateRange {
  const end = toISODate(reference);

  switch (period) {
    case 'today':
      return { start: end, end };
    case 'week': {
      const start = new Date(reference);
      start.setDate(start.getDate() - start.getDay()); // back to Sunday
      return { start: toISODate(start), end };
    }
    case 'month': {
      const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
      return { start: toISODate(start), end };
    }
    case 'quarter': {
      const quarterStartMonth = Math.floor(reference.getMonth() / 3) * 3;
      const start = new Date(reference.getFullYear(), quarterStartMonth, 1);
      return { start: toISODate(start), end };
    }
    case 'year': {
      const start = new Date(reference.getFullYear(), 0, 1);
      return { start: toISODate(start), end };
    }
    case 'all':
    default:
      return { start: EPOCH_START, end };
  }
}

/** A stable string key for caching results per date range. */
export function rangeKey(range: DateRange): string {
  return `${range.start}:${range.end}`;
}

export function daysBetween(range: DateRange): number {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

/** A 6-week (42 day) grid covering the given month, padded with the trailing days of the
 *  previous month and the leading days of the next so every row is a full Sun-Sat week. */
export function getMonthGrid(year: number, month: number, reference: Date = new Date()): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const todayStr = toISODate(reference);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dateStr = toISODate(d);
    days.push({ date: dateStr, inMonth: d.getMonth() === month, isToday: dateStr === todayStr });
  }
  return days;
}

export function formatPeriodLabel(period: PeriodKey): string {
  switch (period) {
    case 'today': return 'Today';
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'quarter': return 'This Quarter';
    case 'year': return 'This Year';
    case 'all': return 'All Time';
  }
}
