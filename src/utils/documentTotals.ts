// The one place that works out an invoice / quotation / receipt's money, so the lines, the
// summary, the saved record, the print view and the PDF can never disagree.
//
//   Subtotal  = quantity x price, added up (before any discount)
//   Discount  = every line's discount % + any extra discount typed on the document
//   Tax       = each line's tax % on what is left of that line after its own discount
//   Total     = Subtotal - Discount + Tax + Delivery
//
// Every line is rounded to the cent first and the document is the sum of those rounded lines,
// so what is printed always adds up exactly.

export type DiscountMode = 'percent' | 'amount';

export interface TotalsLine {
  quantity?: number | string | null;
  unit_price?: number | string | null;
  /** The discount as a percentage (used when discount_mode is 'percent', the default). */
  discount_percent?: number | string | null;
  /** The discount as a money figure for this whole line (used when discount_mode is 'amount'). */
  discount_amount?: number | string | null;
  discount_mode?: DiscountMode | string | null;
  tax_percent?: number | string | null;
}

export interface LineAmounts {
  /** quantity x unit price */
  gross: number;
  /** this line's own discount */
  discount: number;
  /** gross minus discount */
  net: number;
  tax: number;
  /** net plus tax: the figure shown in the line's Total column */
  total: number;
}

export interface DocumentTotals {
  lines: LineAmounts[];
  /** Before any discount. */
  subtotal: number;
  /** Discounts given on individual lines. */
  lineDiscounts: number;
  /** The extra discount typed on the document (limited so the total never goes negative). */
  extraDiscount: number;
  /** lineDiscounts + extraDiscount: what is stored as the document's discount. */
  discount: number;
  tax: number;
  delivery: number;
  total: number;
}

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const percent = (value: unknown): number => Math.min(100, Math.max(0, num(value)));

export function lineAmounts(line: TotalsLine): LineAmounts {
  const gross = round2(Math.max(0, num(line.quantity)) * Math.max(0, num(line.unit_price)));
  // A typed money discount is taken as keyed (never more than the line is worth); a percentage is worked out.
  const discount =
    line.discount_mode === 'amount'
      ? round2(Math.min(gross, Math.max(0, num(line.discount_amount))))
      : round2(gross * (percent(line.discount_percent) / 100));
  const net = round2(gross - discount);
  const tax = round2(net * (percent(line.tax_percent) / 100));
  return { gross, discount, net, tax, total: round2(net + tax) };
}

export function documentTotals(
  items: TotalsLine[],
  options: { extraDiscount?: number | string | null; delivery?: number | string | null } = {}
): DocumentTotals {
  const lines = items.map(lineAmounts);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.gross, 0));
  const lineDiscounts = round2(lines.reduce((sum, l) => sum + l.discount, 0));
  const net = round2(subtotal - lineDiscounts);
  const tax = round2(lines.reduce((sum, l) => sum + l.tax, 0));
  const delivery = round2(Math.max(0, num(options.delivery)));
  // An extra discount cannot take more than what the customer would otherwise pay for the goods.
  const extraDiscount = round2(Math.min(Math.max(0, num(options.extraDiscount)), net));
  const discount = round2(lineDiscounts + extraDiscount);
  return {
    lines,
    subtotal,
    lineDiscounts,
    extraDiscount,
    discount,
    tax,
    delivery,
    total: round2(subtotal - discount + tax + delivery),
  };
}

/**
 * Documents store one discount figure (line discounts and any extra together). When one is
 * opened for editing, the extra discount is whatever the stored figure holds beyond the lines'
 * own discounts, so reopening and saving never counts a discount twice.
 */
export function extraDiscountFrom(storedDiscount: number | string | null | undefined, items: TotalsLine[]): number {
  const lineDiscounts = items.reduce((sum, item) => sum + lineAmounts(item).discount, 0);
  return round2(Math.max(0, num(storedDiscount) - lineDiscounts));
}

export interface StoredTotals {
  total?: number | string | null;
  discount_amount?: number | string | null;
  delivery_charge?: number | string | null;
}

/**
 * Compares the total saved on a document with what its lines add up to. Documents saved before
 * line discounts were counted can differ; the difference is reported so it can be shown.
 */
export function totalsDifference(stored: StoredTotals, items: TotalsLine[]): { expected: number; difference: number } {
  const expected = documentTotals(items, {
    extraDiscount: extraDiscountFrom(stored.discount_amount, items),
    delivery: stored.delivery_charge,
  }).total;
  return { expected, difference: round2(num(stored.total) - expected) };
}

/** Switching a line between % and money keeps the same discount, expressed in the other unit. */
export function convertDiscount(line: TotalsLine, to: DiscountMode): number {
  const { gross, discount } = lineAmounts(line);
  if (to === 'amount') return discount;
  return gross > 0 ? round2((discount / gross) * 100) : 0;
}

/** How a line's discount reads on a document: "10%" or the money figure. */
export function describeDiscount(line: TotalsLine, formatMoney: (amount: number) => string): string {
  if (line.discount_mode === 'amount') return formatMoney(lineAmounts(line).discount);
  return `${percent(line.discount_percent)}%`;
}
