// Deno copy of src/services/inventory/inventoryForecast.ts's forecastStock().
// SOURCE OF TRUTH: src/services/inventory/inventoryForecast.ts — keep in sync manually.

import type { StockForecast, StockForecastInput, StockMovement, StockoutRisk } from './types.ts';

const VELOCITY_WINDOW_DAYS = 30;
const NEW_PRODUCT_GRACE_DAYS = 30;
const FAST_MOVING_UNITS_PER_DAY = 0.3;
const REORDER_BUFFER_DAYS = 45;
const STOCKOUT_HIGH_RISK_DAYS = 7;
const STOCKOUT_MEDIUM_RISK_DAYS = 21;

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

export function forecastStock(input: StockForecastInput): StockForecast {
  const ageInDays = daysAgo(input.createdAt);
  const isNew = ageInDays !== null && ageInDays < NEW_PRODUCT_GRACE_DAYS;
  const unitsSold = Math.max(0, input.unitsSoldInWindow);

  if (isNew && unitsSold === 0) {
    return {
      productName: input.productName,
      currentStock: input.currentStock,
      movement: 'new',
      unitsPerDay: null,
      daysOfStockRemaining: null,
      stockoutRisk: 'unknown',
      recommendedReorderQty: null,
      explanation: `Added ${ageInDays} day${ageInDays === 1 ? '' : 's'} ago — not enough sales history yet to predict.`,
    };
  }

  if (unitsSold === 0) {
    return {
      productName: input.productName,
      currentStock: input.currentStock,
      movement: 'dead',
      unitsPerDay: 0,
      daysOfStockRemaining: null,
      stockoutRisk: 'unknown',
      recommendedReorderQty: null,
      explanation: `No sales in the last ${VELOCITY_WINDOW_DAYS} days — this stock isn't moving.`,
    };
  }

  const unitsPerDay = unitsSold / VELOCITY_WINDOW_DAYS;
  const daysOfStockRemaining = unitsPerDay > 0 ? input.currentStock / unitsPerDay : null;
  const movement: StockMovement = unitsPerDay >= FAST_MOVING_UNITS_PER_DAY ? 'fast' : 'slow';

  let stockoutRisk: StockoutRisk = 'unknown';
  if (daysOfStockRemaining !== null) {
    if (daysOfStockRemaining <= STOCKOUT_HIGH_RISK_DAYS) stockoutRisk = 'high';
    else if (daysOfStockRemaining <= STOCKOUT_MEDIUM_RISK_DAYS) stockoutRisk = 'medium';
    else stockoutRisk = 'low';
  }

  let recommendedReorderQty: number | null = null;
  if (daysOfStockRemaining !== null && daysOfStockRemaining < REORDER_BUFFER_DAYS) {
    const target = Math.ceil(unitsPerDay * REORDER_BUFFER_DAYS);
    recommendedReorderQty = Math.max(0, target - input.currentStock);
  }

  const roundedDays = daysOfStockRemaining !== null ? Math.round(daysOfStockRemaining) : null;
  const explanation =
    stockoutRisk === 'high'
      ? `Selling ~${unitsPerDay.toFixed(1)}/day — at this pace you'll run out in about ${roundedDays} day${roundedDays === 1 ? '' : 's'}.`
      : stockoutRisk === 'medium'
        ? `About ${roundedDays} days of stock left at the current sales pace.`
        : `Comfortable stock level — about ${roundedDays} days remaining at the current pace.`;

  return {
    productName: input.productName,
    currentStock: input.currentStock,
    movement,
    unitsPerDay,
    daysOfStockRemaining,
    stockoutRisk,
    recommendedReorderQty,
    explanation,
  };
}
