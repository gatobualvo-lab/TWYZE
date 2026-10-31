// Date ranges the owner picks to look at "this month's" or "last week's" numbers.
// Dates are plain local calendar days ("2026-10-31"), matching how sales and expenses are
// stored, so a range never shifts by a day because of the time zone.

export type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'year' | 'custom';

export interface Period {
  preset: PeriodPreset;
  /** First day, inclusive ("" = no lower limit). */
  start: string;
  /** Last day, inclusive ("" = no upper limit). */
  end: string;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  last_month: 'Last month',
  year: 'This year',
  custom: 'Custom',
};

export const PERIOD_ORDER: PeriodPreset[] = ['all', 'today', 'week', 'month', 'last_month', 'year', 'custom'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD (not UTC, so late evening in Nairobi stays "today"). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The range for a preset, relative to `now`. Weeks run Monday to Sunday. */
export function periodFor(preset: PeriodPreset, now: Date = new Date(), custom?: { start: string; end: string }): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { preset, start: toIsoDate(now), end: toIsoDate(now) };
    case 'week': {
      const sinceMonday = (now.getDay() + 6) % 7;
      const monday = new Date(y, m, now.getDate() - sinceMonday);
      const sunday = new Date(y, m, now.getDate() - sinceMonday + 6);
      return { preset, start: toIsoDate(monday), end: toIsoDate(sunday) };
    }
    case 'month':
      return { preset, start: toIsoDate(new Date(y, m, 1)), end: toIsoDate(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { preset, start: toIsoDate(new Date(y, m - 1, 1)), end: toIsoDate(new Date(y, m, 0)) };
    case 'year':
      return { preset, start: `${y}-01-01`, end: `${y}-12-31` };
    case 'custom':
      return { preset, start: custom?.start ?? '', end: custom?.end ?? '' };
    default:
      return { preset: 'all', start: '', end: '' };
  }
}

/**
 * Whether a stored date or timestamp falls inside the period. Only the calendar day is
 * compared, so "2026-10-31T14:30:00Z" is inside a range that ends on 2026-10-31.
 */
export function isWithin(date: string | null | undefined, period: Pick<Period, 'start' | 'end'>): boolean {
  if (!period.start && !period.end) return true;
  if (!date) return false;
  const day = String(date).slice(0, 10);
  if (period.start && day < period.start) return false;
  if (period.end && day > period.end) return false;
  return true;
}

const short = (iso: string, withYear: boolean) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** Human wording for headings: "All time", "Today", "1 Oct – 31 Oct 2026". */
export function describePeriod(period: Period): string {
  if (!period.start && !period.end) return 'All time';
  if (period.preset === 'today') return 'Today';
  if (period.start && period.start === period.end) return short(period.start, true);
  if (period.start && period.end) return `${short(period.start, false)} – ${short(period.end, true)}`;
  if (period.start) return `From ${short(period.start, true)}`;
  return `Up to ${short(period.end, true)}`;
}

/** A custom range typed back to front is swapped rather than silently matching nothing. */
export function normalizeCustom(start: string, end: string): { start: string; end: string } {
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
}
