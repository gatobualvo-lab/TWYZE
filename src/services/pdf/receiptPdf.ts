import { formatCurrency, formatDate } from '../../utils/format';
import { loadImageForPdf } from './pdfImages';
import { pdfText } from './pdfText';

export interface ReceiptPdfItem {
  productName: string;
  quantity: number;
  sellingPrice: number;
}

export interface ReceiptPdfInput {
  items: ReceiptPdfItem[];
  total: number;
  customerName?: string;
  date: string;
  business: {
    business_name?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
  } | null;
  /** Defaults to account-currency formatting. */
  formatMoney?: (amount: number) => string;
}

const PAGE_WIDTH = 80;
const MARGIN = 5;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Doc = import('jspdf').jsPDF;
type Logo = Awaited<ReturnType<typeof loadImageForPdf>>;

function draw(doc: Doc, input: ReceiptPdfInput, logo: Logo): number {
  const money = (n: number) => pdfText((input.formatMoney ?? formatCurrency)(n));
  const center = PAGE_WIDTH / 2;
  let y = MARGIN + 2;

  if (logo) {
    const maxW = 30;
    const maxH = 16;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    doc.addImage(logo.dataUrl, logo.format, center - w / 2, y, w, h);
    y += h + 3;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  for (const line of doc.splitTextToSize(pdfText(input.business?.business_name || 'Receipt'), CONTENT_WIDTH)) {
    doc.text(line, center, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  const meta = [input.business?.phone, input.business?.email, formatDate(input.date), input.customerName && `Customer: ${input.customerName}`]
    .filter(Boolean) as string[];
  for (const m of meta) {
    doc.text(pdfText(m), center, y, { align: 'center' });
    y += 3.8;
  }
  doc.setTextColor(0);

  y += 1;
  doc.setDrawColor(160);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM', MARGIN, y);
  doc.text('AMOUNT', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const item of input.items) {
    const nameLines = doc.splitTextToSize(pdfText(item.productName), CONTENT_WIDTH - 24) as string[];
    doc.text(nameLines, MARGIN, y);
    doc.text(money(item.sellingPrice * item.quantity), PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += nameLines.length * 4;
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(`${item.quantity} x ${money(item.sellingPrice)}`, MARGIN, y);
    doc.setTextColor(0);
    doc.setFontSize(9);
    y += 5;
  }

  doc.setDrawColor(0);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', MARGIN, y);
  doc.text(money(input.total), PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your business!', center, y, { align: 'center' });
  doc.setTextColor(0);
  y += 4;

  return y + MARGIN;
}

/** Builds a thermal-receipt-width PDF whose height fits its content. */
export async function buildReceiptPdf(input: ReceiptPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const logo = await loadImageForPdf(input.business?.logo_url);

  // Pass 1 measures the content height on a scratch page; pass 2 draws it on
  // a page of exactly that height.
  const scratch = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, 2000] });
  const height = Math.max(draw(scratch, input, logo), 60);

  // jsPDF swaps width and height of a "portrait" page whose width is larger
  // than its height. A short receipt (one or two items is under 80mm tall)
  // would silently become 60mm wide and have its right-hand side cut off, so
  // such a page must be declared landscape to keep the 80mm width.
  const doc = new jsPDF({
    unit: 'mm',
    orientation: height < PAGE_WIDTH ? 'landscape' : 'portrait',
    format: [PAGE_WIDTH, height],
  });
  draw(doc, input, logo);
  return doc.output('blob');
}
