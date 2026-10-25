import { describe, it, expect } from 'vitest';
import {
  buildReminderEmail,
  buildReportEmail,
  duePeriods,
  hasActivity,
  money,
  pctChange,
  previousPeriod,
  type ReportData,
} from './index';

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe('duePeriods', () => {
  it('sends all three on 2 January: last quarter, last half and the whole year', () => {
    const periods = duePeriods(d('2027-01-02'));
    expect(periods.map(p => p.kind)).toEqual(['quarterly', 'semiannual', 'yearly']);
    expect(periods[0]).toMatchObject({ start: '2026-10-01', end: '2026-12-31', label: 'Q4 2026' });
    expect(periods[1]).toMatchObject({ start: '2026-07-01', end: '2026-12-31' });
    expect(periods[2]).toMatchObject({ start: '2026-01-01', end: '2026-12-31', label: 'Full year 2026' });
  });

  it('sends quarterly and half-year in July, but no yearly', () => {
    const periods = duePeriods(d('2026-07-03'));
    expect(periods.map(p => p.kind)).toEqual(['quarterly', 'semiannual']);
    expect(periods[0]).toMatchObject({ start: '2026-04-01', end: '2026-06-30', label: 'Q2 2026' });
    expect(periods[1]).toMatchObject({ start: '2026-01-01', end: '2026-06-30' });
  });

  it('sends only the quarterly report in April and October', () => {
    expect(duePeriods(d('2026-04-01')).map(p => p.kind)).toEqual(['quarterly']);
    expect(duePeriods(d('2026-10-05'))[0]).toMatchObject({ start: '2026-07-01', end: '2026-09-30', label: 'Q3 2026' });
  });

  it('sends nothing in other months, or after the first ten days of a period', () => {
    expect(duePeriods(d('2026-11-02'))).toEqual([]);
    expect(duePeriods(d('2026-12-01'))).toEqual([]);
    expect(duePeriods(d('2026-10-11'))).toEqual([]);
    expect(duePeriods(d('2027-01-15'))).toEqual([]);
  });
});

describe('previousPeriod', () => {
  it('returns the period of equal length just before', () => {
    expect(previousPeriod('2026-10-01', '2026-12-31')).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(previousPeriod('2026-01-01', '2026-12-31')).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });
});

describe('pctChange', () => {
  it('computes a one-decimal percentage and avoids dividing by zero', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(NaN, 5)).toBeNull();
  });
});

describe('money', () => {
  it('shows whole units for shillings and cents for dollars', () => {
    expect(money(1234.5, 'KES')).toBe('KES 1,235');
    expect(money(1234.5, 'USD')).toBe('USD 1,234.50');
    expect(money(NaN, 'KES')).toBe('KES 0');
  });
});

const data = (over: Partial<ReportData> = {}): ReportData => ({
  revenue: 100000,
  gross_profit: 40000,
  expenses: 15000,
  net_profit: 25000,
  sales_count: 42,
  receivables: 5000,
  top_products: [{ name: 'Desk <b>', units: 5, revenue: 50000, profit: 20000 }],
  top_customers: [{ name: 'Irene', revenue: 30000, orders: 3 }],
  ...over,
});

describe('buildReportEmail', () => {
  const period = { kind: 'quarterly' as const, start: '2026-07-01', end: '2026-09-30', label: 'Q3 2026' };

  it('summarises the period with a comparison against the previous one', () => {
    const mail = buildReportEmail('Jane', 'KES', [{ period, data: data(), previous: data({ revenue: 80000 }) }]);
    expect(mail.subject).toBe('Your business report: Q3 2026');
    expect(mail.html).toContain('KES 100,000');
    expect(mail.html).toContain('▲ 25% vs previous');
    expect(mail.text).toContain('Net profit: KES 25,000');
  });

  it('escapes names that come from the user', () => {
    const mail = buildReportEmail('<script>', 'KES', [{ period, data: data(), previous: null }]);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Desk &lt;b&gt;');
  });

  it('combines several periods into one email', () => {
    const yearly = { kind: 'yearly' as const, start: '2026-01-01', end: '2026-12-31', label: 'Full year 2026' };
    const mail = buildReportEmail('Jane', 'USD', [
      { period, data: data(), previous: null },
      { period: yearly, data: data(), previous: null },
    ]);
    expect(mail.subject).toContain('Q3 2026');
    expect(mail.subject).toContain('Full year 2026');
    expect(mail.html).toContain('USD 100,000.00');
  });
});

describe('hasActivity', () => {
  it('is false for an idle period', () => {
    expect(hasActivity(data({ revenue: 0, expenses: 0, sales_count: 0 }))).toBe(false);
    expect(hasActivity(data())).toBe(true);
  });
});

describe('buildReminderEmail', () => {
  it('names a single task in the subject and escapes it', () => {
    const mail = buildReminderEmail('Jane', [{ title: 'Call <supplier>', due_date: '2026-11-02', due_time: '14:30' }]);
    expect(mail.subject).toBe('Reminder: Call <supplier>');
    expect(mail.html).toContain('Call &lt;supplier&gt;');
    expect(mail.html).toContain('2026-11-02 14:30');
  });

  it('counts several tasks', () => {
    const mail = buildReminderEmail('', [
      { title: 'A', due_date: null, due_time: null },
      { title: 'B', due_date: null, due_time: null },
    ]);
    expect(mail.subject).toBe('Reminder: 2 tasks need your attention');
  });
});
