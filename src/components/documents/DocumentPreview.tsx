import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { Printer, Share2, Download, X, CreditCard as Edit2, CheckCircle, Clock, FileText } from 'lucide-react';

interface DocumentItem {
  id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  total: number;
  sort_order: number;
}

interface Document {
  id: string;
  user_id: string;
  document_type: 'quotation' | 'invoice' | 'receipt';
  document_number: string;
  status: string;
  date: string;
  due_date?: string;
  expiry_date?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  subtotal: number;
  tax_amount: number;
  delivery_charge: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_method?: string;
  notes?: string;
  terms?: string;
  template: string;
  related_document_id?: string;
}

interface BusinessSettings {
  business_name: string;
  phone: string;
  email: string;
  website?: string;
  postal_address: string;
  physical_address: string;
  city: string;
  country: string;
  kra_pin?: string;
  vat_number?: string;
  logo_url?: string;
  payment_instructions?: string;
  bank_details?: string;
  invoice_footer?: string;
  quotation_footer?: string;
  receipt_footer?: string;
  signature_url?: string;
  stamp_url?: string;
}

interface DocumentPreviewProps {
  documentId: string;
  onClose: () => void;
  onEdit: () => void;
}

const safeNum = (v: any) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const formatCurrency = (amount: number) => 'KES ' + amount.toLocaleString();

