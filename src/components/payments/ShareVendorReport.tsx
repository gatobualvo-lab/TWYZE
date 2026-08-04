import React, { useState, useMemo } from 'react';
import { Calendar, Download, Share2, X, Package, DollarSign, User, CheckCircle, AlertTriangle } from 'lucide-react';

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

interface ShareVendorReportProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  vendorTransactions: Transaction[];
  totalPurchases: number;
  totalExpenses: number;
  netOwed: number;
}

const ShareVendorReport: React.FC<ShareVendorReportProps> = ({
  isOpen,
  onClose,
  vendorName,
  vendorTransactions,
  totalPurchases,
  totalExpenses,
  netOwed
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    return vendorTransactions.filter(txn => {
      const txnDate = new Date(txn.date);
      const fromOK = !startDate || txnDate >= new Date(startDate);
      const toOK = !endDate || txnDate <= new Date(endDate);
      return fromOK && toOK;
    });
  }, [vendorTransactions, startDate, endDate]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const purchases = filteredTransactions
      .filter(txn => txn.type === 'Purchase')
      .reduce((sum, txn) => sum + txn.amount, 0);
    
    const expenses = filteredTransactions
      .filter(txn => txn.type === 'Expense')
      .reduce((sum, txn) => sum + txn.amount, 0);

    return {
      totalPurchases: purchases,
      totalExpenses: expenses,
      netOwed: purchases - expenses,
      transactionCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const generateTextSummary = () => {
    const dateRangeText = startDate && endDate 
      ? `${formatDate(startDate)} - ${formatDate(endDate)}`
      : startDate 
        ? `From ${formatDate(startDate)}`
        : endDate 
          ? `Until ${formatDate(endDate)}`
          : 'All transactions';

    let summary = `Transaction Report - ${vendorName}\n`;
    summary += `Date Range: ${dateRangeText}\n`;
    summary += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    summary += `SUMMARY:\n`;
    summary += `Total Transactions: ${filteredTotals.transactionCount}\n`;
    summary += `Total Purchases: ${formatCurrency(filteredTotals.totalPurchases)}\n`;
    summary += `Total Expenses: ${formatCurrency(filteredTotals.totalExpenses)}\n`;
    summary += `Net Amount Owed: ${formatCurrency(filteredTotals.netOwed)}\n\n`;
    
    summary += `TRANSACTION DETAILS:\n`;
    filteredTransactions.forEach(txn => {
      summary += `${formatDate(txn.date)} - ${txn.type} - ${txn.product_name || txn.description || 'N/A'} - ${formatCurrency(txn.amount)} - ${txn.status}`;
      if (txn.notes) summary += ` - ${txn.notes}`;
      summary += `\n`;
    });

    return summary;
  };

  const generateCSVContent = () => {
    const headers = [
      'Transaction ID',
      'Date', 
      'Type',
      'Product/Description',
      'Quantity',
      'Unit Price',
      'Total Amount',
      'Vendor',
      'Delivery Person',
      'Status',
      'Notes'
    ];

    const rows = filteredTransactions.map(txn => [
      txn.id,
      formatDate(txn.date),
      txn.type,
      txn.product_name || txn.description || '',
      txn.quantity || '',
      txn.unit_price ? formatCurrency(txn.unit_price) : '',
      formatCurrency(txn.amount),
      txn.vendor,
      txn.delivery_person || '',
      txn.status,
      txn.notes || ''
    ]);

    const totalsRow = [
      'TOTALS',
      '',
      '',
      `${filteredTotals.transactionCount} transactions`,
      '',
      '',
      formatCurrency(filteredTotals.totalPurchases + filteredTotals.totalExpenses),
      '',
      '',
      `Net Owed: ${formatCurrency(filteredTotals.netOwed)}`,
      ''
    ];

    const csvContent = [
      [`Vendor Transaction Report - ${vendorName}`],
      [`Date Range: ${startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'All transactions'}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows,
      [],
      totalsRow
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csvContent;
  };

  const generateSalesCSV = () => {
    const salesTransactions = filteredTransactions.filter(txn => txn.type === 'Purchase');
    
    const headers = [
      'Transaction ID',
      'Date', 
      'Product Name',
      'Quantity',
      'Unit Price',
      'Total Amount',
      'Vendor',
      'Delivery Person',
      'Status',
      'Notes'
    ];

    const rows = salesTransactions.map(txn => [
      txn.id,
      formatDate(txn.date),
      txn.product_name || '',
      txn.quantity || '',
      txn.unit_price ? formatCurrency(txn.unit_price) : '',
      formatCurrency(txn.amount),
      txn.vendor,
      txn.delivery_person || '',
      txn.status,
      txn.notes || ''
    ]);

    const totalSales = salesTransactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalsRow = [
      'TOTALS',
      '',
      `${salesTransactions.length} sales transactions`,
      '',
      '',
      formatCurrency(totalSales),
      '',
      '',
      '',
      ''
    ];

    const csvContent = [
      [`Vendor Sales Report - ${vendorName}`],
      [`Date Range: ${startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'All transactions'}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows,
      [],
      totalsRow
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csvContent;
  };

  const generateExpensesCSV = () => {
    const expenseTransactions = filteredTransactions.filter(txn => txn.type === 'Expense');
    
    const headers = [
      'Transaction ID',
      'Date', 
      'Description',
      'Amount',
      'Vendor',
      'Status',
      'Notes'
    ];

    const rows = expenseTransactions.map(txn => [
      txn.id,
      formatDate(txn.date),
      txn.description || '',
      formatCurrency(txn.amount),
      txn.vendor,
      txn.status,
      txn.notes || ''
    ]);

    const totalExpenses = expenseTransactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalsRow = [
      'TOTALS',
      '',
      `${expenseTransactions.length} expense transactions`,
      formatCurrency(totalExpenses),
      '',
      '',
      ''
    ];

    const csvContent = [
      [`Vendor Expenses Report - ${vendorName}`],
      [`Date Range: ${startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'All transactions'}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows,
      [],
      totalsRow
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csvContent;
  };

  const downloadSalesCSV = () => {
    const salesTransactions = filteredTransactions.filter(txn => txn.type === 'Purchase');
    
    if (salesTransactions.length === 0) {
      alert('No sales transactions found for the selected date range');
      return;
    }

    const csvContent = generateSalesCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const dateStr = startDate && endDate 
      ? `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
      : new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    a.download = `vendor-sales-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadExpensesCSV = () => {
    const expenseTransactions = filteredTransactions.filter(txn => txn.type === 'Expense');
    
    if (expenseTransactions.length === 0) {
      alert('No expense transactions found for the selected date range');
      return;
    }

    const csvContent = generateExpensesCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const dateStr = startDate && endDate 
      ? `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
      : new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    a.download = `vendor-expenses-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const handleShareAndDownload = async () => {
    const textSummary = generateTextSummary();
    const csvContent = generateCSVContent();

    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Transaction Report - ${vendorName}`,
          text: textSummary
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(textSummary);
        alert('Report copied to clipboard!');
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(textSummary);
        alert('Report copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-report-${vendorName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Share2 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Share Vendor Report</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Share transaction report for <strong>{vendorName}</strong>
            </p>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            Date Range Filter (Optional)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearDateRange}
                className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Clear Dates
              </button>
            </div>
          </div>
          
          {(startDate || endDate) && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Active Filter:</strong> {startDate && endDate 
                  ? `${formatDate(startDate)} – ${formatDate(endDate)}`
                  : startDate 
                    ? `From ${formatDate(startDate)}`
                    : `Until ${formatDate(endDate)}`
                } ({filteredTotals.transactionCount} transactions)
              </p>
            </div>
          )}
        </div>

        {/* Separate Download Buttons */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
            <Download className="w-4 h-4 text-gray-500" />
            Download Specific Reports
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={downloadSalesCSV}
              disabled={filteredTransactions.filter(txn => txn.type === 'Purchase').length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Sales CSV
              <span className="text-sm">
                ({filteredTransactions.filter(txn => txn.type === 'Purchase').length})
              </span>
            </button>
            <button
              onClick={downloadExpensesCSV}
              disabled={filteredTransactions.filter(txn => txn.type === 'Expense').length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Expenses CSV
              <span className="text-sm">
                ({filteredTransactions.filter(txn => txn.type === 'Expense').length})
              </span>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-gray-200">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-3">Report Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Transactions:</span>
                <span className="float-right font-medium">{filteredTotals.transactionCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Purchases:</span>
                <span className="float-right font-medium">{formatCurrency(filteredTotals.totalPurchases)}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Expenses:</span>
                <span className="float-right font-medium text-green-600">{formatCurrency(filteredTotals.totalExpenses)}</span>
              </div>
              <div>
                <span className="text-gray-600">Net Owed:</span>
                <span className={`float-right font-bold ${
                  filteredTotals.netOwed > 0 ? 'text-red-600' : 
                  filteredTotals.netOwed < 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {formatCurrency(filteredTotals.netOwed)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <h4 className="font-medium text-gray-700 mb-3">Transaction Details</h4>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected date range
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((txn) => (
                <div key={txn.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-full ${
                        txn.type === 'Purchase' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {txn.type === 'Purchase' ? (
                          <Package className="w-3 h-3 text-blue-600" />
                        ) : (
                          <DollarSign className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{formatDate(txn.date)}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        txn.type === 'Purchase' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {txn.type}
                      </span>
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
                  
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-medium">{txn.product_name || txn.description || 'N/A'}</span>
                      {txn.quantity && (
                        <span className="text-gray-500">× {txn.quantity}</span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span>{txn.vendor}</span>
                        {txn.delivery_person && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{txn.delivery_person}</span>
                          </>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'Paid' || txn.status === 'Reimbursed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {txn.status}
                      </span>
                    </div>
                    
                    {txn.notes && (
                      <div className="mt-1 text-xs text-gray-500 italic">
                        {txn.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} will be shared and downloaded
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareAndDownload}
                disabled={filteredTransactions.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share & Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareVendorReport;