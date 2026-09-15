import { toNum } from './number';

// Pulled out of ProductItem.tsx / MultiProductSalesForm.tsx so the sale
// money-math (previously only exercised by clicking through the form) has a
// place to be unit tested independent of React state/effects.

export type TaxType = 'none' | 'vat' | 'turnover';

export const VAT_RATE = 0.16;
export const TURNOVER_TAX_RATE = 0.015;

export interface LineItemInput {
  buyingPrice: unknown;
  sellingPrice: unknown;
  quantity: unknown;
  taxType: TaxType;
}

export interface LineItemTotals {
  totalBuyingPrice: number;
  totalSellingPrice: number;
  vatAmount: number;
  turnoverTaxAmount: number;
  profit: number;
}

export function calculateLineItemTotals(item: LineItemInput): LineItemTotals {
  const qty = toNum(item.quantity);
  const totalBuyingPrice = toNum(item.buyingPrice) * qty;
  const totalSellingPrice = toNum(item.sellingPrice) * qty;

  let vatAmount = 0;
  let turnoverTaxAmount = 0;
  if (item.taxType === 'vat') {
    vatAmount = totalSellingPrice * VAT_RATE;
  } else if (item.taxType === 'turnover') {
    turnoverTaxAmount = totalSellingPrice * TURNOVER_TAX_RATE;
  }

  const profit = totalSellingPrice - totalBuyingPrice - vatAmount - turnoverTaxAmount;

  return { totalBuyingPrice, totalSellingPrice, vatAmount, turnoverTaxAmount, profit };
}

export interface SaleLineItem {
  buyingPrice: unknown;
  sellingPrice: unknown;
  quantity: unknown;
  vatAmount: unknown;
  turnoverTaxAmount: unknown;
}

export interface SaleTotals {
  sellingPriceTotal: number;
  buyingPriceTotal: number;
  taxesTotal: number;
  profit: number;
}

export function calculateSaleTotals(
  products: SaleLineItem[],
  deliveryFee: unknown,
  clientDeliveryCharge: unknown
): SaleTotals {
  const sellingPriceTotal = products.reduce(
    (sum, p) => sum + toNum(p.sellingPrice) * toNum(p.quantity),
    0
  );
  const buyingPriceTotal = products.reduce(
    (sum, p) => sum + toNum(p.buyingPrice) * toNum(p.quantity),
    0
  );
  const taxesTotal = products.reduce(
    (sum, p) => sum + toNum(p.vatAmount) + toNum(p.turnoverTaxAmount),
    0
  );

  const profit =
    sellingPriceTotal + toNum(clientDeliveryCharge) - buyingPriceTotal - toNum(deliveryFee) - taxesTotal;

  return { sellingPriceTotal, buyingPriceTotal, taxesTotal, profit };
}
