import { getAccountCurrency } from '../../utils/accountCurrency';
import { formatCurrency, formatDate } from '../../utils/format';
import { loadImageForPdf } from './pdfImages';
import { pdfText } from './pdfText';
import { PDF_FONTS, documentColors, documentTitle, hexToRgb, resolveDocumentStyle, type Rgb } from '../../utils/documentTheme';

export interface DocumentPdfItem {
  product_name: string;
  description?: string | null;
  quantity: number | string;
  unit_price: number | string;
  discount_percent?: number | string | null;
  tax_percent?: number | string | null;
  total: number | string;
  /** Optional photo drawn beside the item name. */
  image_url?: string | null;
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
  signature_url?: string | null;
  stamp_url?: string | null;
  /** Owner's look-and-feel choices (see utils/documentTheme). */
  document_style?: unknown;
  default_template?: string | null;
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

export async function buildDocumentPdf(input: DocumentPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const { document: d, items, business } = input;
  const style = resolveDocumentStyle(business);
  const colors = documentColors(style);
  const accent = hexToRgb(colors.accent);
  const onAccent = hexToRgb(colors.onAccent);
  const accentText = hexToRgb(colors.accentText);
  const wash = hexToRgb(colors.wash);
  const rule = hexToRgb(colors.line);
  const font = PDF_FONTS[style.font];
  const band = style.headerStyle === 'band';
  const baseCurrency = getAccountCurrency();
  const money = (n: unknown) => pdfText((input.formatMoney ?? formatCurrency)(num(n)));
  const [logo, signature, stamp] = await Promise.all([
    style.showLogo ? loadImageForPdf(business?.logo_url) : null,
    style.showSignature ? loadImageForPdf(business?.signature_url) : null,
    style.showSignature ? loadImageForPdf(business?.stamp_url) : null,
  ]);

  const doc = new jsPDF({ unit: 'mm', format: style.paper });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 15;
  const setText = (color: Rgb | number) => (typeof color === 'number' ? doc.setTextColor(color) : doc.setTextColor(color[0], color[1], color[2]));

  // Header text colours: white/ink on a coloured band, otherwise dark text with an accent title.
  const headName: Rgb | number = band ? onAccent : 0;
  const headBody: Rgb | number = band ? onAccent : 90;
  const headTitle: Rgb | number = band ? onAccent : accentText;

  const addressLine = [business?.physical_address, business?.city, business?.country].filter(Boolean).join(', ');
  const businessLines = [
    addressLine,
    business?.postal_address && `P.O. Box ${business.postal_address}`,
    business?.phone && `Tel: ${business.phone}`,
    business?.email,
    business?.website,
    style.showTaxIds && business?.kra_pin && `KRA PIN: ${business.kra_pin}`,
    style.showTaxIds && business?.vat_number && `VAT No: ${business.vat_number}`,
  ].filter(Boolean) as string[];
  const metaLines = [
    d.date && `Date: ${formatDate(d.date)}`,
    d.due_date && d.document_type === 'invoice' && `Due: ${formatDate(d.due_date)}`,
    d.expiry_date && d.document_type === 'quotation' && `Valid until: ${formatDate(d.expiry_date)}`,
    d.status && `Status: ${d.status}`,
  ].filter(Boolean) as string[];

  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const ratio = Math.min(40 / logo.width, 20 / logo.height);
    logoW = logo.width * ratio;
    logoH = logo.height * ratio;
  }

