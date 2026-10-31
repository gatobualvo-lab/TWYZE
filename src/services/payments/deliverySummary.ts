import { isWithin, type Period } from '../../utils/period';

export interface DeliverySaleRow {
  id: string;
  delivery_guy: string | null;
  delivery_fee: number | null;
  delivery_fee_paid: boolean | null;
  date: string;
  product_name: string;
  location: string;
}

export interface DeliveryTransaction {
  id: string;
  date: string;
  product_name: string;
  location: string;
  delivery_fee: number;
  delivery_fee_paid: boolean;
}

export interface DeliveryGuyPayment {
  name: string;
  totalOwed: number;
  totalPaid: number;
  balanceDue: number;
  transactionCount: number;
  transactions: DeliveryTransaction[];
}

export interface DeliveryTotals {
  count: number;
  fees: number;
  paid: number;
  owed: number;
}

const money = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Groups delivery fees by delivery person for the chosen period. Whoever has no deliveries in
 * the period is left out, and the biggest balance comes first.
 */
export function summarizeDeliveries(rows: DeliverySaleRow[], period: Pick<Period, 'start' | 'end'>) {
  const byGuy = new Map<string, DeliveryGuyPayment>();
  const totals: DeliveryTotals = { count: 0, fees: 0, paid: 0, owed: 0 };

  for (const row of rows) {
    const name = row.delivery_guy?.trim();
    if (!name || !isWithin(row.date, period)) continue;

    const fee = money(row.delivery_fee);
    const paid = !!row.delivery_fee_paid;
    let guy = byGuy.get(name);
    if (!guy) {
      guy = { name, totalOwed: 0, totalPaid: 0, balanceDue: 0, transactionCount: 0, transactions: [] };
      byGuy.set(name, guy);
    }

    guy.transactionCount++;
    guy.transactions.push({
      id: row.id,
      date: row.date,
      product_name: row.product_name,
      location: row.location,
      delivery_fee: fee,
      delivery_fee_paid: paid,
    });
    if (paid) guy.totalPaid += fee;
    else guy.totalOwed += fee;

    totals.count++;
    totals.fees += fee;
    if (paid) totals.paid += fee;
    else totals.owed += fee;
  }

  const guys = [...byGuy.values()];
  for (const guy of guys) {
    // "Balance due" is what is still unpaid; totalPaid is shown separately.
    guy.balanceDue = guy.totalOwed;
    guy.transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  guys.sort((a, b) => b.balanceDue - a.balanceDue || a.name.localeCompare(b.name));
  return { guys, totals };
}
