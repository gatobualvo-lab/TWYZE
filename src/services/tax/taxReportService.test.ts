import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTaxReport, SOURCE_LABEL } from './taxReportService';
import { periodFor } from '../../utils/period';

const mocks = vi.hoisted(() => ({ sale_items: vi.fn(), suppliers: vi.fn(), documents: vi.fn() }));

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'sale_items') {
        return { select: () => ({ eq: () => ({ range: mocks.sale_items }) }) };
      }
      if (table === 'suppliers') {
        return { select: () => ({ eq: () => ({ range: mocks.suppliers }) }) };
      }
      return { select: () => ({ in: () => ({ range: mocks.documents }) }) };
    },
  },
}));

const MONTH = periodFor('month', new Date('2026-11-15'));
const inMonth = '2026-11-10';
const outsideMonth = '2026-09-01';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sale_items.mockResolvedValue({ data: [], error: null });
  mocks.suppliers.mockResolvedValue({ data: [], error: null });
  mocks.documents.mockResolvedValue({ data: [], error: null });
});

describe('fetchTaxReport', () => {
  it('splits a sale that carries both VAT and Turnover Tax into two lines, and totals them separately', async () => {
    mocks.sale_items.mockResolvedValue({
      data: [{
        id: 's1', product_name: 'Sugar 2kg', selling_price: 1000, vat_amount: 160, turnover_tax_amount: 15,
        sale: { date: inMonth, sale_date: null, client_name: 'Jane', is_deleted: false, is_archived: false },
      }],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines).toHaveLength(2);
    expect(report.totals).toEqual({ vat: 160, turnoverTax: 15, documentTax: 0, total: 175 });
    expect(report.lines.find(l => l.taxLabel.startsWith('VAT'))).toMatchObject({ source: 'sale', reference: 'Sugar 2kg', customerName: 'Jane', taxableAmount: 1000 });
  });

  it('skips a deleted or archived sale, and one outside the period', async () => {
    mocks.sale_items.mockResolvedValue({
      data: [
        { id: 'a', product_name: 'X', selling_price: 100, vat_amount: 16, turnover_tax_amount: 0, sale: { date: inMonth, sale_date: null, client_name: null, is_deleted: true, is_archived: false } },
        { id: 'b', product_name: 'Y', selling_price: 100, vat_amount: 16, turnover_tax_amount: 0, sale: { date: inMonth, sale_date: null, client_name: null, is_deleted: false, is_archived: true } },
        { id: 'c', product_name: 'Z', selling_price: 100, vat_amount: 16, turnover_tax_amount: 0, sale: { date: outsideMonth, sale_date: null, client_name: null, is_deleted: false, is_archived: false } },
        { id: 'd', product_name: 'None', selling_price: 100, vat_amount: 0, turnover_tax_amount: 0, sale: { date: inMonth, sale_date: null, client_name: null, is_deleted: false, is_archived: false } },
      ],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines).toHaveLength(0);
  });

  it('includes wholesale sales under their own source label', async () => {
    mocks.suppliers.mockResolvedValue({
      data: [{ id: 'w1', date: inMonth, client: 'Acme Ltd', product: 'Cement', selling_price: 5000, vat_amount: 800, turnover_tax_amount: 0 }],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines).toEqual([
      expect.objectContaining({ source: 'wholesale', reference: 'Cement', customerName: 'Acme Ltd', taxAmount: 800, taxLabel: 'VAT (16%)' }),
    ]);
    expect(SOURCE_LABEL.wholesale).toBe('Wholesale sale');
  });

  it('includes invoice and receipt tax, but leaves out quotations, drafts and cancelled documents', async () => {
    mocks.documents.mockResolvedValue({
      data: [
        { id: 'inv1', date: inMonth, document_number: 'INV-001', document_type: 'invoice', customer_name: 'Mary', subtotal: 2000, tax_amount: 320, status: 'Paid' },
        { id: 'rcp1', date: inMonth, document_number: 'RCP-002', document_type: 'receipt', customer_name: 'Peter', subtotal: 1000, tax_amount: 160, status: 'pending' },
        { id: 'draft1', date: inMonth, document_number: 'INV-003', document_type: 'invoice', customer_name: 'Ann', subtotal: 500, tax_amount: 80, status: 'Draft' },
        { id: 'cancelled1', date: inMonth, document_number: 'INV-004', document_type: 'invoice', customer_name: 'Tom', subtotal: 500, tax_amount: 80, status: 'Cancelled' },
      ],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines.map(l => l.reference).sort()).toEqual(['INV-001', 'RCP-002']);
    expect(report.totals.documentTax).toBe(480);
    expect(report.totals.total).toBe(480);
  });

  it('fails soft: a broken source is left out rather than failing the whole report', async () => {
    mocks.sale_items.mockRejectedValue(new Error('down'));
    mocks.suppliers.mockResolvedValue({
      data: [{ id: 'w1', date: inMonth, client: null, product: 'Cement', selling_price: 5000, vat_amount: 800, turnover_tax_amount: 0 }],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines).toHaveLength(1);
    expect(report.totals.vat).toBe(800);
  });

  it('sorts newest first', async () => {
    mocks.suppliers.mockResolvedValue({
      data: [
        { id: 'early', date: '2026-11-01', client: null, product: 'A', selling_price: 100, vat_amount: 16, turnover_tax_amount: 0 },
        { id: 'late', date: '2026-11-20', client: null, product: 'B', selling_price: 100, vat_amount: 16, turnover_tax_amount: 0 },
      ],
      error: null,
    });
    const report = await fetchTaxReport(MONTH);
    expect(report.lines.map(l => l.reference)).toEqual(['B', 'A']);
  });
});
