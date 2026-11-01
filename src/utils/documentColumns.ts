// A document only shows the Discount and Tax columns when at least one line actually has one.
// An invoice where nothing is discounted or taxed would otherwise carry two columns of "0%".

interface LineLike {
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  discount_mode?: string | null;
  tax_percent?: number | string | null;
}

const nonZero = (value: unknown): boolean => {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0;
};

export interface LineColumns {
  showDiscount: boolean;
  showTax: boolean;
}

export function lineColumns(items: LineLike[]): LineColumns {
  return {
    showDiscount: items.some(item => (item.discount_mode === 'amount' ? nonZero(item.discount_amount) : nonZero(item.discount_percent))),
    showTax: items.some(item => nonZero(item.tax_percent)),
  };
}
