import { getAccountCurrency } from '../../utils/accountCurrency';
import { formatCurrency, formatDate } from '../../utils/format';
import { loadImageForPdf } from './pdfImages';
import { pdfText } from './pdfText';

export interface DocumentPdfItem {
  product_name: string;
  description?: string | null;
  quantity: number | string;
  unit_price: number | string;
  discount_percent?: number | string | null;
  tax_percent?: number | string | null;
  total: number | string;
}

export interface DocumentPdfDocument {
  document_type: 'quotation' | 'invoice' | 'receipt';
  document_number: string;
  status?: string | null;
  date?: string | null;
  due_date?: string | null;
  expiry_date?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  subtotal: number | string;
  tax_amount?: number | string | null;
  delivery_charge?: number | string | null;
  discount_amount?: number | string | null;
  total: number | string;
  amount_paid?: number | string | null;
  balance_due?: number | string | null;
  payment_method?: string | null;
  notes?: string | null;
  terms?: string | null;
  currency?: string | null;
  exchange_rate?: number | string | null;
}

export interface DocumentPdfBusiness {
  business_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  postal_address?: string | null;
  physical_address?: string | null;
  city?: string | null;
  country?: string | null;
  kra_pin?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
  payment_instructions?: string | null;
  bank_details?: string | null;
  invoice_footer?: string | null;
  quotation_footer?: string | null;
  receipt_footer?: string | null;
}

