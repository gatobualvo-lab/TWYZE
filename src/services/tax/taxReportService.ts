import { supabase } from '../../utils/supabase';
import { toNum } from '../../utils/number';
import { isWithin, type Period } from '../../utils/period';

// Three places tax already gets recorded, pulled into one report:
//  - sale_items: a POS sale, VAT (16%) or Turnover Tax (1.5%) per product line
//  - suppliers: a wholesale sale, the same two taxes, one row per sale
//  - documents: an invoice or receipt made in the Documents module, a tax amount the user typed
// Nothing new is computed here — this only totals up what each sale or document already carries.

export type TaxSource = 'sale' | 'wholesale' | 'invoice' | 'receipt';

export const SOURCE_LABEL: Record<TaxSource, string> = {
  sale: 'Sale',
  wholesale: 'Wholesale sale',
  invoice: 'Invoice',
  receipt: 'Receipt',
};

export interface TaxLine {
  id: string;
  date: string;
  source: TaxSource;
  /** The product name, or the document's number. */
  reference: string;
  customerName: string | null;
  /** What the tax was charged on. */
  taxableAmount: number;
  taxLabel: string;
  taxAmount: number;
}

export interface TaxTotals {
  vat: number;
  turnoverTax: number;
  documentTax: number;
  total: number;
}

export interface TaxReport {
  lines: TaxLine[];
  totals: TaxTotals;
}

const ROW_LIMIT = 20000;

interface SaleItemTaxRow {
  id: string;
  product_name: string | null;
  selling_price: number | null;
  vat_amount: number | null;
  turnover_tax_amount: number | null;
  sale:
    | { date: string | null; sale_date: string | null; client_name: string | null; is_deleted: boolean | null; is_archived: boolean | null }
    | { date: string | null; sale_date: string | null; client_name: string | null; is_deleted: boolean | null; is_archived: boolean | null }[]
    | null;
}

/** Splits a row that carries both taxes (a sale with several products taxed differently) into one line each. */
function splitTax(id: string, date: string, source: TaxSource, reference: string, customerName: string | null, taxable: number, vat: number, turnover: number): TaxLine[] {
  const lines: TaxLine[] = [];
  if (vat > 0) lines.push({ id: `${id}-vat`, date, source, reference, customerName, taxableAmount: taxable, taxLabel: 'VAT (16%)', taxAmount: vat });
  if (turnover > 0) lines.push({ id: `${id}-tot`, date, source, reference, customerName, taxableAmount: taxable, taxLabel: 'Turnover Tax (1.5%)', taxAmount: turnover });
  return lines;
}

async function fetchSaleTaxLines(period: Period): Promise<TaxLine[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('id, product_name, selling_price, vat_amount, turnover_tax_amount, sale:sales!sale_items_sale_id_fkey ( date, sale_date, client_name, is_deleted, is_archived )')
    .eq('is_deleted', false)
    .range(0, ROW_LIMIT - 1);
  if (error || !data) return [];

  const lines: TaxLine[] = [];
  for (const row of data as unknown as SaleItemTaxRow[]) {
    const sale = Array.isArray(row.sale) ? row.sale[0] : row.sale;
    if (!sale || sale.is_deleted || sale.is_archived) continue;
    const date = sale.date ?? sale.sale_date;
    if (!date || !isWithin(date, period)) continue;
    const vat = toNum(row.vat_amount);
    const turnover = toNum(row.turnover_tax_amount);
    if (vat <= 0 && turnover <= 0) continue;
    lines.push(...splitTax(row.id, date, 'sale', row.product_name ?? 'Sale', sale.client_name, toNum(row.selling_price), vat, turnover));
  }
  return lines;
}

interface WholesaleTaxRow {
  id: string;
  date: string | null;
  client: string | null;
  product: string | null;
  selling_price: number | null;
  vat_amount: number | null;
  turnover_tax_amount: number | null;
}

async function fetchWholesaleTaxLines(period: Period): Promise<TaxLine[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, date, client, product, selling_price, vat_amount, turnover_tax_amount')
    .eq('is_deleted', false)
    .range(0, ROW_LIMIT - 1);
  if (error || !data) return [];

  const lines: TaxLine[] = [];
  for (const row of data as unknown as WholesaleTaxRow[]) {
    if (!row.date || !isWithin(row.date, period)) continue;
    const vat = toNum(row.vat_amount);
    const turnover = toNum(row.turnover_tax_amount);
    if (vat <= 0 && turnover <= 0) continue;
    lines.push(...splitTax(row.id, row.date, 'wholesale', row.product ?? 'Wholesale sale', row.client, toNum(row.selling_price), vat, turnover));
  }
  return lines;
}

interface DocumentTaxRow {
  id: string;
  date: string | null;
  document_number: string;
  document_type: string;
  customer_name: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  status: string | null;
}

const EXCLUDED_STATUS = new Set(['draft', 'cancelled']);

async function fetchDocumentTaxLines(period: Period): Promise<TaxLine[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, date, document_number, document_type, customer_name, subtotal, tax_amount, status')
    .in('document_type', ['invoice', 'receipt'])
    .range(0, ROW_LIMIT - 1);
  if (error || !data) return [];

  const lines: TaxLine[] = [];
  for (const row of data as unknown as DocumentTaxRow[]) {
    if (EXCLUDED_STATUS.has((row.status ?? '').toLowerCase())) continue;
    const tax = toNum(row.tax_amount);
    if (tax <= 0 || !row.date || !isWithin(row.date, period)) continue;
    lines.push({
      id: row.id,
      date: row.date,
      source: row.document_type === 'receipt' ? 'receipt' : 'invoice',
      reference: row.document_number,
      customerName: row.customer_name,
      taxableAmount: toNum(row.subtotal),
      taxLabel: 'Tax (as recorded)',
      taxAmount: tax,
    });
  }
  return lines;
}

/** Every taxed sale and document in the period, and what it adds up to. Never throws — a source that fails to load is simply left out. */
export async function fetchTaxReport(period: Period): Promise<TaxReport> {
  const [saleLines, wholesaleLines, documentLines] = await Promise.all([
    fetchSaleTaxLines(period).catch(() => []),
    fetchWholesaleTaxLines(period).catch(() => []),
    fetchDocumentTaxLines(period).catch(() => []),
  ]);

  const lines = [...saleLines, ...wholesaleLines, ...documentLines].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const sumWhere = (match: (line: TaxLine) => boolean) => lines.filter(match).reduce((sum, line) => sum + line.taxAmount, 0);
  const vat = sumWhere(l => l.taxLabel === 'VAT (16%)');
  const turnoverTax = sumWhere(l => l.taxLabel === 'Turnover Tax (1.5%)');
  const documentTax = sumWhere(l => l.source === 'invoice' || l.source === 'receipt');

  return { lines, totals: { vat, turnoverTax, documentTax, total: vat + turnoverTax + documentTax } };
}
