import { describe, it, expect } from 'vitest';
import { calculateLineItemTotals, calculateSaleTotals, VAT_RATE, TURNOVER_TAX_RATE } from './saleMath';

describe('calculateLineItemTotals', () => {
  it('computes profit with no tax', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 100,
      sellingPrice: 150,
      quantity: 2,
      taxType: 'none',
    });
    expect(result.totalBuyingPrice).toBe(200);
    expect(result.totalSellingPrice).toBe(300);
    expect(result.vatAmount).toBe(0);
    expect(result.turnoverTaxAmount).toBe(0);
    expect(result.profit).toBe(100);
  });

  it('deducts VAT at 16% of total selling price from profit', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 100,
      sellingPrice: 150,
      quantity: 1,
      taxType: 'vat',
    });
    expect(result.vatAmount).toBeCloseTo(150 * VAT_RATE);
    expect(result.turnoverTaxAmount).toBe(0);
    expect(result.profit).toBeCloseTo(150 - 100 - 150 * VAT_RATE);
  });

  it('deducts turnover tax at 1.5% of total selling price from profit', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 100,
      sellingPrice: 150,
      quantity: 1,
      taxType: 'turnover',
    });
    expect(result.turnoverTaxAmount).toBeCloseTo(150 * TURNOVER_TAX_RATE);
    expect(result.vatAmount).toBe(0);
    expect(result.profit).toBeCloseTo(150 - 100 - 150 * TURNOVER_TAX_RATE);
  });

  it('treats missing/non-numeric fields as zero instead of throwing or producing NaN', () => {
    const result = calculateLineItemTotals({
      buyingPrice: undefined,
      sellingPrice: 'not-a-number',
      quantity: null,
      taxType: 'none',
    });
    expect(result).toEqual({
      totalBuyingPrice: 0,
      totalSellingPrice: 0,
      vatAmount: 0,
      turnoverTaxAmount: 0,
      profit: 0,
    });
  });

  it('allows a loss (negative profit) when buying price exceeds selling price', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 200,
      sellingPrice: 150,
      quantity: 1,
      taxType: 'none',
    });
    expect(result.profit).toBe(-50);
  });

  // Service line items have no unit cost/vendor — buyingPrice defaults to 0
  // and quantity carries whatever the UI relabels it as (hours, sessions,
  // or a flat count). No special-casing needed here: a service's profit is
  // simply its full revenue minus taxes.
  it('gives 100% margin for a flat-fee service (buyingPrice 0, quantity 1)', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 0,
      sellingPrice: 1500,
      quantity: 1,
      taxType: 'none',
    });
    expect(result.totalSellingPrice).toBe(1500);
    expect(result.profit).toBe(1500);
  });

  it('multiplies an hourly service rate by hours (quantity) correctly, with VAT still applying', () => {
    const result = calculateLineItemTotals({
      buyingPrice: 0,
      sellingPrice: 500, // rate per hour
      quantity: 3, // hours worked
      taxType: 'vat',
    });
    expect(result.totalSellingPrice).toBe(1500);
    expect(result.vatAmount).toBeCloseTo(1500 * VAT_RATE);
    expect(result.profit).toBeCloseTo(1500 - 1500 * VAT_RATE);
  });
});

describe('calculateSaleTotals', () => {
  it('sums multiple line items and factors in delivery fee and delivery charge', () => {
    const products = [
      { buyingPrice: 100, sellingPrice: 150, quantity: 2, vatAmount: 0, turnoverTaxAmount: 0 },
      { buyingPrice: 50, sellingPrice: 80, quantity: 1, vatAmount: 12.8, turnoverTaxAmount: 0 },
    ];

    const result = calculateSaleTotals(products, /* deliveryFee */ 20, /* clientDeliveryCharge */ 30);

    expect(result.sellingPriceTotal).toBe(2 * 150 + 80);
    expect(result.buyingPriceTotal).toBe(2 * 100 + 50);
    expect(result.taxesTotal).toBeCloseTo(12.8);

    const expectedProfit =
      result.sellingPriceTotal + 30 - result.buyingPriceTotal - 20 - result.taxesTotal;
    expect(result.profit).toBeCloseTo(expectedProfit);
  });

  it('returns all-zero totals for an empty product list', () => {
    const result = calculateSaleTotals([], 0, 0);
    expect(result).toEqual({
      sellingPriceTotal: 0,
      buyingPriceTotal: 0,
      taxesTotal: 0,
      profit: 0,
    });
  });
});
