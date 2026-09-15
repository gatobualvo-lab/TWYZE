import { supabase } from '../../utils/supabase';
import { escapeHtml } from '../../components/documents/DocumentPreview';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

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
  date: string;
}

async function fetchBusinessInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('business_settings')
    .select('business_name, phone, email')
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; }
        .container { max-width: 380px; margin: 0 auto; padding: 24px; }
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
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    toast.error('Could not open print window. Check your popup blocker.');
    return;
  }
  const business = await fetchBusinessInfo();
  printWindow.document.write(receiptHTML(receipt, business));
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
}

export async function shareReceiptWhatsApp(receipt: ReceiptData): Promise<void> {
  const business = await fetchBusinessInfo();
  const lines = receipt.items.map(item => `${item.productName} x${item.quantity} = ${formatCurrency(item.sellingPrice * item.quantity)}`).join('\n');
  const message = `
*${business?.business_name || 'Receipt'}*
${formatDate(receipt.date)}
${receipt.customerName ? `Customer: ${receipt.customerName}\n` : ''}
${lines}

*TOTAL: ${formatCurrency(receipt.total)}*

Thank you for your business!
  `.trim();

  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  toast.success('Opening WhatsApp — pick who to send the receipt to');
}
