import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import { getPeriodRange } from '../../utils/dateRange';

// Combines four things that previously lived on four separate screens
// (Opportunity Center's overdue balances, Documents' unpaid invoices,
// Vendor Transactions' per-vendor balance, Delivery Payments' balance) into
// one "who owes who" view — reuses the get_unpaid_invoice_total and
// get_vendor_balance_summary RPCs built for the AI Business Assistant
// rather than re-deriving the same math a third time.

export interface VendorBalance {
  vendorName: string;
  totalOwed: number;
  totalPaid: number;
  balance: number;
}

export interface DeliveryGuyBalance {
  name: string;
  totalOwed: number;
  totalPaid: number;
  balance: number;
}

export interface CashPositionData {
  outstandingReceivables: number;
  unpaidInvoiceTotal: number;
  unpaidInvoiceCount: number;
  vendorBalances: VendorBalance[];
  deliveryBalances: DeliveryGuyBalance[];
}

export async function fetchCashPosition(): Promise<CashPositionData> {
  const allTime = getPeriodRange('all');

  const [metricsRes, invoiceRes, vendorRes, salesRes] = await Promise.all([
    supabase.rpc('get_business_metrics', { p_start: allTime.start, p_end: allTime.end }),
    supabase.rpc('get_unpaid_invoice_total', { p_start: allTime.start, p_end: allTime.end }),
    supabase.rpc('get_vendor_balance_summary', { p_limit: 100 }),
    supabase.from('sales').select('delivery_guy, delivery_fee, delivery_fee_paid').eq('is_deleted', false).eq('is_archived', false),
  ]);

  const outstandingReceivables = toNum(metricsRes.data?.[0]?.outstanding_receivables);

  const invoiceRow = invoiceRes.data?.[0];
  const unpaidInvoiceTotal = toNum(invoiceRow?.unpaid_total);
  const unpaidInvoiceCount = toNum(invoiceRow?.unpaid_count);

  const vendorBalances: VendorBalance[] = (vendorRes.data ?? [])
    .map((row: Record<string, unknown>) => ({
      vendorName: row.vendor_name as string,
      totalOwed: toNum(row.total_owed),
      totalPaid: toNum(row.total_paid),
      balance: toNum(row.balance),
    }))
    .filter(v => v.balance > 0);

  const deliveryMap = new Map<string, DeliveryGuyBalance>();
  for (const row of salesRes.data ?? []) {
    if (!row.delivery_guy) continue;
    const existing = deliveryMap.get(row.delivery_guy) ?? { name: row.delivery_guy, totalOwed: 0, totalPaid: 0, balance: 0 };
    const fee = toNum(row.delivery_fee);
    if (row.delivery_fee_paid) existing.totalPaid += fee;
    else existing.totalOwed += fee;
    existing.balance = existing.totalOwed - existing.totalPaid;
    deliveryMap.set(row.delivery_guy, existing);
  }
  const deliveryBalances = Array.from(deliveryMap.values()).filter(d => d.balance > 0);

  return { outstandingReceivables, unpaidInvoiceTotal, unpaidInvoiceCount, vendorBalances, deliveryBalances };
}