  // The band is painted before the text on top of it, so the header is measured first.
  const leftHeight = (logo ? logoH + 3 : 0) + 9 + businessLines.length * 4.2;
  const rightHeight = 4 + 12 + 5 + metaLines.length * 4.2;
  const headerHeight = Math.max(leftHeight, rightHeight);
  if (band) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pageW, M + headerHeight + 3, 'F');
  }

  let y = M;

  // Header: logo + business on the left, document title block on the right.
  let leftY = y;
  if (logo) {
    if (band) {
      // Logos are drawn for white paper; give it a white tile on the colour.
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M - 1.5, leftY - 1.5, logoW + 3, logoH + 3, 1.5, 1.5, 'F');
    }
    doc.addImage(logo.dataUrl, logo.format, M, leftY, logoW, logoH);
    leftY += logoH + 3;
  }
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  setText(headName);
  doc.text(pdfText(business?.business_name || ''), M, leftY + 4);
  leftY += 9;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  setText(headBody);
  for (const line of businessLines) {
    doc.text(pdfText(line), M, leftY);
    leftY += 4.2;
  }

  let rightY = y + 4;
  setText(headTitle);
  doc.setFont(font, 'bold');
  doc.setFontSize(22);
  doc.text(pdfText(documentTitle(style, d.document_type).toUpperCase()), pageW - M, rightY + 4, { align: 'right' });
  rightY += 12;
  setText(band ? onAccent : 0);
  doc.setFontSize(10);
  doc.text(pdfText(d.document_number), pageW - M, rightY, { align: 'right' });
  rightY += 5;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  setText(headBody);
  for (const line of metaLines) {
    doc.text(pdfText(line), pageW - M, rightY, { align: 'right' });
    rightY += 4.2;
  }
  doc.setTextColor(0);

  y = band ? M + headerHeight + 3 + 8 : Math.max(leftY, rightY) + 6;

  // Bill to
  if (!band) {
    doc.setDrawColor(rule[0], rule[1], rule[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, pageW - M, y);
    y += 6;
  }
  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  setText(accentText);
  doc.text(d.document_type === 'quotation' ? 'PREPARED FOR' : 'BILL TO', M, y);
  doc.setTextColor(0);
  y += 5;
  doc.setFont(font, 'bold');
  doc.setFontSize(10.5);
  doc.text(pdfText(d.customer_name || ''), M, y);
  y += 4.5;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  for (const line of [d.customer_address, d.customer_phone, d.customer_email].filter(Boolean) as string[]) {
    doc.text(pdfText(line), M, y);
    y += 4.2;
  }
  doc.setTextColor(0);
  y += 4;

  // Item photos are optional; one that fails to load simply leaves its row text-only.
  const itemImages = await Promise.all(items.map(item => loadImageForPdf(item.image_url)));
  const IMAGE_BOX = 10;

  // Items. "solid" paints the head in the brand colour, "light" in a pale wash with an accent
  // rule, "lines" leaves the head bare and rules every row.
  const head =
    style.tableStyle === 'solid'
      ? { fillColor: accent, textColor: onAccent }
      : { fillColor: style.tableStyle === 'light' ? wash : ([255, 255, 255] as Rgb), textColor: accentText };
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
    styles: { font, fontSize: 9, cellPadding: 2.4, textColor: 30 },
    headStyles: { ...head, fontStyle: 'bold' },
    alternateRowStyles: style.tableStyle === 'lines' ? {} : { fillColor: [247, 249, 252] },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 0 && itemImages[data.row.index]) {
        data.cell.styles.cellPadding = { top: 2.4, right: 2.4, bottom: 2.4, left: IMAGE_BOX + 5 };
        data.cell.styles.minCellHeight = IMAGE_BOX + 4;
      }
    },
    didDrawCell: (data) => {
      const { x, y: cellY, width, height } = data.cell;
      if (data.section === 'head' && style.tableStyle !== 'solid') {
        doc.setDrawColor(accent[0], accent[1], accent[2]);
        doc.setLineWidth(0.6);
        doc.line(x, cellY + height, x + width, cellY + height);
      }
      if (data.section === 'body' && style.tableStyle === 'lines') {
        doc.setDrawColor(rule[0], rule[1], rule[2]);
        doc.setLineWidth(0.2);
        doc.line(x, cellY + height, x + width, cellY + height);
      }
      const image = data.section === 'body' && data.column.index === 0 ? itemImages[data.row.index] : null;
      if (!image) return;
      const scale = Math.min(IMAGE_BOX / image.width, IMAGE_BOX / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      doc.addImage(image.dataUrl, image.format, x + 2 + (IMAGE_BOX - w) / 2, cellY + 2 + (IMAGE_BOX - h) / 2, w, h);
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
    if (bold) {
      doc.setFillColor(wash[0], wash[1], wash[2]);
      doc.rect(labelX - 3, y - 4.8, pageW - M - labelX + 6, 7, 'F');
    }
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9.5);
    if (bold) setText(accentText);
    doc.text(label, labelX, y);
    doc.text(value, pageW - M, y, { align: 'right' });
    if (bold) doc.setTextColor(0);
    y += bold ? 7.5 : 5.5;
  }
  y += 4;

  const shownCurrency = (d.currency || baseCurrency).toUpperCase();
  if (shownCurrency !== baseCurrency) {
    ensureSpace(8);
    doc.setFont(font, 'italic');
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
    doc.setFont(font, 'bold');
    doc.setFontSize(8.5);
    setText(accentText);
    doc.text(title.toUpperCase(), M, y);
    y += 4.5;
    doc.setFont(font, 'normal');
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

  // Signature and stamp, when the business has uploaded them and left them switched on.
  if (signature || stamp) {
    const SIGN_BOX_W = 45;
    const SIGN_BOX_H = 16;
    const STAMP_BOX = 28;
    ensureSpace(STAMP_BOX + 8);
    y += 2;
    const top = y;
    if (signature) {
      const scale = Math.min(SIGN_BOX_W / signature.width, SIGN_BOX_H / signature.height);
      const w = signature.width * scale;
      const h = signature.height * scale;
      doc.addImage(signature.dataUrl, signature.format, M, top + SIGN_BOX_H - h, w, h);
      doc.setDrawColor(150);
      doc.setLineWidth(0.3);
      doc.line(M, top + SIGN_BOX_H + 1, M + 55, top + SIGN_BOX_H + 1);
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text('Authorised signature', M, top + SIGN_BOX_H + 5);
      doc.setTextColor(0);
    }
    if (stamp) {
      const scale = Math.min(STAMP_BOX / stamp.width, STAMP_BOX / stamp.height);
      const w = stamp.width * scale;
      const h = stamp.height * scale;
      doc.addImage(stamp.dataUrl, stamp.format, pageW - M - w, top, w, h);
    }
    y = top + STAMP_BOX + 4;
  }

  const footer =
    d.document_type === 'invoice'
      ? business?.invoice_footer
      : d.document_type === 'quotation'
        ? business?.quotation_footer
        : business?.receipt_footer;
  if (footer) {
    ensureSpace(10);
    doc.setFont(font, 'italic');
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
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 8, { align: 'right' });
    }
  }

  return doc.output('blob');
}