export interface DocumentPdfInput {
  document: DocumentPdfDocument;
  items: DocumentPdfItem[];
  business: DocumentPdfBusiness | null;
  /** Defaults to account-currency formatting. */
  formatMoney?: (amount: number) => string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const TITLES: Record<DocumentPdfDocument['document_type'], string> = {
  quotation: 'QUOTATION',
  invoice: 'INVOICE',
  receipt: 'RECEIPT',
};

export async function buildDocumentPdf(input: DocumentPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const { document: d, items, business } = input;
  const baseCurrency = getAccountCurrency();
  const money = (n: unknown) => pdfText((input.formatMoney ?? formatCurrency)(num(n)));
  const logo = await loadImageForPdf(business?.logo_url);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 15;
  const accent: [number, number, number] = [37, 99, 235];

  let y = M;

  // Header: logo + business on the left, document title block on the right.
  let leftY = y;
  if (logo) {
    const ratio = Math.min(40 / logo.width, 20 / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    doc.addImage(logo.dataUrl, logo.format, M, leftY, w, h);
    leftY += h + 3;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(pdfText(business?.business_name || ''), M, leftY + 4);
  leftY += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const addressLine = [business?.physical_address, business?.city, business?.country].filter(Boolean).join(', ');
  const businessLines = [
    addressLine,
    business?.postal_address && `P.O. Box ${business.postal_address}`,
    business?.phone && `Tel: ${business.phone}`,
    business?.email,
    business?.website,
    business?.kra_pin && `KRA PIN: ${business.kra_pin}`,
    business?.vat_number && `VAT No: ${business.vat_number}`,
  ].filter(Boolean) as string[];
  for (const line of businessLines) {
    doc.text(pdfText(line), M, leftY);
    leftY += 4.2;
  }

  let rightY = y + 4;
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(TITLES[d.document_type], pageW - M, rightY + 4, { align: 'right' });
  rightY += 12;
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(pdfText(d.document_number), pageW - M, rightY, { align: 'right' });
  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const metaLines = [
    d.date && `Date: ${formatDate(d.date)}`,
    d.due_date && d.document_type === 'invoice' && `Due: ${formatDate(d.due_date)}`,
    d.expiry_date && d.document_type === 'quotation' && `Valid until: ${formatDate(d.expiry_date)}`,
    d.status && `Status: ${d.status}`,
  ].filter(Boolean) as string[];
  for (const line of metaLines) {
    doc.text(pdfText(line), pageW - M, rightY, { align: 'right' });
    rightY += 4.2;
  }
  doc.setTextColor(0);

  y = Math.max(leftY, rightY) + 6;

  // Bill to
  doc.setDrawColor(220);
  doc.line(M, y, pageW - M, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(d.document_type === 'quotation' ? 'PREPARED FOR' : 'BILL TO', M, y);
  doc.setTextColor(0);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(pdfText(d.customer_name || ''), M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  for (const line of [d.customer_address, d.customer_phone, d.customer_email].filter(Boolean) as string[]) {
    doc.text(pdfText(line), M, y);
    y += 4.2;
  }
  doc.setTextColor(0);
  y += 4;

  // Items
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [['Item', 'Qty', 'Unit price', 'Disc %', 'Tax %', 'Total']],
    body: items.map((item) => [
      pdfText(item.description ? `${item.product_name}\n${item.description}` : item.product_name),
      String(num(item.quantity)),
      money(item.unit_price),
      num(item.discount_percent) ? `${num(item.discount_percent)}%` : '-',
      num(item.tax_percent) ? `${num(item.tax_percent)}%` : '-',
      money(item.total),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: 30 },
    headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
    },
    columnStyles: {
      1: { halign: 'right', cellWidth: 16 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 30 },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = M;
    }
  };

  // Totals
  const totals: Array<[string, string, boolean?]> = [['Subtotal', money(d.subtotal)]];
  if (num(d.discount_amount) > 0) totals.push(['Discount', `-${money(d.discount_amount)}`]);
  if (num(d.delivery_charge) > 0) totals.push(['Delivery', money(d.delivery_charge)]);
  if (num(d.tax_amount) > 0) totals.push(['Tax', money(d.tax_amount)]);
  totals.push(['TOTAL', money(d.total), true]);
  if (d.document_type === 'invoice') {
    totals.push(['Amount paid', money(d.amount_paid)]);
    totals.push(['Balance due', money(d.balance_due), true]);
  }
  ensureSpace(totals.length * 6 + 4);
  const labelX = pageW - M - 70;
  for (const [label, value, bold] of totals) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9.5);
    doc.text(label, labelX, y);
    doc.text(value, pageW - M, y, { align: 'right' });
    y += bold ? 6.5 : 5.5;
  }
  y += 4;

  const shownCurrency = (d.currency || baseCurrency).toUpperCase();
  if (shownCurrency !== baseCurrency) {
    ensureSpace(8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(pdfText(`Amounts shown in ${shownCurrency} at 1 ${shownCurrency} = ${num(d.exchange_rate)} ${baseCurrency}.`), pageW - M, y - 1, { align: 'right' });
    doc.setTextColor(0);
    y += 5;
  }

  // Payment info, notes, terms
  const block = (title: string, text: string | null | undefined) => {
    if (!text || !String(text).trim()) return;
    const lines = doc.splitTextToSize(pdfText(text), pageW - M * 2) as string[];
    ensureSpace(lines.length * 4.2 + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(title.toUpperCase(), M, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(lines, M, y);
    y += lines.length * 4.2 + 4;
    doc.setTextColor(0);
  };
  if (d.document_type !== 'quotation') {
    block('Payment instructions', business?.payment_instructions);
    block('Bank details', business?.bank_details);
  }
  if (d.payment_method && d.document_type === 'receipt') block('Payment method', d.payment_method);
  block('Notes', d.notes);
  block('Terms & conditions', d.terms);

  const footer =
    d.document_type === 'invoice'
      ? business?.invoice_footer
      : d.document_type === 'quotation'
        ? business?.quotation_footer
        : business?.receipt_footer;
  if (footer) {
    ensureSpace(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(pdfText(footer), pageW / 2, y + 2, { align: 'center', maxWidth: pageW - M * 2 });
    doc.setTextColor(0);
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 8, { align: 'right' });
    }
  }

  return doc.output('blob');
}
