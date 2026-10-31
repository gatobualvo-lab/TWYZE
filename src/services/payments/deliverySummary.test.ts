import { describe, it, expect } from 'vitest';
import { summarizeDeliveries, type DeliverySaleRow } from './deliverySummary';

const row = (over: Partial<DeliverySaleRow>): DeliverySaleRow => ({
  id: Math.random().toString(36).slice(2),
  delivery_guy: 'Peter',
  delivery_fee: 200,
  delivery_fee_paid: false,
  date: '2026-10-10',
  product_name: 'Desk',
  location: 'Westlands',
  ...over,
});

const ALL = { start: '', end: '' };

describe('summarizeDeliveries', () => {
  it('adds up paid and unpaid fees per delivery person', () => {
    const { guys, totals } = summarizeDeliveries(
      [
        row({ id: 'a', delivery_fee: 300, delivery_fee_paid: false }),
        row({ id: 'b', delivery_fee: 500, delivery_fee_paid: true }),
        row({ id: 'c', delivery_guy: 'Mary', delivery_fee: 150, delivery_fee_paid: false }),
      ],
      ALL
    );
    const peter = guys.find(g => g.name === 'Peter')!;
    expect(peter).toMatchObject({ totalOwed: 300, totalPaid: 500, balanceDue: 300, transactionCount: 2 });
    expect(totals).toEqual({ count: 3, fees: 950, paid: 500, owed: 450 });
  });

  it('balance due is what is still unpaid, even when more has been paid than is owed', () => {
    const { guys } = summarizeDeliveries(
      [row({ delivery_fee: 100, delivery_fee_paid: false }), row({ delivery_fee: 900, delivery_fee_paid: true })],
      ALL
    );
    expect(guys[0].balanceDue).toBe(100);
  });

  it('only counts deliveries inside the period, including both end days', () => {
    const rows = [
      row({ id: 'before', date: '2026-09-30' }),
      row({ id: 'first', date: '2026-10-01' }),
      row({ id: 'last', date: '2026-10-31T18:00:00+03:00' }),
      row({ id: 'after', date: '2026-11-01' }),
    ];
    const { guys, totals } = summarizeDeliveries(rows, { start: '2026-10-01', end: '2026-10-31' });
    expect(guys[0].transactions.map(t => t.id).sort()).toEqual(['first', 'last']);
    expect(totals.count).toBe(2);
  });

  it('leaves out people with nothing in the period and sorts by balance', () => {
    const rows = [
      row({ delivery_guy: 'Old', date: '2026-01-01', delivery_fee: 9999 }),
      row({ delivery_guy: 'Small', delivery_fee: 100 }),
      row({ delivery_guy: 'Big', delivery_fee: 700 }),
    ];
    const { guys } = summarizeDeliveries(rows, { start: '2026-10-01', end: '2026-10-31' });
    expect(guys.map(g => g.name)).toEqual(['Big', 'Small']);
  });

  it('ignores sales with no delivery person and tolerates missing fees', () => {
    const { guys, totals } = summarizeDeliveries(
      [row({ delivery_guy: null }), row({ delivery_guy: '  ' }), row({ delivery_fee: null })],
      ALL
    );
    expect(guys).toHaveLength(1);
    expect(totals).toEqual({ count: 1, fees: 0, paid: 0, owed: 0 });
  });

  it('lists the newest transaction first', () => {
    const { guys } = summarizeDeliveries([row({ id: 'old', date: '2026-10-01' }), row({ id: 'new', date: '2026-10-20' })], ALL);
    expect(guys[0].transactions.map(t => t.id)).toEqual(['new', 'old']);
  });
});
