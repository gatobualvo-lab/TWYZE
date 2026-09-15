// Deno copy of the date-range helpers from src/utils/dateRange.ts and
// src/services/metrics/useHealthScore.ts. SOURCE OF TRUTH: those files.

export interface DateRange {
  start: string;
  end: string;
}

// Deliberately NOT `d.toISOString().split('T')[0]` — that converts to UTC
// first, which rolls the date back by one for any timezone ahead of UTC
// (e.g. Africa/Nairobi, UTC+3).
export const toISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getMonthRange(reference: Date = new Date()): DateRange {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  return { start: toISODate(start), end: toISODate(reference) };
}

/** Matches src/utils/dateRange.ts's getPeriodRange('all') — earliest date any record could plausibly have. */
export function getAllTimeRange(reference: Date = new Date()): DateRange {
  return { start: '2000-01-01', end: toISODate(reference) };
}

export function previousEqualPeriod(range: DateRange): DateRange {
  const start = new Date(range.start + 'T00:00:00');
  const end = new Date(range.end + 'T00:00:00');
  const lengthMs = end.getTime() - start.getTime();

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);

  return { start: toISODate(prevStart), end: toISODate(prevEnd) };
}
