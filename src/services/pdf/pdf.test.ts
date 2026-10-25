import { describe, it, expect } from 'vitest';
import { pdfText } from './pdfText';
import { pdfFilename } from './pdfShare';
import { buildReceiptPdf } from './receiptPdf';
import { buildDocumentPdf } from './documentPdf';

async function header(blob: Blob): Promise<string> {
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob.slice(0, 8));
  });
  return String.fromCharCode(...new Uint8Array(buf));
}

describe('pdfText', () => {
  it('replaces characters the built-in PDF fonts cannot draw', () => {
    expect(pdfText('KES 1,500')).toBe('KES 1,500');
    expect(pdfText('“quoted” – it’s')).toBe('"quoted" - it\'s');
    expect(pdfText('smile \u{1F600}')).not.toMatch(/[^\x00-\xFF]/);
    expect(pdfText(null)).toBe('');
  });
});

describe('pdfFilename', () => {
  it('makes a safe file name', () => {
    expect(pdfFilename('INV-000002')).toBe('INV-000002.pdf');
    expect(pdfFilename('Receipt_Irene N._2026/10/15')).toBe('Receipt_Irene_N._2026_10_15.pdf');
    expect(pdfFilename('')).toBe('document.pdf');
  });
});

describe('PDF generation', () => {
  it('builds a receipt PDF, including long item names', async () => {
    const blob = await buildReceiptPdf({
      items: [
        { productName: 'Office desk - American Walnut, large size with drawers and a very long description', quantity: 2, sellingPrice: 6500 },
        { productName: 'Chair', quantity: 5, sellingPrice: 1200 },
      ],
      total: 19000,
      customerName: 'Irene Nyambura',
      date: '2026-10-15',
      business: { business_name: 'Furniture Homeland', phone: '0712345678', email: null, logo_url: null },
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
    expect(await header(blob)).toMatch(/^%PDF-/);
  });

  it('keeps the receipt 80mm wide however short it is', async () => {
    const pageSize = async (itemCount: number) => {
      const blob = await buildReceiptPdf({
        items: Array.from({ length: itemCount }, (_, i) => ({ productName: `Item ${i + 1}`, quantity: 1, sellingPrice: 100 })),
        total: 100 * itemCount,
        date: '2026-10-15',
        business: { business_name: 'Furniture Homeland', phone: null, email: null, logo_url: null },
      });
      const text = await blob.text();
      const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
      expect(box).not.toBeNull();
      return { width: Number(box![1]) / 2.83465, height: Number(box![2]) / 2.83465 };
    };

    // One item makes a receipt shorter than it is wide: the case that used to
    // be swapped into a 60mm-wide page with the right-hand side cut off.
    const short = await pageSize(1);
    expect(short.width).toBeCloseTo(80, 0);
    expect(short.height).toBeGreaterThan(59);

    const long = await pageSize(30);
    expect(long.width).toBeCloseTo(80, 0);
    expect(long.height).toBeGreaterThan(80);
  });

  it('builds an invoice PDF in a foreign currency', async () => {
    const blob = await buildDocumentPdf({
      document: {
        document_type: 'invoice',
        document_number: 'INV-000002',
        status: 'sent',
        date: '2026-10-15',
        due_date: '2026-10-30',
        customer_name: 'Irene Nyambura',
        subtotal: 12950,
        total: 12950,
        amount_paid: 0,
        balance_due: 12950,
        notes: 'Thank you',
        currency: 'USD',
        exchange_rate: 129.5,
      },
      items: [{ product_name: 'Desk', description: 'Grey', quantity: 1, unit_price: 12950, total: 12950 }],
      business: { business_name: 'Furniture Homeland' },
      formatMoney: (n) => `USD ${(n / 129.5).toFixed(2)}`,
    });
    expect(blob.size).toBeGreaterThan(1000);
    expect(await header(blob)).toMatch(/^%PDF-/);
  });

  it('still builds when an item photo cannot be loaded', async () => {
    const blob = await buildDocumentPdf({
      document: { document_type: 'quotation', document_number: 'QUO-2', subtotal: 100, total: 100 },
      items: [{ product_name: 'Desk', quantity: 1, unit_price: 100, total: 100, image_url: 'https://example.invalid/missing.png' }],
      business: null,
    });
    expect(await header(blob)).toMatch(/^%PDF-/);
  });

  it('paginates a document with many line items', async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({
      product_name: `Item ${i + 1}`,
      quantity: 1,
      unit_price: 100,
      total: 100,
    }));
    const blob = await buildDocumentPdf({
      document: { document_type: 'quotation', document_number: 'QUO-1', subtotal: 8000, total: 8000 },
      items,
      business: null,
    });
    expect(blob.size).toBeGreaterThan(5000);
  });
});
