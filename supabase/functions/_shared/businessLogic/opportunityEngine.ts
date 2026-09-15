// Deno copy of src/services/opportunities/opportunityEngine.ts.
// SOURCE OF TRUTH: src/services/opportunities/opportunityEngine.ts — keep in
// sync manually. This is what makes "the AI Assistant can't disagree with
// Opportunity Center" true: the math is one copy-pasted module, not
// reimplemented.

import type { BusinessMetrics, CustomerProfit, Opportunity, OpportunityPriority, ProductProfit, StockForecast } from './types.ts';
import { toNum } from './toNum.ts';

const DORMANT_THRESHOLD_DAYS = 60;
const LOW_MARGIN_THRESHOLD_PCT = 10;
const OLD_QUOTATION_THRESHOLD_DAYS = 14;

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

export function detectOverdueBalances(
  unpaidSales: { clientName: string | null; sellingPrice: number; date: string | null }[]
): Opportunity[] {
  const byCustomer = new Map<string, { total: number; count: number; oldestDate: string | null }>();
  for (const sale of unpaidSales) {
    const name = sale.clientName?.trim();
    if (!name) continue;
    const existing = byCustomer.get(name) ?? { total: 0, count: 0, oldestDate: null };
    existing.total += toNum(sale.sellingPrice);
    existing.count += 1;
    if (!existing.oldestDate || (sale.date && sale.date < existing.oldestDate)) existing.oldestDate = sale.date;
    byCustomer.set(name, existing);
  }

  const opportunities: Opportunity[] = [];
  for (const [name, info] of byCustomer.entries()) {
    if (info.total <= 0) continue;
    const age = daysSince(info.oldestDate);
    opportunities.push({
      id: `overdue:${name}`,
      category: 'collections',
      priority: info.total > 20000 || (age !== null && age > 30) ? 'high' : 'medium',
      title: `${name} owes ${info.count > 1 ? `${info.count} unpaid orders` : '1 unpaid order'}`,
      detected: `${name} has an outstanding balance from ${info.count} sale${info.count === 1 ? '' : 's'}.`,
      whyItMatters: 'This is money already earned but not yet collected — the fastest kind of revenue to recover.',
      estimatedImpact: { amount: info.total, label: 'Outstanding balance' },
      evidence: [`${info.count} unpaid sale(s) totaling the amount shown`, age !== null ? `Oldest unpaid sale: ${age} days ago` : ''].filter(Boolean),
      recommendedAction: `Follow up with ${name} for payment.`,
      actionTab: 'customer-timeline',
    });
  }
  return opportunities;
}

export function detectDormantCustomers(customers: CustomerProfit[]): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const c of customers) {
    const age = daysSince(c.lastOrderDate);
    if (age === null || age <= DORMANT_THRESHOLD_DAYS) continue;
    if (c.transactionCount < 2) continue;

    const avgOrderValue = c.revenue / c.transactionCount;
    opportunities.push({
      id: `dormant:${c.customerName}`,
      category: 'retention',
      priority: c.revenue > 30000 ? 'high' : 'medium',
      title: `${c.customerName} hasn't ordered in ${age} days`,
      detected: `Previously a repeat customer (${c.transactionCount} orders, ${avgOrderValue > 0 ? 'averaging' : 'totaling'} real revenue) with no recent activity.`,
      whyItMatters: 'Repeat customers are cheaper to keep than new ones are to find — a quiet regular is worth checking in on before they\'re gone for good.',
      estimatedImpact: avgOrderValue > 0 ? { amount: avgOrderValue, label: 'Typical order value if they return' } : null,
      evidence: [`${c.transactionCount} past orders`, `Last order: ${c.lastOrderDate ?? 'unknown'}`],
      recommendedAction: `Reach out to ${c.customerName} — a message or call is often enough to bring a lapsed regular back.`,
      actionTab: 'customer-timeline',
    });
  }
  return opportunities;
}

export function detectLowMarginProducts(products: ProductProfit[]): Opportunity[] {
  const sellingProducts = products.filter(p => p.revenue > 0 && p.transactionCount > 0);
  if (sellingProducts.length === 0) return [];

  const avgMargin = sellingProducts.reduce((sum, p) => sum + (p.marginPct ?? 0), 0) / sellingProducts.length;

  const opportunities: Opportunity[] = [];
  for (const p of sellingProducts) {
    if (p.marginPct === null || p.marginPct >= LOW_MARGIN_THRESHOLD_PCT) continue;
    if (p.marginPct >= avgMargin) continue;

    const impactAmount = (avgMargin - p.marginPct) / 100 * p.revenue;
    opportunities.push({
      id: `low-margin:${p.productName}`,
      category: 'profit',
      priority: p.revenue > 20000 ? 'high' : 'medium',
      title: `${p.productName} sells well but at a thin ${p.marginPct.toFixed(1)}% margin`,
      detected: `${p.unitsSold} units sold for ${p.revenue > 0 ? 'real revenue' : 'no revenue'}, but margin is well below your ${avgMargin.toFixed(1)}% average.`,
      whyItMatters: 'Volume without margin means this product is doing a lot of work for comparatively little profit.',
      estimatedImpact: impactAmount > 0 ? { amount: impactAmount, label: 'Extra profit if this matched your average margin' } : null,
      evidence: [`Revenue: this product's tracked sales in the period`, `Margin ${p.marginPct.toFixed(1)}% vs. your ${avgMargin.toFixed(1)}% average across all products`],
      recommendedAction: `Review the buying price or selling price for ${p.productName} — even a small adjustment compounds over ${p.transactionCount} sales.`,
      actionTab: 'profit-analytics',
    });
  }
  return opportunities;
}

