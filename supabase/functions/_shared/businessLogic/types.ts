// Deno copy of the plain data shapes from src/services/metrics/metricsService.ts,
// src/services/inventory/inventoryForecast.ts, and src/services/opportunities/opportunityEngine.ts.
// SOURCE OF TRUTH: those files — keep in sync manually (same convention as
// this directory's existing plans.ts duplication of src/utils/subscription.ts).

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
  transactionCount: number;
  netMarginPct: number | null;
}

export interface DailyMetric {
  day: string;
  revenue: number;
  profit: number;
  expenses: number;
  transactionCount: number;
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

export interface VendorProfit {
  vendorName: string;
  unitsBought: number;
  revenue: number;
  cost: number;
  profit: number;
  transactionCount: number;
}

export interface CustomerProfit {
  customerName: string;
  customerId: string | null;
  revenue: number;
  profit: number;
  transactionCount: number;
  lastOrderDate: string | null;
}

export type StockMovement = 'fast' | 'slow' | 'dead' | 'new';
export type StockoutRisk = 'high' | 'medium' | 'low' | 'unknown';

export interface StockForecastInput {
  productName: string;
  currentStock: number;
  reorderLevel: number;
  createdAt: string | null;
  unitsSoldInWindow: number;
}

export interface StockForecast {
  productName: string;
  currentStock: number;
  movement: StockMovement;
  unitsPerDay: number | null;
  daysOfStockRemaining: number | null;
  stockoutRisk: StockoutRisk;
  recommendedReorderQty: number | null;
  explanation: string;
}

export type OpportunityCategory = 'revenue' | 'collections' | 'profit' | 'inventory' | 'expenses' | 'retention';
export type OpportunityPriority = 'high' | 'medium' | 'low';

export interface Opportunity {
  id: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  title: string;
  detected: string;
  whyItMatters: string;
  estimatedImpact: { amount: number; label: string } | null;
  evidence: string[];
  recommendedAction: string;
  actionTab: string;
}

export type HealthFactorKey = 'profitability' | 'revenueTrend' | 'collections' | 'expenseDiscipline' | 'payables';

export interface HealthFactor {
  key: HealthFactorKey;
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface HealthScoreResult {
  score: number | null;
  band: 'excellent' | 'good' | 'fair' | 'needs_attention' | 'critical' | null;
  bandLabel: string;
  factors: HealthFactor[];
  factorsIncluded: number;
  factorsPossible: number;
  insufficientDataReason: string | null;
}
