import { describe, it, expect } from 'vitest';
import { convertDiscount, describeDiscount, documentTotals, extraDiscountFrom, lineAmounts, round2, totalsDifference } from './documentTotals';

describe('lineAmounts', () => {
  it('takes the line discount off before working out tax', () => {
    // 4 x 25,000 = 100,000; 10% off = 90,000; 16% tax on 90,000 = 14,400
    expect(lineAmounts({ quantity: 4, unit_price: 25000, discount_percent: 10, tax_percent: 16 })).toEqual({
      gross: 100000,
      discount: 10000,
      net: 90000,
      tax: 14400,
      total: 104400,
    });
  });

  it('is plain quantity x price when there is no discount or tax', () => {
    expect(lineAmounts({ quantity: 3, unit_price: 1500 })).toMatchObject({ gross: 4500, discount: 0, tax: 0, total: 4500 });
  });

  it('rounds to the cent', () => {
    const l = lineAmounts({ quantity: 3, unit_price: 33.33, discount_percent: 7.5, tax_percent: 16 });
    for (const v of Object.values(l)) expect(round2(v)).toBe(v);
  });

  it('copes with blanks, text and out-of-range percentages', () => {
    expect(lineAmounts({ quantity: '', unit_price: 'abc' }).total).toBe(0);
    expect(lineAmounts({ quantity: 1, unit_price: 100, discount_percent: 150 })).toMatchObject({ discount: 100, total: 0 });
    expect(lineAmounts({ quantity: 1, unit_price: 100, discount_percent: -5, tax_percent: -10 })).toMatchObject({ discount: 0, tax: 0, total: 100 });
    expect(lineAmounts({ quantity: -2, unit_price: 100 }).gross).toBe(0);
  });
});

describe('documentTotals', () => {
  const items = [
    { quantity: 4, unit_price: 25000, discount_percent: 10, tax_percent: 16 },
    { quantity: 1, unit_price: 50000, discount_percent: 0, tax_percent: 16 },
    { quantity: 2, unit_price: 3000, discount_percent: 5, tax_percent: 0 },
  ];

  it('total = subtotal - discount + tax + delivery, exactly', () => {
    const t = documentTotals(items, { extraDiscount: 2000, delivery: 1500 });
    expect(t.subtotal).toBe(156000);
    expect(t.lineDiscounts).toBe(10300);
    expect(t.discount).toBe(12300);
    expect(t.tax).toBe(22400);
    expect(t.total).toBe(round2(t.subtotal - t.discount + t.tax + t.delivery));
    expect(t.total).toBe(167600);
  });

  it('the document total equals the lines added up, plus delivery, minus the extra discount', () => {
    const t = documentTotals(items, { extraDiscount: 2000, delivery: 1500 });
    const sumOfLineTotals = round2(t.lines.reduce((s, l) => s + l.total, 0));
    expect(t.total).toBe(round2(sumOfLineTotals - 2000 + 1500));
  });

  it('a line discount lowers the total (the old form ignored it)', () => {
    const withDiscount = documentTotals([{ quantity: 1, unit_price: 1000, discount_percent: 10, tax_percent: 0 }]);
    const without = documentTotals([{ quantity: 1, unit_price: 1000, discount_percent: 0, tax_percent: 0 }]);
    expect(withDiscount.total).toBe(900);
    expect(without.total).toBe(1000);
  });

  it('survives many awkward lines without drifting by a cent', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ quantity: (i % 7) + 1, unit_price: 19.99 + i / 3, discount_percent: (i % 5) * 2.5, tax_percent: i % 2 ? 16 : 8 }));
    const t = documentTotals(many, { extraDiscount: 123.45, delivery: 99.99 });
    expect(t.total).toBe(round2(t.subtotal - t.discount + t.tax + t.delivery));
    expect(t.lines.reduce((s, l) => s + l.gross, 0)).toBeCloseTo(t.subtotal, 5);
  });

  it('limits an extra discount so the total cannot go below delivery + tax', () => {
    const t = documentTotals([{ quantity: 1, unit_price: 100 }], { extraDiscount: 500, delivery: 10 });
    expect(t.extraDiscount).toBe(100);
    expect(t.total).toBe(10);
  });

  it('an empty document is zero', () => {
    expect(documentTotals([]).total).toBe(0);
    expect(documentTotals([], { delivery: 50 }).total).toBe(50);
  });
});

