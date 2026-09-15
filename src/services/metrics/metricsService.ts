import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import type { DateRange } from '../../utils/dateRange';

// Thin typed wrapper around the get_business_metrics/get_daily_series/
// get_profit_by_* RPCs (see migration 20260807090000). Every number is run
// through toNum() so a null/undefined column from the DB (a business with
// no data yet) becomes 0, never NaN/undefined, on the way into React state.

export interface BusinessMetrics {
  salesRevenue: number;
  salesProfit: number;
  salesCount: number;
  supplierRevenue: number;
  supplierProfit: number;
  supplierCount: number;
  adExpenses: number;
  vendorExpenses: number;
  generalExpenses: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  cashReceived: number;
  /** Convenience: salesCount + supplierCount. */
  transactionCount: number;
  /** Convenience: netProfit / (salesRevenue + supplierRevenue), null if no revenue. */
  netMarginPct: number | null;
}

const EMPTY_METRICS: BusinessMetrics = {
  salesRevenue: 0, salesProfit: 0, salesCount: 0,
  supplierRevenue: 0, supplierProfit: 0, supplierCount: 0,
  adExpenses: 0, vendorExpenses: 0, generalExpenses: 0, totalExpenses: 0,
  grossProfit: 0, netProfit: 0,
  outstandingReceivables: 0, outstandingPayables: 0, cashReceived: 0,
  transactionCount: 0, netMarginPct: null,
};

export async function fetchBusinessMetrics(range: DateRange): Promise<BusinessMetrics> {
  const { data, error } = await supabase.rpc('get_business_metrics', {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) return EMPTY_METRICS;

  const salesRevenue = toNum(row.sales_revenue);
  const supplierRevenue = toNum(row.supplier_revenue);
  const netProfit = toNum(row.net_profit);
  const totalRevenue = salesRevenue + supplierRevenue;

  return {
    salesRevenue,
    salesProfit: toNum(row.sales_profit),
    salesCount: toNum(row.sales_count),
    supplierRevenue,
    supplierProfit: toNum(row.supplier_profit),
    supplierCount: toNum(row.supplier_count),
    adExpenses: toNum(row.ad_expenses),
    vendorExpenses: toNum(row.vendor_expenses),
    generalExpenses: toNum(row.general_expenses),
    totalExpenses: toNum(row.total_expenses),
    grossProfit: toNum(row.gross_profit),
    netProfit,
    outstandingReceivables: toNum(row.outstanding_receivables),
    outstandingPayables: toNum(row.outstanding_payables),
    cashReceived: toNum(row.cash_received),
    transactionCount: toNum(row.sales_count) + toNum(row.supplier_count),
    netMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null,
  };
}

export interface DailyMetric {
  day: string;
  revenue: number;
  profit: number;
  expenses: number;
  transactionCount: number;
}

export async function fetchDailySeries(range: DateRange): Promise<DailyMetric[]> {
  const { data, error } = await supabase.rpc('get_daily_series', {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    day: row.day,
    revenue: toNum(row.revenue),
    profit: toNum(row.profit),
    expenses: toNum(row.expenses),
    transactionCount: toNum(row.transaction_count),
  }));
}

export interface ProductProfit {
  productName: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  transactionCount: number;
}

export async function fetchProfitByProduct(range: DateRange, limit = 50): Promise<ProductProfit[]> {
  const { data, error } = await supabase.rpc('get_profit_by_product', {
    p_start: range.start,
    p_end: range.end,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    productName: row.product_name ?? 'Unknown product',
    unitsSold: toNum(row.units_sold),
    revenue: toNum(row.revenue),
    cost: toNum(row.cost),
    profit: toNum(row.profit),
    marginPct: row.margin_pct === null || row.margin_pct === undefined ? null : toNum(row.margin_pct),
    transactionCount: toNum(row.transaction_count),
  }));
}

export interface VendorProfit {
  vendorName: string;
  unitsBought: number;
  revenue: number;
  cost: number;
  profit: number;
  transactionCount: number;
}

export async function fetchProfitByVendor(range: DateRange, limit = 50): Promise<VendorProfit[]> {
  const { data, error } = await supabase.rpc('get_profit_by_vendor', {
    p_start: range.start,
    p_end: range.end,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    vendorName: row.vendor_name ?? 'Unknown vendor',
    unitsBought: toNum(row.units_bought),
    revenue: toNum(row.revenue),
    cost: toNum(row.cost),
    profit: toNum(row.profit),
    transactionCount: toNum(row.transaction_count),
  }));
}

export interface CustomerProfit {
  customerName: string;
  customerId: string | null;
  revenue: number;
  profit: number;
  transactionCount: number;
  lastOrderDate: string | null;
}

export async function fetchProfitByCustomer(range: DateRange, limit = 50): Promise<CustomerProfit[]> {
  const { data, error } = await supabase.rpc('get_profit_by_customer', {
    p_start: range.start,
    p_end: range.end,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    customerName: row.customer_name ?? 'Unknown customer',
    customerId: row.customer_id ?? null,
    revenue: toNum(row.revenue),
    profit: toNum(row.profit),
    transactionCount: toNum(row.transaction_count),
    lastOrderDate: row.last_order_date ?? null,
  }));
}