export function detectInventoryRisks(forecasts: StockForecast[]): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const f of forecasts) {
    if (f.stockoutRisk === 'high' && f.unitsPerDay) {
      opportunities.push({
        id: `stockout:${f.productName}`,
        category: 'inventory',
        priority: 'high',
        title: `${f.productName} is about to run out`,
        detected: f.explanation,
        whyItMatters: "A stockout on a fast-moving product means turning away sales you'd otherwise make.",
        estimatedImpact: null,
        evidence: [`Current stock: ${f.currentStock}`, `Selling ~${f.unitsPerDay.toFixed(1)} units/day`],
        recommendedAction: f.recommendedReorderQty ? `Reorder about ${f.recommendedReorderQty} units soon.` : 'Reorder soon.',
        actionTab: 'inventory-predictions',
      });
    } else if (f.movement === 'dead') {
      opportunities.push({
        id: `dead-stock:${f.productName}`,
        category: 'inventory',
        priority: 'low',
        title: `${f.productName} hasn't sold in a while`,
        detected: f.explanation,
        whyItMatters: 'Stock that isn\'t moving is cash sitting on a shelf instead of in the business.',
        estimatedImpact: null,
        evidence: [`Current stock: ${f.currentStock}`],
        recommendedAction: 'Consider a discount, bundle, or promotion to move this stock — or stop reordering it.',
        actionTab: 'inventory-predictions',
      });
    }
  }
  return opportunities;
}

export function detectForgottenQuotations(
  quotations: { documentNumber: string; customerName: string | null; total: number; date: string | null; status: string | null }[]
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const q of quotations) {
    const status = (q.status ?? '').toLowerCase();
    if (status === 'converted' || status === 'invoiced' || status === 'accepted' || status === 'rejected' || status === 'expired') continue;
    const age = daysSince(q.date);
    if (age === null || age < OLD_QUOTATION_THRESHOLD_DAYS) continue;

    opportunities.push({
      id: `quotation:${q.documentNumber}`,
      category: 'revenue',
      priority: q.total > 20000 ? 'high' : 'medium',
      title: `Quotation ${q.documentNumber} was never followed up`,
      detected: `Sent ${age} days ago to ${q.customerName ?? 'a customer'}, still marked "${q.status ?? 'pending'}".`,
      whyItMatters: 'A quotation is a customer who already showed interest — following up costs nothing and the sale is most of the way there.',
      estimatedImpact: { amount: q.total, label: 'Potential revenue if converted' },
      evidence: [`Quotation date: ${q.date ?? 'unknown'}`, `Status: ${q.status ?? 'pending'}`],
      recommendedAction: `Follow up on quotation ${q.documentNumber} with ${q.customerName ?? 'the customer'}.`,
      actionTab: 'documents-quotations',
    });
  }
  return opportunities;
}

export function detectExpenseSpike(current: BusinessMetrics, previous: BusinessMetrics | null): Opportunity[] {
  if (!previous || previous.totalExpenses <= 0) return [];
  const delta = current.totalExpenses - previous.totalExpenses;
  const pctChange = (delta / previous.totalExpenses) * 100;
  if (pctChange < 30 || delta < 1000) return [];

  return [{
    id: 'expense-spike',
    category: 'expenses',
    priority: pctChange > 75 ? 'high' : 'medium',
    title: `Expenses are up ${pctChange.toFixed(0)}% from last period`,
    detected: `Total expenses this period are up compared to the previous period of the same length.`,
    whyItMatters: 'A sudden jump in spending is worth understanding before it becomes the new normal.',
    estimatedImpact: { amount: delta, label: 'Increase vs. previous period' },
    evidence: ['Ad, vendor, and general expenses combined, compared to the equivalent prior period'],
    recommendedAction: 'Check the Daily Closing Report or Expense Overview for what changed.',
    actionTab: 'expense-overview',
  }];
}

const PRIORITY_ORDER: Record<OpportunityPriority, number> = { high: 0, medium: 1, low: 2 };

export function sortOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const aAmount = a.estimatedImpact?.amount ?? 0;
    const bAmount = b.estimatedImpact?.amount ?? 0;
    return bAmount - aAmount;
  });
}
