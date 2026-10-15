import { supabase } from '../../utils/supabase';
import { escapeHtml } from '../../components/documents/DocumentPreview';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';
import { buildReceiptPdf } from '../pdf/receiptPdf';
import { downloadBlob, pdfFilename, sharePdf } from '../pdf/pdfShare';
import { printHtml } from '../printing/printHtml';
import { getPrintPrefs, receiptPaperCss } from '../printing/printPrefs';
import { buildReceiptEscPos } from '../printing/escpos';
import { BluetoothPrintError, writeToBluetoothPrinter } from '../printing/bluetoothPrinter';

// Deliberately NOT a popup — the sale-receipt modal was removed on request
// because it forced itself in front of every single sale. This is the
// low-friction replacement: a couple of buttons on the success toast that
// only do anything if the user actually clicks them.

export interface ReceiptItem {
  productName: string;
  quantity: number;
  sellingPrice: number;
}

export interface ReceiptData {
  items: ReceiptItem[];
  total: number;
  customerName?: string;
  customerPhone?: string;
  date: string;
}

async function fetchBusinessInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('business_settings')
    .select('business_name, phone, email, logo_url')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
}

function receiptHTML(receipt: ReceiptData, business: { business_name: string | null; phone: string | null } | null): string {
  const rows = receipt.items
    .map(
      item => `
      <tr>
        <td>${escapeHtml(item.productName)}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.sellingPrice)}</td>
        <td class="right">${formatCurrency(item.sellingPrice * item.quantity)}</td>
      </tr>`
    )
    .join('');

  // Thermal printers use narrow rolls: size the page and content to the
  // paper chosen in Document Settings (per device).
  const paper = receiptPaperCss(getPrintPrefs().receiptPaper);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt</title>
      <style>
        ${paper.page}
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; font-size: ${paper.baseFont}; }
        .container { max-width: ${paper.containerWidth}; margin: 0 auto; padding: ${paper.page ? '6px' : '24px'}; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px dashed #ccc; padding-bottom: 12px; }
        .header h1 { font-size: 16px; margin-bottom: 4px; }
        .header p { font-size: 11px; color: #666; margin: 1px 0; }
        table { width: 100%; margin: 16px 0; font-size: 12px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
        td { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
        .right { text-align: right; }
        .total-row td { border-top: 2px solid #333; border-bottom: none; font-weight: 700; font-size: 14px; padding-top: 8px; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
        @media print { .container { padding: 8px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${escapeHtml(business?.business_name || 'Receipt')}</h1>
          ${business?.phone ? `<p>${escapeHtml(business.phone)}</p>` : ''}
          <p>${escapeHtml(formatDate(receipt.date))}</p>
          ${receipt.customerName ? `<p>Customer: ${escapeHtml(receipt.customerName)}</p>` : ''}
        </div>
        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row"><td colspan="3">TOTAL</td><td class="right">${formatCurrency(receipt.total)}</td></tr>
          </tbody>
        </table>
        <div class="footer">Thank you for your business!</div>
      </div>
    </body>
    </html>
  `;
}

export async function printReceipt(receipt: ReceiptData): Promise<void> {
  const business = await fetchBusinessInfo().catch(() => null);
  const prefs = getPrintPrefs();

  if (prefs.bluetooth) {
    try {
      await writeToBluetoothPrinter(
        buildReceiptEscPos({
          businessName: business?.business_name || 'Receipt',
          phone: business?.phone,
          date: formatDate(receipt.date),
          customerName: receipt.customerName,
          items: receipt.items.map(i => ({ name: i.productName, quantity: i.quantity, unitPrice: i.sellingPrice })),
          total: receipt.total,
          columns: prefs.receiptPaper === 'thermal80' ? 48 : 32,
          formatMoney: formatCurrency,
        })
      );
      toast.success('Sent to the Bluetooth printer');
      return;
    } catch (e) {
      // Fall back to the normal print window so the receipt is never lost.
      toast.error(e instanceof BluetoothPrintError ? e.message : 'Bluetooth printing failed');
    }
  }

  await printHtml(receiptHTML(receipt, business));
}

async function buildReceiptFile(receipt: ReceiptData) {
  const business = await fetchBusinessInfo().catch(() => null);
  const blob = await buildReceiptPdf({
    items: receipt.items,
    total: receipt.total,
    customerName: receipt.customerName,
    date: receipt.date,
    business,
  });
  return {
    blob,
    filename: pdfFilename(`Receipt_${receipt.customerName || 'sale'}_${receipt.date}`),
    business,
  };
}

/** Sends the receipt as a PDF document (WhatsApp via the share sheet on phones). */
export async function shareReceiptPdf(receipt: ReceiptData): Promise<void> {
  const loading = toast.loading('Preparing receipt...');
  try {
    const { blob, filename, business } = await buildReceiptFile(receipt);
    toast.dismiss(loading);
    await sharePdf({
      blob,
      filename,
      title: `Receipt from ${business?.business_name || 'your supplier'}`,
      text: `Receipt from ${business?.business_name || 'us'} - ${formatCurrency(receipt.total)}. Thank you for your business!`,
      phone: receipt.customerPhone,
    });
  } catch (error) {
    toast.dismiss(loading);
    console.error('Receipt PDF failed:', error);
    toast.error('Could not create the receipt PDF');
  }
}

export async function downloadReceiptPdf(receipt: ReceiptData): Promise<void> {
  const loading = toast.loading('Preparing receipt...');
  try {
    const { blob, filename } = await buildReceiptFile(receipt);
    toast.dismiss(loading);
    downloadBlob(blob, filename);
    toast.success('Receipt PDF downloaded');
  } catch (error) {
    toast.dismiss(loading);
    console.error('Receipt PDF failed:', error);
    toast.error('Could not create the receipt PDF');
  }
}