// generatePrintHTML() below builds a full HTML document from user-entered
// business/customer/document fields and injects it via document.write() in a
// new window. Every dynamic string must go through this before interpolation,
// otherwise a customer name or note containing markup executes in that window.
export const escapeHtml = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  documentId,
  onClose,
  onEdit,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [document, setDocument] = useState<Document | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchData();
  }, [documentId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Fetch document
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (docError) throw docError;
      if (!docData) {
        toast.error('Document not found');
        return;
      }
      setDocument(docData);

      // Fetch document items
      const { data: itemsData, error: itemsError } = await supabase
        .from('document_items')
        .select('*')
        .eq('document_id', documentId)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch business settings (auto-create if missing)
      let { data: settingsData } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settingsData) {
        const { data: newSettings } = await supabase
          .from('business_settings')
          .insert({ user_id: user.id })
          .select()
          .maybeSingle();
        settingsData = newSettings;
      }

      if (settingsData) {
        setBusinessSettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching document data:', error);
      toast.error('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!document || !businessSettings) return;

    // No noopener/noreferrer — window.open() returns null whenever those are
    // set (per spec), which made this fail every time regardless of any
    // actual popup blocker. Safe to omit: we write our own trusted HTML into
    // a blank window, not an external URL.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print window');
      return;
    }

    const htmlContent = generatePrintHTML();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generatePrintHTML = (): string => {
    if (!document || !businessSettings) return '';

    const itemsHTML = items
      .map(
        (item) => `
      <tr>
        <td class="border-b border-gray-300 py-3 px-4 text-left">${escapeHtml(item.product_name)}</td>
        <td class="border-b border-gray-300 py-3 px-4 text-sm text-gray-600">${escapeHtml(item.description)}</td>
        <td class="border-b border-gray-300 py-3 px-4 text-right">${safeNum(item.quantity)}</td>
        <td class="border-b border-gray-300 py-3 px-4 text-right">${formatCurrency(safeNum(item.unit_price))}</td>
        <td class="border-b border-gray-300 py-3 px-4 text-right">${safeNum(item.discount_percent)}%</td>
        <td class="border-b border-gray-300 py-3 px-4 text-right">${safeNum(item.tax_percent)}%</td>
        <td class="border-b border-gray-300 py-3 px-4 text-right font-semibold">${formatCurrency(safeNum(item.total))}</td>
      </tr>
    `
      )
      .join('');

    const footerText = getFooterText();
    const docTypeLabel = document.document_type.toUpperCase();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(document.document_number)}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 850px;
            margin: 0 auto;
            padding: 40px;
            background: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header-left h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .header-left p {
            font-size: 13px;
            color: #666;
            margin: 3px 0;
          }
          .header-right {
            text-align: right;
          }
          .doc-type {
            font-size: 28px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 10px;
          }
          .doc-number {
            font-size: 13px;
            color: #666;
          }
          .doc-date {
            font-size: 13px;
            color: #666;
            margin-top: 5px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 8px;
          }
          .two-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .info-block p {
            font-size: 13px;
            margin: 4px 0;
            color: #333;
          }
          .info-block .label {
            font-weight: 600;
            color: #666;
            font-size: 12px;
          }
          table {
            width: 100%;
            margin: 20px 0;
            border-collapse: collapse;
          }
          thead {
            background-color: #f3f4f6;
          }
          thead th {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            padding: 10px 4px;
            text-align: left;
            color: #333;
            border-bottom: 2px solid #d1d5db;
          }
          tbody td {
            font-size: 13px;
            padding: 10px 4px;
          }
          .summary-table {
            width: 100%;
            margin-top: 20px;
          }
          .summary-row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          .summary-row.total {
            border-bottom: 2px solid #333;
            border-top: 2px solid #333;
            font-weight: 700;
            font-size: 16px;
            padding: 15px 0;
            background-color: #f9fafb;
          }
          .summary-row.highlight {
            background-color: #f9fafb;
            font-weight: 500;
          }
          .summary-label {
            text-align: left;
            color: #333;
          }
          .summary-value {
            text-align: right;
            font-weight: 500;
          }
          .notes {
            background-color: #f9fafb;
            border-left: 3px solid #1e40af;
            padding: 15px;
            margin-top: 20px;
            font-size: 13px;
            color: #555;
          }
          .payment-info {
            background-color: #f0fdf4;
            border: 1px solid #dcfce7;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
            font-size: 13px;
          }
          .payment-info-title {
            font-weight: 600;
            color: #166534;
            margin-bottom: 10px;
          }
          .payment-info p {
            margin: 5px 0;
            color: #166534;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #d1d5db;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .terms {
            margin-top: 20px;
            padding: 15px;
            background-color: #fef2f2;
            border-left: 3px solid #dc2626;
            font-size: 12px;
            color: #555;
          }
          .terms-title {
            font-weight: 600;
            color: #991b1b;
            margin-bottom: 10px;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 100%;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="header-left">
              <h1>${escapeHtml(businessSettings.business_name)}</h1>
              <p>${escapeHtml(businessSettings.physical_address)}</p>
              <p>${escapeHtml(businessSettings.city)}, ${escapeHtml(businessSettings.country)}</p>
              <p>Phone: ${escapeHtml(businessSettings.phone)}</p>
              <p>Email: ${escapeHtml(businessSettings.email)}</p>
              ${businessSettings.kra_pin ? `<p>KRA PIN: ${escapeHtml(businessSettings.kra_pin)}</p>` : ''}
              ${businessSettings.vat_number ? `<p>VAT: ${escapeHtml(businessSettings.vat_number)}</p>` : ''}
            </div>
            <div class="header-right">
              <div class="doc-type">${docTypeLabel}</div>
              <div class="doc-number">No: ${escapeHtml(document.document_number)}</div>
              <div class="doc-date">Date: ${new Date(document.date).toLocaleDateString()}</div>
              ${document.due_date ? `<div class="doc-date">Due: ${new Date(document.due_date).toLocaleDateString()}</div>` : ''}
            </div>
          </div>

          <!-- Customer Info -->
          <div class="two-columns">
            <div class="section">
              <div class="section-title">Bill To</div>
              <div class="info-block">
                <p class="label">${escapeHtml(document.customer_name)}</p>
                <p>${escapeHtml(document.customer_address)}</p>
                <p>Phone: ${escapeHtml(document.customer_phone)}</p>
                <p>Email: ${escapeHtml(document.customer_email)}</p>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Discount %</th>
                  <th>Tax %</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div class="section">
            <div class="summary-table">
              <div class="summary-row">
                <div class="summary-label">Subtotal:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.subtotal))}</div>
              </div>
              ${safeNum(document.discount_amount) > 0 ? `
              <div class="summary-row">
                <div class="summary-label">Discount:</div>
                <div class="summary-value">-${formatCurrency(safeNum(document.discount_amount))}</div>
              </div>
              ` : ''}
              ${safeNum(document.delivery_charge) > 0 ? `
              <div class="summary-row">
                <div class="summary-label">Delivery Charge:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.delivery_charge))}</div>
              </div>
              ` : ''}
              ${safeNum(document.tax_amount) > 0 ? `
              <div class="summary-row">
                <div class="summary-label">Tax:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.tax_amount))}</div>
              </div>
              ` : ''}
              <div class="summary-row total">
                <div class="summary-label">TOTAL:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.total))}</div>
              </div>
              ${document.document_type === 'invoice' && safeNum(document.amount_paid) > 0 ? `
              <div class="summary-row highlight">
                <div class="summary-label">Amount Paid:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.amount_paid))}</div>
              </div>
              <div class="summary-row highlight">
                <div class="summary-label">Balance Due:</div>
                <div class="summary-value">${formatCurrency(safeNum(document.balance_due))}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Notes -->
          ${document.notes ? `
          <div class="notes">
            <strong>Notes:</strong><br/>
            ${escapeHtml(document.notes)}
          </div>
          ` : ''}

          <!-- Payment Info (for invoices) -->
          ${document.document_type === 'invoice' && (businessSettings.payment_instructions || businessSettings.bank_details) ? `
          <div class="payment-info">
            <div class="payment-info-title">Payment Instructions</div>
            ${businessSettings.payment_instructions ? `<p>${escapeHtml(businessSettings.payment_instructions)}</p>` : ''}
            ${businessSettings.bank_details ? `<p>Bank Details: ${escapeHtml(businessSettings.bank_details)}</p>` : ''}
          </div>
          ` : ''}

          <!-- Terms -->
          ${document.terms ? `
          <div class="terms">
            <div class="terms-title">Terms & Conditions</div>
            ${escapeHtml(document.terms)}
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            ${escapeHtml(footerText)}
            <p style="margin-top: 20px; font-size: 11px; color: #999;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleShareWhatsApp = () => {
    if (!document || !businessSettings) return;

    const itemsSummary = items
      .map(
        (item) =>
          `${item.product_name} x${safeNum(item.quantity)} = ${formatCurrency(safeNum(item.total))}`
      )
      .join('\n');

    const message = `
*${document.document_number}*

${businessSettings.business_name}

*Items:*
${itemsSummary}

*Subtotal:* ${formatCurrency(safeNum(document.subtotal))}
${safeNum(document.discount_amount) > 0 ? `*Discount:* -${formatCurrency(safeNum(document.discount_amount))}\n` : ''}
${safeNum(document.delivery_charge) > 0 ? `*Delivery:* ${formatCurrency(safeNum(document.delivery_charge))}\n` : ''}
${safeNum(document.tax_amount) > 0 ? `*Tax:* ${formatCurrency(safeNum(document.tax_amount))}\n` : ''}

*TOTAL: ${formatCurrency(safeNum(document.total))}*

${document.document_type === 'invoice' ? `*Amount Paid:* ${formatCurrency(safeNum(document.amount_paid))}\n*Balance Due:* ${formatCurrency(safeNum(document.balance_due))}` : ''}

Phone: ${businessSettings.phone}
    `.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp...');
  };

  const handleDownloadPDF = () => {
    if (!document) return;

    // Same fix as handlePrint above — noopener/noreferrer forces window.open()
    // to return null, which always looked like a blocked popup.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print window');
      return;
    }

    const htmlContent = generatePrintHTML();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);

    toast.success('Print dialog opened. Select "Save as PDF"');
  };

  const handleMarkAsPaid = async () => {
    if (!document) return;

    try {
      setMarking(true);
      const { error } = await supabase
        .from('documents')
        .update({ status: 'paid' })
        .eq('id', documentId);

      if (error) throw error;

      setDocument({ ...document, status: 'paid' });
      toast.success('Document marked as paid');
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Failed to mark as paid');
    } finally {
      setMarking(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!document) return;

    try {
      setMarking(true);
      const { error } = await supabase
        .from('documents')
        .update({ document_type: 'invoice' })
        .eq('id', documentId);

      if (error) throw error;

      setDocument({ ...document, document_type: 'invoice' });
      toast.success('Converted to invoice');
    } catch (error) {
      console.error('Error converting:', error);
      toast.error('Failed to convert');
    } finally {
      setMarking(false);
    }
  };

  const getFooterText = (): string => {
    if (!businessSettings) return '';

    switch (document?.document_type) {
      case 'quotation':
        return businessSettings.quotation_footer || 'Thank you for your business!';
      case 'invoice':
        return businessSettings.invoice_footer || 'Thank you for your business!';
      case 'receipt':
        return businessSettings.receipt_footer || 'Thank you for your purchase!';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}
      >
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document || !businessSettings) {
    return (
      <div
        className={`flex items-center justify-center h-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}
      >
        <div className="text-center">
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Document not found</p>
        </div>
      </div>
    );
  }

  const docTypeLabel = document.document_type.charAt(0).toUpperCase() + document.document_type.slice(1);

  return (
    <div
      className={`flex flex-col h-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      {/* Action Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-200 ${isDark ? 'hover:bg-gray-700' : ''}`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-gray-300"></div>

          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(document.status)}`}
          >
            {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
          </span>

          <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {document.document_number}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            title="Print"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
            title="Share via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={onEdit}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          {document.document_type === 'invoice' && document.status !== 'paid' && (
            <button
              onClick={handleMarkAsPaid}
              disabled={marking}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
              title="Mark as Paid"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Paid</span>
            </button>
          )}

          {document.document_type === 'quotation' && (
            <button
              onClick={handleConvertToInvoice}
              disabled={marking}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50"
              title="Convert to Invoice"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Document Preview */}
      <div
        className={`flex-1 overflow-auto p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
      >
        <div
          className={`max-w-4xl mx-auto rounded-lg shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          {/* Header */}
          <div className="flex justify-between items-start p-8 border-b border-gray-200">
            <div>
              <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {businessSettings.business_name}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {businessSettings.physical_address}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {businessSettings.city}, {businessSettings.country}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Phone: {businessSettings.phone}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Email: {businessSettings.email}
              </p>
              {businessSettings.kra_pin && (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  KRA PIN: {businessSettings.kra_pin}
                </p>
              )}
              {businessSettings.vat_number && (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  VAT: {businessSettings.vat_number}
                </p>
              )}
            </div>

            <div className="text-right">
              <h2 className="text-3xl font-bold text-blue-600 mb-2">{docTypeLabel}</h2>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {document.document_number}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Date: {new Date(document.date).toLocaleDateString()}
              </p>
              {document.due_date && (
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Due: {new Date(document.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className={`p-8 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              BILL TO
            </h3>
            <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {document.customer_name}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {document.customer_address}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Phone: {document.customer_phone}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Email: {document.customer_email}
            </p>
          </div>

          {/* Items Table */}
          <div className={`p-8 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b-2 ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                    <th className={`text-left py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Product
                    </th>
                    <th className={`text-left py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Description
                    </th>
                    <th className={`text-right py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Qty
                    </th>
                    <th className={`text-right py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Unit Price
                    </th>
                    <th className={`text-right py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Discount %
                    </th>
                    <th className={`text-right py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Tax %
                    </th>
                    <th className={`text-right py-2 px-2 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b ${index % 2 === 0 ? (isDark ? 'bg-gray-800' : 'bg-gray-50') : ''} ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <td className={`py-3 px-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.product_name}
                      </td>
                      <td className={`py-3 px-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.description}
                      </td>
                      <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {safeNum(item.quantity)}
                      </td>
                      <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formatCurrency(safeNum(item.unit_price))}
                      </td>
                      <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {safeNum(item.discount_percent)}%
                      </td>
                      <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {safeNum(item.tax_percent)}%
                      </td>
                      <td className={`py-3 px-2 text-right font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(safeNum(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className={`p-8 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="max-w-sm ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  {formatCurrency(safeNum(document.subtotal))}
                </span>
              </div>

              {safeNum(document.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Discount:</span>
                  <span className={`text-red-600 ${isDark ? '' : ''}`}>
                    -{formatCurrency(safeNum(document.discount_amount))}
                  </span>
                </div>
              )}

              {safeNum(document.delivery_charge) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Delivery Charge:</span>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {formatCurrency(safeNum(document.delivery_charge))}
                  </span>
                </div>
              )}

              {safeNum(document.tax_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Tax:</span>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {formatCurrency(safeNum(document.tax_amount))}
                  </span>
                </div>
              )}

              <div className={`flex justify-between text-lg font-bold py-2 px-3 rounded border-t-2 border-b-2 ${isDark ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900'}`}>
                <span>TOTAL:</span>
                <span className="text-blue-600">{formatCurrency(safeNum(document.total))}</span>
              </div>

              {document.document_type === 'invoice' && safeNum(document.amount_paid) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Amount Paid:</span>
                    <span className={`text-green-600 ${isDark ? '' : ''}`}>
                      {formatCurrency(safeNum(document.amount_paid))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Balance Due:</span>
                    <span className={safeNum(document.balance_due) > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {formatCurrency(safeNum(document.balance_due))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div className={`p-8 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Notes
              </h3>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {document.notes}
              </p>
            </div>
          )}

          {/* Payment Instructions */}
          {document.document_type === 'invoice' && (businessSettings.payment_instructions || businessSettings.bank_details) && (
            <div className={`p-8 border-b ${isDark ? 'border-gray-700 bg-green-900 bg-opacity-20' : 'border-gray-200 bg-green-50'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                Payment Instructions
              </h3>
              {businessSettings.payment_instructions && (
                <p className={`text-sm ${isDark ? 'text-green-200' : 'text-green-700'}`}>
                  {businessSettings.payment_instructions}
                </p>
              )}
              {businessSettings.bank_details && (
                <p className={`text-sm mt-2 ${isDark ? 'text-green-200' : 'text-green-700'}`}>
                  Bank Details: {businessSettings.bank_details}
                </p>
              )}
            </div>
          )}

          {/* Terms */}
          {document.terms && (
            <div className={`p-8 border-b ${isDark ? 'border-gray-700 bg-red-900 bg-opacity-20' : 'border-gray-200 bg-red-50'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                Terms & Conditions
              </h3>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-red-200' : 'text-red-700'}`}>
                {document.terms}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className={`p-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className="text-xs mb-2">{getFooterText()}</p>
            <p className="text-xs">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
