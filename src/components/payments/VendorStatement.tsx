import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Printer, MessageCircle, X, Package, DollarSign, User, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../utils/format';
import { escapeHtml } from '../documents/DocumentPreview';

interface Transaction {
  id: string;
  date: string;
  type: 'Purchase' | 'Expense';
  product_name?: string;
  description?: string;
  amount: number;
  quantity?: number;
  unit_price?: number;
  vendor: string;
  delivery_person?: string;
  status: string;
  notes?: string;
}

interface BusinessInfo {
  business_name: string | null;
  phone: string | null;
  email: string | null;
  physical_address: string | null;
  city: string | null;
  country: string | null;
}

interface VendorStatementProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
}

const VendorStatement: React.FC<VendorStatementProps> = ({
  isOpen,
  onClose,
  vendorName,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // The on-screen vendor list is paginated (20 items/page), so it can't be
  // trusted to hold every transaction. A statement has to be complete, so it
  // fetches the vendor's full purchase/expense history directly rather than
  // reusing whatever happens to be loaded into the page's state.
  useEffect(() => {
    if (!isOpen || !vendorName) return;

    let cancelled = false;
    setLoading(true);
    setStartDate('');
    setEndDate('');

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [purchasesRes, expensesRes, settingsRes] = await Promise.all([
        supabase
          .from('sale_items')
          .select('id, sale_id, product_name, buying_price, quantity, vendor_payment_status, created_at, sales!inner(date, delivery_guy, user_id, is_deleted)')
          .eq('vendor', vendorName)
          .eq('sales.user_id', user.id)
          .eq('sales.is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_expenses')
          .select('*')
          .eq('vendor_name', vendorName)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('business_settings')
          .select('business_name, phone, email, physical_address, city, country')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      if (cancelled) return;

      const purchaseTxns: Transaction[] = (purchasesRes.data || []).map(item => {
        const sale = item.sales as unknown as { date: string | null; delivery_guy: string | null } | null;
        return {
          id: item.id,
          date: sale?.date || item.created_at || '',
          type: 'Purchase',
          product_name: item.product_name || '',
          quantity: item.quantity ?? 0,
          unit_price: item.buying_price ?? 0,
          amount: (item.buying_price ?? 0) * (item.quantity ?? 0),
          vendor: vendorName,
          delivery_person: sale?.delivery_guy || '',
          status: item.vendor_payment_status || 'Unpaid',
          notes: ''
        };
      });

      const expenseTxns: Transaction[] = (expensesRes.data || []).map(expense => ({
        id: expense.id,
        date: expense.occurred_on,
        type: 'Expense',
        product_name: expense.expense_type,
        quantity: 1,
        unit_price: expense.amount_kes,
        amount: expense.amount_kes,
        vendor: expense.vendor_name,
        delivery_person: '',
        status: expense.is_cleared ? 'Reimbursed' : 'Unreimbursed',
        notes: expense.notes || ''
      }));

      setTransactions(
        [...purchaseTxns, ...expenseTxns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setBusiness(settingsRes.data ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [isOpen, vendorName]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(txn => {
        const txnDate = new Date(txn.date);
        const fromOK = !startDate || txnDate >= new Date(startDate);
        const toOK = !endDate || txnDate <= new Date(endDate);
        return fromOK && toOK;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, startDate, endDate]);

  const totals = useMemo(() => {
    const purchases = filteredTransactions.filter(t => t.type === 'Purchase').reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
    return {
      purchases,
      expenses,
      netOwed: purchases - expenses,
      count: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const dateRangeLabel = startDate && endDate
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : startDate
      ? `From ${formatDate(startDate)}`
      : endDate
        ? `Until ${formatDate(endDate)}`
        : 'All transactions';

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  const generateStatementHTML = (): string => {
    const purchaseRows = filteredTransactions.filter(t => t.type === 'Purchase');
    const expenseRows = filteredTransactions.filter(t => t.type === 'Expense');

    const purchasesHTML = purchaseRows.map(txn => `
      <tr>
        <td>${formatDate(txn.date)}</td>
        <td>${escapeHtml(txn.product_name || txn.description || 'N/A')}</td>
        <td class="right">${txn.quantity ?? 1}</td>
        <td class="right">${formatCurrency(txn.unit_price ?? txn.amount)}</td>
        <td class="right">${formatCurrency(txn.amount)}</td>
        <td><span class="badge ${txn.status === 'Paid' ? 'badge-green' : 'badge-red'}">${escapeHtml(txn.status)}</span></td>
      </tr>
    `).join('');

    const expensesHTML = expenseRows.map(txn => `
      <tr>
        <td>${formatDate(txn.date)}</td>
        <td>${escapeHtml(txn.product_name || txn.description || 'N/A')}</td>
        <td class="right">${formatCurrency(txn.amount)}</td>
        <td><span class="badge ${txn.status === 'Reimbursed' ? 'badge-green' : 'badge-red'}">${escapeHtml(txn.status)}</span></td>
        <td>${escapeHtml(txn.notes || '')}</td>
      </tr>
    `).join('');

    const addressLine = [business?.city, business?.country].filter(Boolean).join(', ');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vendor Statement - ${escapeHtml(vendorName)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
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
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header-left h1 { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
          .header-left p { font-size: 13px; color: #666; margin: 3px 0; }
          .header-right { text-align: right; }
          .doc-type { font-size: 24px; font-weight: 700; color: #1e40af; margin-bottom: 10px; }
          .doc-number { font-size: 14px; color: #333; font-weight: 600; }
          .doc-date { font-size: 13px; color: #666; margin-top: 5px; }
          table { width: 100%; margin: 20px 0; border-collapse: collapse; }
          thead { background-color: #f3f4f6; }
          thead th {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            padding: 10px 8px;
            text-align: left;
            color: #333;
            border-bottom: 2px solid #d1d5db;
          }
          tbody td {
            font-size: 13px;
            padding: 10px 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          tbody td.right, thead th.right { text-align: right; }
          tbody td.empty { text-align: center; color: #999; padding: 30px 8px; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
          }
          .badge-blue { background-color: #dbeafe; color: #1e40af; }
          .badge-green { background-color: #dcfce7; color: #166534; }
          .badge-red { background-color: #fee2e2; color: #991b1b; }
          .section-title {
            font-size: 15px;
            font-weight: 700;
            color: #333;
            margin: 28px 0 4px;
            padding-bottom: 6px;
            border-bottom: 1px solid #d1d5db;
          }
          .section-title:first-of-type { margin-top: 0; }
          tfoot td {
            font-size: 13px;
            font-weight: 700;
            padding: 10px 8px;
            border-top: 2px solid #333;
            background-color: #f9fafb;
          }
          .summary-table { width: 100%; margin-top: 10px; max-width: 320px; margin-left: auto; }
          .summary-row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          .summary-row.total {
            border-bottom: 2px solid #333;
            border-top: 2px solid #333;
            font-weight: 700;
            font-size: 15px;
            padding: 12px 0;
            background-color: #f9fafb;
          }
          .summary-label { text-align: left; color: #333; }
          .summary-value { text-align: right; font-weight: 500; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #d1d5db;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .container { max-width: 100%; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <h1>${escapeHtml(business?.business_name || 'Your Business')}</h1>
              ${business?.physical_address ? `<p>${escapeHtml(business.physical_address)}</p>` : ''}
              ${addressLine ? `<p>${escapeHtml(addressLine)}</p>` : ''}
              ${business?.phone ? `<p>Phone: ${escapeHtml(business.phone)}</p>` : ''}
              ${business?.email ? `<p>Email: ${escapeHtml(business.email)}</p>` : ''}
            </div>
            <div class="header-right">
              <div class="doc-type">VENDOR STATEMENT</div>
              <div class="doc-number">${escapeHtml(vendorName)}</div>
              <div class="doc-date">Period: ${escapeHtml(dateRangeLabel)}</div>
            </div>
          </div>

          <div class="section-title">Purchases (${purchaseRows.length})</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Unit Price</th>
                <th class="right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${purchasesHTML || `<tr><td class="empty" colspan="6">No purchases in this period</td></tr>`}
            </tbody>
            ${purchaseRows.length ? `
            <tfoot>
              <tr>
                <td colspan="4">Subtotal — Purchases</td>
                <td class="right">${formatCurrency(totals.purchases)}</td>
                <td></td>
              </tr>
            </tfoot>` : ''}
          </table>

          <div class="section-title">Vendor Expenses / Payments (${expenseRows.length})</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th class="right">Amount</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${expensesHTML || `<tr><td class="empty" colspan="5">No vendor expenses in this period</td></tr>`}
            </tbody>
            ${expenseRows.length ? `
            <tfoot>
              <tr>
                <td colspan="2">Subtotal — Expenses</td>
                <td class="right">${formatCurrency(totals.expenses)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>` : ''}
          </table>

          <div class="summary-table">
            <div class="summary-row">
              <div class="summary-label">Total Purchases</div>
              <div class="summary-value">${formatCurrency(totals.purchases)}</div>
            </div>
            <div class="summary-row">
              <div class="summary-label">Total Expenses</div>
              <div class="summary-value">${formatCurrency(totals.expenses)}</div>
            </div>
            <div class="summary-row total">
              <div class="summary-label">NET OWED</div>
              <div class="summary-value">${formatCurrency(totals.netOwed)}</div>
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()}${business?.business_name ? ` &middot; ${escapeHtml(business.business_name)}` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    // No noopener/noreferrer here — window.open() returns null whenever
    // those are set (per spec, regardless of whether a popup blocker is
    // even involved), which broke this every time. Safe to omit: we're
    // writing our own trusted HTML into a blank window, not an external URL.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print window. Check your popup blocker.');
      return;
    }

    printWindow.document.write(generateStatementHTML());
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Capped at a handful of the most recent lines — a vendor with a long
  // history (easily 100+ transactions) would otherwise turn this into an
  // unreadable wall of text. The full itemized list belongs in the printed/
  // PDF statement; the WhatsApp message is a quick balance summary that
  // points the recipient to it.
  const WHATSAPP_LINE_LIMIT = 10;

  const handleShareWhatsApp = () => {
    const shown = filteredTransactions.slice(0, WHATSAPP_LINE_LIMIT);
    const lines = shown.map(txn =>
      `${formatDate(txn.date)} - ${txn.type} - ${txn.product_name || txn.description || 'N/A'} - ${formatCurrency(txn.amount)} (${txn.status})`
    ).join('\n');
    const remaining = totals.count - shown.length;

    const message = `
*VENDOR STATEMENT - ${vendorName}*
${business?.business_name ? `${business.business_name}\n` : ''}
Period: ${dateRangeLabel}

*Summary*
Total Purchases: ${formatCurrency(totals.purchases)}
Total Expenses: ${formatCurrency(totals.expenses)}
*Net Owed: ${formatCurrency(totals.netOwed)}*

*Recent Transactions${shown.length < totals.count ? ` (${shown.length} of ${totals.count})` : ` (${totals.count})`}*
${lines || 'No transactions in this period'}
${remaining > 0 ? `\n…and ${remaining} more. See the full printed statement for complete details.` : ''}
    `.trim();

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp — pick who to send the statement to');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Printer className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Vendor Statement</h3>
                <p className="text-sm text-gray-600">{vendorName}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={clearDateRange}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
              >
                Clear
              </button>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <Calendar className="w-3.5 h-3.5" />
              {dateRangeLabel}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Purchases</p>
              <p className="font-bold text-gray-800">{formatCurrency(totals.purchases)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Expenses</p>
              <p className="font-bold text-gray-800">{formatCurrency(totals.expenses)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Net Owed</p>
              <p className={`font-bold ${totals.netOwed > 0 ? 'text-red-600' : totals.netOwed < 0 ? 'text-green-600' : 'text-gray-800'}`}>
                {formatCurrency(totals.netOwed)}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              Loading transactions…
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected date range
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((txn) => (
                <div key={txn.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-full ${txn.type === 'Purchase' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        {txn.type === 'Purchase' ? (
                          <Package className="w-3 h-3 text-blue-600" />
                        ) : (
                          <DollarSign className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{formatDate(txn.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatCurrency(txn.amount)}</span>
                      {txn.status === 'Paid' || txn.status === 'Reimbursed' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{txn.product_name || txn.description || 'N/A'}</span>
                      {txn.quantity && <span className="text-gray-500">× {txn.quantity}</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      txn.status === 'Paid' || txn.status === 'Reimbursed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {txn.status}
                    </span>
                  </div>
                  {txn.notes && <div className="mt-1 text-xs text-gray-500 italic">{txn.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {totals.count} transaction{totals.count !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={handleShareWhatsApp}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorStatement;
