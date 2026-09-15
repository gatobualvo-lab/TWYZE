import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useMetricsContext } from '../metrics/MetricsProvider';
import { getPeriodRange } from '../../utils/dateRange';
import { forecastStock } from '../inventory/inventoryForecast';
import { fetchInventoryWithMeta } from '../../components/inventory/SmartInventoryPredictions';
import {
  detectOverdueBalances, detectDormantCustomers, detectLowMarginProducts,
  detectInventoryRisks, detectForgottenQuotations, detectExpenseSpike, sortOpportunities,
} from './opportunityEngine';
import type { Opportunity } from './opportunityEngine';

interface RawData {
  unpaidSales: { clientName: string | null; sellingPrice: number; date: string | null }[];
  quotations: { documentNumber: string; customerName: string | null; total: number; date: string | null; status: string | null }[];
}

async function fetchRawData(): Promise<RawData> {
  const [salesResult, docsResult] = await Promise.all([
    supabase
      .from('sales')
      .select('client_name, selling_price, date')
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .eq('payment_status', 'Unpaid'),
    supabase
      .from('documents')
      .select('document_number, customer_name, total, date, status')
      .eq('document_type', 'quotation'),
  ]);

  return {
    unpaidSales: (salesResult.data ?? []).map(r => ({ clientName: r.client_name, sellingPrice: r.selling_price ?? 0, date: r.date })),
    quotations: (docsResult.data ?? []).map(r => ({
      documentNumber: r.document_number, customerName: r.customer_name, total: r.total ?? 0, date: r.date, status: r.status,
    })),
  };
}

/**
 * Shared by Opportunity Center (the full list view) and the AI Business
 * Advisor (which narrates the top few) — both need the exact same detection
 * pass; running it twice with separate fetches would mean the Advisor could
 * disagree with Opportunity Center about what's actually happening.
 */
export function useOpportunities(): { opportunities: Opportunity[]; loading: boolean } {
  const ctx = useMetricsContext();
  const allTimeRange = useMemo(() => getPeriodRange('all'), []);
  const monthRange = useMemo(() => getPeriodRange('month'), []);
  const prevMonthRange = useMemo(() => {
    const start = new Date(monthRange.start + 'T00:00:00');
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(prevStart), end: fmt(prevEnd) };
  }, [monthRange]);

  const [raw, setRaw] = useState<RawData | null>(null);
  const [inventoryForecasts, setInventoryForecasts] = useState<ReturnType<typeof forecastStock>[] | null>(null);

  useEffect(() => {
    fetchRawData().then(setRaw).catch(() => setRaw({ unpaidSales: [], quotations: [] }));
    ctx.loadProfitByCustomer(allTimeRange, 200).catch(() => {});
    ctx.loadProfitByProduct(monthRange, 500).catch(() => {});
    ctx.loadMetrics(monthRange).catch(() => {});
    ctx.loadMetrics(prevMonthRange).catch(() => {});

    Promise.all([fetchInventoryWithMeta(), ctx.loadProfitByProduct(monthRange, 500)]).then(([items, products]) => {
      const salesByName = new Map(products.map(p => [p.productName.trim().toLowerCase(), p.unitsSold]));
      setInventoryForecasts(
        items.filter(i => i.product_name).map(i =>
          forecastStock({
            productName: i.product_name!,
            currentStock: i.current_stock ?? 0,
            reorderLevel: i.reorder_level ?? 0,
            createdAt: i.created_at,
            unitsSoldInWindow: salesByName.get(i.product_name!.trim().toLowerCase()) ?? 0,
          })
        )
      );
    }).catch(() => setInventoryForecasts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customersEntry = ctx.getProfitByCustomer(allTimeRange, 200);
  const productsEntry = ctx.getProfitByProduct(monthRange, 500);
  const metricsEntry = ctx.getMetrics(monthRange);
  const prevMetricsEntry = ctx.getMetrics(prevMonthRange);

  const loading = !raw || !inventoryForecasts || !customersEntry.data || !productsEntry.data || !metricsEntry.data;

  const opportunities = useMemo(() => {
    if (loading) return [];
    const all = [
      ...detectOverdueBalances(raw!.unpaidSales),
      ...detectDormantCustomers(customersEntry.data!),
      ...detectLowMarginProducts(productsEntry.data!),
      ...detectInventoryRisks(inventoryForecasts!),
      ...detectForgottenQuotations(raw!.quotations),
      ...detectExpenseSpike(metricsEntry.data!, prevMetricsEntry.data),
    ];
    return sortOpportunities(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return { opportunities, loading };
}
