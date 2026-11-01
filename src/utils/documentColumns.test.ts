import { describe, it, expect } from 'vitest';
import { lineColumns } from './documentColumns';

describe('lineColumns', () => {
  it('hides both columns when no line has a discount or tax', () => {
    expect(lineColumns([{ discount_percent: 0, tax_percent: 0 }, { discount_percent: null, tax_percent: '0' }, {}])).toEqual({ showDiscount: false, showTax: false });
  });

  it('shows only the column that is used', () => {
    expect(lineColumns([{ discount_percent: 0, tax_percent: 16 }, { discount_percent: 0, tax_percent: 0 }])).toEqual({ showDiscount: false, showTax: true });
    expect(lineColumns([{ discount_percent: '10', tax_percent: 0 }])).toEqual({ showDiscount: true, showTax: false });
  });

  it('one line is enough to show a column for all of them', () => {
    expect(lineColumns([{ tax_percent: 0 }, { tax_percent: 0 }, { tax_percent: 8 }]).showTax).toBe(true);
  });

  it('shows both when both are used, and copes with no lines or junk', () => {
    expect(lineColumns([{ discount_percent: 5, tax_percent: 16 }])).toEqual({ showDiscount: true, showTax: true });
    expect(lineColumns([])).toEqual({ showDiscount: false, showTax: false });
    expect(lineColumns([{ discount_percent: 'abc', tax_percent: undefined }])).toEqual({ showDiscount: false, showTax: false });
  });
});

describe('lineColumns with money discounts', () => {
  it('shows the discount column when a line has a money discount', () => {
    expect(lineColumns([{ discount_mode: 'amount', discount_amount: 150, discount_percent: 0 }]).showDiscount).toBe(true);
  });

  it('ignores a leftover percentage while the line is in money mode, and the reverse', () => {
    expect(lineColumns([{ discount_mode: 'amount', discount_amount: 0, discount_percent: 10 }]).showDiscount).toBe(false);
    expect(lineColumns([{ discount_mode: 'percent', discount_amount: 99, discount_percent: 0 }]).showDiscount).toBe(false);
  });
});