describe('extraDiscountFrom', () => {
  const items = [{ quantity: 1, unit_price: 1000, discount_percent: 10 }];

  it('is what the stored discount holds beyond the lines\' own discounts', () => {
    expect(extraDiscountFrom(150, items)).toBe(50);
  });

  it('is zero when the stored figure is just the line discounts, or less', () => {
    expect(extraDiscountFrom(100, items)).toBe(0);
    expect(extraDiscountFrom(0, items)).toBe(0);
    expect(extraDiscountFrom(null, items)).toBe(0);
  });

  it('reopening and saving does not count a discount twice', () => {
    const first = documentTotals(items, { extraDiscount: 50 });
    const reopened = documentTotals(items, { extraDiscount: extraDiscountFrom(first.discount, items) });
    expect(reopened.total).toBe(first.total);
    expect(reopened.discount).toBe(first.discount);
  });
});

describe('totalsDifference', () => {
  const items = [{ quantity: 1, unit_price: 10000, discount_percent: 10, tax_percent: 16 }];

  it('is zero for a document saved correctly', () => {
    const t = documentTotals(items, { delivery: 200 });
    expect(totalsDifference({ total: t.total, discount_amount: t.discount, delivery_charge: 200 }, items).difference).toBe(0);
  });

  it('shows how far a document saved without its line discounts is out', () => {
    // old form: 10,000 - 0 + 200 + tax on the discounted 9,000 (1,440) = 11,640 instead of 10,640
    const result = totalsDifference({ total: 11640, discount_amount: 0, delivery_charge: 200 }, items);
    expect(result.expected).toBe(10640);
    expect(result.difference).toBe(1000);
  });
});

describe('discounts typed as a money figure', () => {
  const line = { quantity: 4, unit_price: 25000, discount_mode: 'amount', discount_amount: 7500, tax_percent: 16 };

  it('takes exactly that figure off the line before tax', () => {
    // 100,000 - 7,500 = 92,500; 16% tax = 14,800
    expect(lineAmounts(line)).toEqual({ gross: 100000, discount: 7500, net: 92500, tax: 14800, total: 107300 });
  });

  it('ignores the percentage while a money discount is chosen, and the other way round', () => {
    expect(lineAmounts({ ...line, discount_percent: 50 }).discount).toBe(7500);
    expect(lineAmounts({ quantity: 1, unit_price: 1000, discount_mode: 'percent', discount_percent: 10, discount_amount: 999 }).discount).toBe(100);
    expect(lineAmounts({ quantity: 1, unit_price: 1000, discount_percent: 10, discount_amount: 999 }).discount).toBe(100);
  });

  it('never discounts more than the line is worth, or a negative amount', () => {
    expect(lineAmounts({ quantity: 1, unit_price: 100, discount_mode: 'amount', discount_amount: 500 })).toMatchObject({ discount: 100, total: 0 });
    expect(lineAmounts({ quantity: 1, unit_price: 100, discount_mode: 'amount', discount_amount: -20 }).discount).toBe(0);
  });

  it('keeps cents exactly as typed', () => {
    expect(lineAmounts({ quantity: 3, unit_price: 333.33, discount_mode: 'amount', discount_amount: 12.34 }).discount).toBe(12.34);
  });

  it('adds up with percent lines on the same document', () => {
    const t = documentTotals([line, { quantity: 1, unit_price: 50000, discount_percent: 10, tax_percent: 0 }], { extraDiscount: 500, delivery: 300 });
    expect(t.lineDiscounts).toBe(12500);
    expect(t.discount).toBe(13000);
    expect(t.total).toBe(round2(t.subtotal - t.discount + t.tax + t.delivery));
  });

  it('a stored amount-mode discount is not mistaken for an extra discount when reopened', () => {
    const first = documentTotals([line], { extraDiscount: 0 });
    expect(extraDiscountFrom(first.discount, [line])).toBe(0);
  });
});

describe('convertDiscount / describeDiscount', () => {
  it('converts between % and money without changing the discount', () => {
    const asPercent = { quantity: 2, unit_price: 5000, discount_percent: 12.5 };
    expect(convertDiscount(asPercent, 'amount')).toBe(1250);
    const asAmount = { quantity: 2, unit_price: 5000, discount_mode: 'amount', discount_amount: 1250 };
    expect(convertDiscount(asAmount, 'percent')).toBe(12.5);
  });

  it('is zero for an empty line', () => {
    expect(convertDiscount({ quantity: 0, unit_price: 0, discount_mode: 'amount', discount_amount: 10 }, 'percent')).toBe(0);
  });

  it('reads as "10%" or as the money figure', () => {
    const money = (n: number) => `KES ${n.toFixed(2)}`;
    expect(describeDiscount({ quantity: 1, unit_price: 100, discount_percent: 10 }, money)).toBe('10%');
    expect(describeDiscount({ quantity: 1, unit_price: 1000, discount_mode: 'amount', discount_amount: 150 }, money)).toBe('KES 150.00');
  });
});
