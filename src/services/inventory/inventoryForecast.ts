// Turns static stock counts into decision-support info. Deliberately simple,
// explainable thresholds rather than a black-box model — a business owner
// needs to trust why something is flagged, not just that it is.
//
// Key judgment call: a product with zero recent sales is only "dead stock"
// if it's actually had time to sell. A product added to inventory 3 days
// ago with zero sales isn't dead, it's just new — conflating the two would
// be exactly the kind of misleading prediction the brief warns against.

const VELOCITY_WINDOW_DAYS = 30;
const NEW_PRODUCT_GRACE_DAYS = 30;
const FAST_MOVING_UNITS_PER_DAY = 0.3; // roughly 9+ units/month
const REORDER_BUFFER_DAYS = 45;
const STOCKOUT_HIGH_RISK_DAYS = 7;
const STOCKOUT_MEDIUM_RISK_DAYS = 21;

export type StockMovement = 'fast' | 'slow' | 'dead' | 'new';
export type StockoutRisk = 'high' | 'medium' | 'low' | 'unknown';

export interface StockForecastInput {
  productName: string;
  currentStock: number;
  reorderLevel: number;
  /** ISO date/timestamp the item was added to inventory. */
  createdAt: string | null;
  /** Units sold in the last VELOCITY_WINDOW_DAYS, from get_profit_by_product. */
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

export const INVENTORY_FORECAST_CONSTANTS = {
  VELOCITY_WINDOW_DAYS,
  NEW_PRODUCT_GRACE_DAYS,
  FAST_MOVING_UNITS_PER_DAY,
  REORDER_BUFFER_DAYS,
  STOCKOUT_HIGH_RISK_DAYS,
  STOCKOUT_MEDIUM_RISK_DAYS,
};
