import React, { useState, useEffect } from 'react';
import { Calendar, Download, FileText, Filter, Eye, BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';

interface DateRange {
  start: string;
  end: string;
}

interface EntitySelection {
  sales: boolean;
  saleItems: boolean;
  expenses: boolean;
  vendorTransactions: boolean;
  deliveryPayments: boolean;
}

interface SalesData {
  id: string;
  sale_id: string;
  date: string;
  sale_time: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  delivery_status: string;
  delivery_date: string;
  total_selling: number;
  total_buying: number;
  total_delivery_fee: number;
  gross_profit: number;
  vat_amount: number;
  turnover_tax_amount: number;
  net_profit: number;
}

interface SaleItemsData {
  sale_date: string;
  product_name: string;
  quantity: number;
  buying_price: number;
  selling_price: number;
  vat_amount: number;
  turnover_tax_amount: number;
  profit: number;
  vendor: string;
  delivery_person: string;
  location: string;
}

interface ExpensesData {
  date: string;
  expense_type: string;
  amount: number;
  notes: string;
  reimbursed: boolean;
}

interface VendorTransactionsData {
  vendor: string;
  sale_date: string;
  product_name: string;
  buying_price: number;
  delivery_person: string;
  vendor_paid: boolean;
}

interface DeliveryPaymentsData {
  delivery_person: string;
  sale_date: string;
  product_name: string;
  delivery_fee: number;
  delivery_paid: boolean;
}

interface ReportData {
  sales: SalesData[];
  saleItems: SaleItemsData[];
  expenses: ExpensesData[];
  vendorTransactions: VendorTransactionsData[];
  deliveryPayments: DeliveryPaymentsData[];
}

interface ReportTotals {
  sales: {
    quantity: number;
    item_total: number;
    total_selling: number;
    total_buying: number;
    total_delivery_fee: number;
    gross_profit: number;
    vat_amount: number;
    turnover_tax_amount: number;
    net_profit: number;
  };
  saleItems: {
    quantity: number;
    buying_price: number;
    selling_price: number;
    vat_amount: number;
    turnover_tax_amount: number;
    profit: number;
  };
  expenses: {
    amount: number;
  };
  vendorTransactions: {
    buying_price: number;
  };
  deliveryPayments: {
    delivery_fee: number;
  };
}

const ReportsAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const [entitySelection, setEntitySelection] = useState<EntitySelection>({
    sales: true,
    saleItems: false,
    expenses: false,
    vendorTransactions: false,
    deliveryPayments: false
  });

  const [reportData, setReportData] = useState<ReportData>({
    sales: [],
    saleItems: [],
    expenses: [],
    vendorTransactions: [],
    deliveryPayments: []
  });

  const [reportTotals, setReportTotals] = useState<ReportTotals>({
    sales: {
      quantity: 0,
      item_total: 0,
      total_selling: 0,
      total_buying: 0,
      total_delivery_fee: 0,
      gross_profit: 0,
      vat_amount: 0,
      turnover_tax_amount: 0,
      net_profit: 0
    },
    saleItems: {
      quantity: 0,
      buying_price: 0,
      selling_price: 0,
      vat_amount: 0,
      turnover_tax_amount: 0,
      profit: 0
    },
    expenses: {
      amount: 0
    },
    vendorTransactions: {
      buying_price: 0
    },
    deliveryPayments: {
      delivery_fee: 0
    }
  });

  const [activePreview, setActivePreview] = useState<keyof EntitySelection | null>(null);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to generate reports');
        return;
      }

      const newReportData: ReportData = {
        sales: [],
        saleItems: [],
        expenses: [],
        vendorTransactions: [],
        deliveryPayments: []
      };

      // Fetch Sales Data (item-level: one row per sold product)
      if (entitySelection.sales) {
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            id,
            date,
            sale_date,
            created_at,
            selling_price,
            buying_price,
            delivery_fee,
            profit,
            vat_amount,
            turnover_tax_amount,
            client_name,
            customer_phone,
            payment_method,
            delivery_status,
            delivery_date,
            delivery_fee_paid,
            product_name,
            sale_items:sale_items!sale_items_sale_id_fkey (
              id,
              product_name,
              quantity,
              unit_price,
              selling_price,
              subtotal,
              is_deleted
            )
          `)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .eq('is_archived', false)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .order('date', { ascending: false });

        if (salesError) throw salesError;

        const itemRows: SalesData[] = [];
        (salesData || []).forEach((sale: any) => {
          const rawTime = sale.sale_date ?? sale.created_at ?? null;
          const saleTime = rawTime
            ? new Date(rawTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
            : '';
          const saleTotals = {
            sale_id: sale.id,
            date: sale.date,
            sale_time: saleTime,
            customer_name: sale.client_name || '',
            customer_phone: sale.customer_phone || '',
            payment_method: sale.payment_method || 'Cash',
            delivery_status: sale.delivery_status || (sale.delivery_fee_paid ? 'Delivered' : 'Pending'),
            delivery_date: sale.delivery_date || '',
            total_selling: Number(sale.selling_price) || 0,
            total_buying: Number(sale.buying_price) || 0,
            total_delivery_fee: Number(sale.delivery_fee) || 0,
            gross_profit: (Number(sale.selling_price) || 0) - (Number(sale.buying_price) || 0),
            vat_amount: Number(sale.vat_amount) || 0,
            turnover_tax_amount: Number(sale.turnover_tax_amount) || 0,
            net_profit: Number(sale.profit) || 0,
          };

          const liveItems = (sale.sale_items || []).filter((it: any) => !it.is_deleted);
          if (liveItems.length > 0) {
            liveItems.forEach((item: any) => {
              const unit = Number(item.unit_price ?? item.selling_price) || 0;
              const qty = Number(item.quantity) || 0;
              const lineTotal = Number(item.subtotal ?? unit * qty) || 0;
              itemRows.push({
                id: `${sale.id}:${item.id}`,
                ...saleTotals,
                product_name: item.product_name || sale.product_name || '',
                quantity: qty,
                unit_price: unit,
                item_total: lineTotal,
              });
            });
          } else {
            itemRows.push({
              id: sale.id,
              ...saleTotals,
              product_name: sale.product_name || '',
              quantity: 1,
              unit_price: Number(sale.selling_price) || 0,
              item_total: Number(sale.selling_price) || 0,
            });
          }
        });

        newReportData.sales = itemRows;
      }

      // Fetch Sale Items Data
      if (entitySelection.saleItems) {
        const { data: saleItemsData, error: saleItemsError } = await supabase
          .from('sale_items')
          .select(`
            id,
            product_name,
            quantity,
            buying_price,
            selling_price,
            vat_amount,
            turnover_tax_amount,
            profit,
            vendor,
            sales!inner (
              date,
              delivery_guy,
              location,
              user_id,
              is_deleted
            )
          `)
          .eq('sales.user_id', user.id)
          .eq('sales.is_deleted', false)
          .gte('sales.date', dateRange.start)
          .lte('sales.date', dateRange.end);

        if (saleItemsError) throw saleItemsError;

        // Sort by date since we can't use order on foreign table with inner join
        const sortedSaleItems = (saleItemsData || []).sort((a: any, b: any) => {
          const dateA = new Date(a.sales?.date || '').getTime();
          const dateB = new Date(b.sales?.date || '').getTime();
          return dateB - dateA;
        });

        newReportData.saleItems = sortedSaleItems.map((item: any) => ({
          sale_date: item.sales?.date || '',
          product_name: item.product_name,
          // Service line items leave quantity/buying_price/profit null (no
          // vendor/inventory involved) — guard here, once, since every
          // downstream total is a running sum over this array.
          quantity: item.quantity ?? 0,
          buying_price: item.buying_price ?? 0,
          selling_price: item.selling_price ?? 0,
          vat_amount: item.vat_amount || 0,
          turnover_tax_amount: item.turnover_tax_amount || 0,
          profit: item.profit ?? 0,
          vendor: item.vendor || '',
          delivery_person: item.sales?.delivery_guy || '',
          location: item.sales?.location || ''
        }));
      }

      // Fetch Expenses Data (Combined General and Ad Expenses)
      if (entitySelection.expenses) {
        const [generalExpensesResult, adExpensesResult, vendorExpensesResult] = await Promise.all([
          supabase
            .from('general_expenses')
            .select(`
              date,
              expense_type,
              amount,
              notes
            `)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .eq('is_archived', false)
            .gte('date', dateRange.start)
            .lte('date', dateRange.end)
            .order('date', { ascending: false }),

          supabase
            .from('ad_expenses')
            .select(`
              occurred_on,
              ad_type,
              amount_kes,
              notes
            `)
            .eq('created_by', user.id)
            .eq('is_archived', false)
            .gte('occurred_on', dateRange.start)
            .lte('occurred_on', dateRange.end)
            .order('occurred_on', { ascending: false }),

          supabase
            .from('vendor_expenses')
            .select(`
              occurred_on,
              vendor_name,
              amount_kes,
              notes,
              is_cleared
            `)
            .eq('created_by', user.id)
            .gte('occurred_on', dateRange.start)
            .lte('occurred_on', dateRange.end)
            .order('occurred_on', { ascending: false })
        ]);

        if (generalExpensesResult.error) throw generalExpensesResult.error;
        if (adExpensesResult.error) throw adExpensesResult.error;
        if (vendorExpensesResult.error) throw vendorExpensesResult.error;

        const combinedExpenses = [
          ...(generalExpensesResult.data || []).map(expense => ({
            date: expense.date,
            expense_type: expense.expense_type,
            amount: expense.amount,
            notes: expense.notes || '',
            reimbursed: false
          })),
          ...(adExpensesResult.data || []).map(expense => ({
            date: expense.occurred_on,
            expense_type: `Ad: ${expense.ad_type}`,
            amount: expense.amount_kes,
            notes: expense.notes || '',
            reimbursed: false
          })),
          ...(vendorExpensesResult.data || []).map(expense => ({
            date: expense.occurred_on,
            expense_type: `Vendor: ${expense.vendor_name}`,
            amount: expense.amount_kes,
            notes: expense.notes || '',
            reimbursed: expense.is_cleared || false
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        newReportData.expenses = combinedExpenses;
      }

      // Fetch Vendor Transactions Data
      if (entitySelection.vendorTransactions) {
        const { data: vendorTransactionsData, error: vendorTransactionsError } = await supabase
          .from('sale_items')
          .select(`
            id,
            product_name,
            buying_price,
            quantity,
            vendor,
            vendor_payment_status,
            sales!inner (
              date,
              delivery_guy,
              user_id,
              is_deleted
            )
          `)
          .eq('sales.user_id', user.id)
          .eq('sales.is_deleted', false)
          .gte('sales.date', dateRange.start)
          .lte('sales.date', dateRange.end);

        if (vendorTransactionsError) throw vendorTransactionsError;

        // Sort by date
        const sortedVendorTransactions = (vendorTransactionsData || []).sort((a: any, b: any) => {
          const dateA = new Date(a.sales?.date || '').getTime();
          const dateB = new Date(b.sales?.date || '').getTime();
          return dateB - dateA;
        });

        newReportData.vendorTransactions = sortedVendorTransactions.map((item: any) => ({
          vendor: item.vendor || '',
          sale_date: item.sales?.date || '',
          product_name: item.product_name,
          buying_price: item.buying_price * (item.quantity || 1),
          delivery_person: item.sales?.delivery_guy || '',
          vendor_paid: item.vendor_payment_status === 'Paid'
        }));
      }

      // Fetch Delivery Payments Data
      if (entitySelection.deliveryPayments) {
        const { data: deliveryPaymentsData, error: deliveryPaymentsError } = await supabase
          .from('sales')
          .select(`
            id,
            date,
            product_name,
            delivery_guy,
            delivery_fee,
            delivery_fee_paid
          `)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .eq('is_archived', false)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .order('date', { ascending: false });

        if (deliveryPaymentsError) throw deliveryPaymentsError;

        newReportData.deliveryPayments = (deliveryPaymentsData || []).map(sale => ({
          delivery_person: sale.delivery_guy,
          sale_date: sale.date,
          product_name: sale.product_name,
          delivery_fee: sale.delivery_fee,
          delivery_paid: sale.delivery_fee_paid
        }));
      }

      setReportData(newReportData);
      calculateTotals(newReportData);

    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error(error.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (data: ReportData) => {
    const seenSales = new Set<string>();
    const salesTotals = data.sales.reduce((acc, row) => {
      acc.quantity += row.quantity || 0;
      acc.item_total += row.item_total || 0;
      if (!seenSales.has(row.sale_id)) {
        seenSales.add(row.sale_id);
        acc.total_selling += row.total_selling || 0;
        acc.total_buying += row.total_buying || 0;
        acc.total_delivery_fee += row.total_delivery_fee || 0;
        acc.gross_profit += row.gross_profit || 0;
        acc.vat_amount += row.vat_amount || 0;
        acc.turnover_tax_amount += row.turnover_tax_amount || 0;
        acc.net_profit += row.net_profit || 0;
      }
      return acc;
    }, {
      quantity: 0,
      item_total: 0,
      total_selling: 0,
      total_buying: 0,
      total_delivery_fee: 0,
      gross_profit: 0,
      vat_amount: 0,
      turnover_tax_amount: 0,
      net_profit: 0
    });

    const newTotals: ReportTotals = {
      sales: salesTotals,
      
      saleItems: data.saleItems.reduce((acc, item) => ({
        quantity: acc.quantity + item.quantity,
        buying_price: acc.buying_price + item.buying_price,
        selling_price: acc.selling_price + item.selling_price,
        vat_amount: acc.vat_amount + item.vat_amount,
        turnover_tax_amount: acc.turnover_tax_amount + item.turnover_tax_amount,
        profit: acc.profit + item.profit
      }), {
        quantity: 0,
        buying_price: 0,
        selling_price: 0,
        vat_amount: 0,
        turnover_tax_amount: 0,
        profit: 0
      }),
      
      expenses: data.expenses.reduce((acc, expense) => ({
        amount: acc.amount + expense.amount
      }), {
        amount: 0
      }),
      
      vendorTransactions: data.vendorTransactions.reduce((acc, transaction) => ({
        buying_price: acc.buying_price + transaction.buying_price
      }), {
        buying_price: 0
      }),
      
      deliveryPayments: data.deliveryPayments.reduce((acc, payment) => ({
        delivery_fee: acc.delivery_fee + payment.delivery_fee
      }), {
        delivery_fee: 0
      })
    };

    setReportTotals(newTotals);
  };

  const exportToCSV = (entityType: keyof EntitySelection) => {
    const data = reportData[entityType];
    const totals = reportTotals[entityType];
    
    if (!data || data.length === 0) {
      toast.error(`No ${entityType} data to export`);
      return;
    }

    let csvContent = '';
    let headers: string[] = [];
    let rows: string[][] = [];
    let totalsRow: string[] = [];

    switch (entityType) {
      case 'sales':
        headers = [
          'Sale ID', 'Date', 'Time',
          'Product', 'Quantity', 'Unit Price', 'Item Total',
          'Customer Name', 'Customer Phone', 'Payment Method',
          'Delivery Status', 'Delivery Date',
          'Total Selling', 'Total Buying', 'Delivery Fee',
          'Gross Profit', 'VAT Amount', 'Turnover Tax', 'Net Profit'
        ];
        rows = (data as SalesData[]).map(row => [
          row.sale_id,
          row.date,
          row.sale_time,
          row.product_name,
          String(row.quantity),
          formatCurrency(row.unit_price),
          formatCurrency(row.item_total),
          row.customer_name,
          row.customer_phone,
          row.payment_method,
          row.delivery_status,
          row.delivery_date,
          formatCurrency(row.total_selling),
          formatCurrency(row.total_buying),
          formatCurrency(row.total_delivery_fee),
          formatCurrency(row.gross_profit),
          formatCurrency(row.vat_amount),
          formatCurrency(row.turnover_tax_amount),
          formatCurrency(row.net_profit)
        ]);
        totalsRow = [
          'TOTAL', '', '',
          '',
          String(totals.quantity),
          '',
          formatCurrency(totals.item_total),
          '', '', '', '', '',
          formatCurrency(totals.total_selling),
          formatCurrency(totals.total_buying),
          formatCurrency(totals.total_delivery_fee),
          formatCurrency(totals.gross_profit),
          formatCurrency(totals.vat_amount),
          formatCurrency(totals.turnover_tax_amount),
          formatCurrency(totals.net_profit)
        ];
        break;

      case 'saleItems':
        headers = ['Sale Date', 'Product Name', 'Quantity', 'Buying Price', 'Selling Price', 'VAT Amount', 'Turnover Tax', 'Profit', 'Vendor', 'Delivery Person', 'Location'];
        rows = (data as SaleItemsData[]).map(item => [
          item.sale_date,
          item.product_name,
          item.quantity.toString(),
          formatCurrency(item.buying_price),
          formatCurrency(item.selling_price),
          formatCurrency(item.vat_amount),
          formatCurrency(item.turnover_tax_amount),
          formatCurrency(item.profit),
          item.vendor,
          item.delivery_person,
          item.location
        ]);
        totalsRow = [
          'TOTAL',
          '',
          totals.quantity.toString(),
          formatCurrency(totals.buying_price),
          formatCurrency(totals.selling_price),
          formatCurrency(totals.vat_amount),
          formatCurrency(totals.turnover_tax_amount),
          formatCurrency(totals.profit),
          '',
          '',
          ''
        ];
        break;

      case 'expenses':
        headers = ['Date', 'Expense Type', 'Amount', 'Notes', 'Reimbursed'];
        rows = (data as ExpensesData[]).map(expense => [
          expense.date,
          expense.expense_type,
          formatCurrency(expense.amount),
          expense.notes,
          expense.reimbursed ? 'Yes' : 'No'
        ]);
        totalsRow = [
          'TOTAL',
          '',
          formatCurrency(totals.amount),
          '',
          ''
        ];
        break;

      case 'vendorTransactions':
        headers = ['Vendor', 'Sale Date', 'Product Name', 'Buying Price', 'Delivery Person', 'Vendor Paid'];
        rows = (data as VendorTransactionsData[]).map(transaction => [
          transaction.vendor,
          transaction.sale_date,
          transaction.product_name,
          formatCurrency(transaction.buying_price),
          transaction.delivery_person,
          transaction.vendor_paid ? 'Yes' : 'No'
        ]);
        totalsRow = [
          'TOTAL',
          '',
          '',
          formatCurrency(totals.buying_price),
          '',
          ''
        ];
        break;

      case 'deliveryPayments':
        headers = ['Delivery Person', 'Sale Date', 'Product Name', 'Delivery Fee', 'Delivery Paid'];
        rows = (data as DeliveryPaymentsData[]).map(payment => [
          payment.delivery_person,
          payment.sale_date,
          payment.product_name,
          formatCurrency(payment.delivery_fee),
          payment.delivery_paid ? 'Yes' : 'No'
        ]);
        totalsRow = [
          'TOTAL',
          '',
          '',
          formatCurrency(totals.delivery_fee),
          ''
        ];
        break;
    }

    // Build CSV content (proper RFC 4180 escaping, BOM for Excel)
    const escape = (cell: any) => {
      const value = cell === null || cell === undefined ? '' : String(cell);
      return `"${value.replace(/"/g, '""')}"`;
    };
    csvContent = '\uFEFF' + [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(',')),
      totalsRow.map(escape).join(',')
    ].join('\r\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`${entityType} report exported successfully`);
  };

  const exportAllToCSV = () => {
    const selectedEntities = Object.entries(entitySelection)
      .filter(([_, selected]) => selected)
      .map(([entity, _]) => entity as keyof EntitySelection);

    if (selectedEntities.length === 0) {
      toast.error('Please select at least one entity to export');
      return;
    }

    selectedEntities.forEach(entity => {
      setTimeout(() => exportToCSV(entity), 100);
    });
  };


  const getSelectedCount = () => {
    return Object.values(entitySelection).filter(Boolean).length;
  };

  const getTotalRecords = () => {
    return Object.entries(reportData).reduce((total, [key, data]) => {
      if (entitySelection[key as keyof EntitySelection]) {
        return total + data.length;
      }
      return total;
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-indigo-100">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>
              Reports & Analytics
            </h2>
            <p className="text-gray-600">Generate comprehensive business reports and export data</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Range Picker */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
              <Calendar className="w-5 h-5 text-indigo-600" />
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Entity Selection */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
              <Filter className="w-5 h-5 text-indigo-600" />
              Data Entities
            </h3>
            <div className="space-y-3">
              {Object.entries(entitySelection).map(([entity, selected]) => (
                <label key={entity} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => setEntitySelection(prev => ({ ...prev, [entity]: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {entity.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({reportData[entity as keyof ReportData].length} records)
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Generate Report
              </>
            )}
          </button>

          <button
            onClick={exportAllToCSV}
            disabled={loading || getTotalRecords() === 0}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export Selected ({getSelectedCount()})
          </button>
        </div>
      </div>

      {/* Report Summary */}
      {getTotalRecords() > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
            <TrendingUp className="w-5 h-5 text-green-600" />
            Report Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {entitySelection.sales && reportData.sales.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Sales Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Revenue:</span>
                    <span className="font-bold">{formatCurrency(reportTotals.sales.total_selling)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Profit:</span>
                    <span className="font-bold text-green-600">{formatCurrency(reportTotals.sales.net_profit)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Records:</span>
                    <span>{reportData.sales.length}</span>
                  </div>
                </div>
              </div>
            )}

            {entitySelection.expenses && reportData.expenses.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Expenses Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Expenses:</span>
                    <span className="font-bold">{formatCurrency(reportTotals.expenses.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Records:</span>
                    <span>{reportData.expenses.length}</span>
                  </div>
                </div>
              </div>
            )}

            {entitySelection.saleItems && reportData.saleItems.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Sale Items Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Profit:</span>
                    <span className="font-bold">{formatCurrency(reportTotals.saleItems.profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Quantity:</span>
                    <span className="font-bold">{reportTotals.saleItems.quantity}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Records:</span>
                    <span>{reportData.saleItems.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Preview Tables */}
      {Object.entries(reportData).map(([entityType, data]) => {
        if (!entitySelection[entityType as keyof EntitySelection] || data.length === 0) return null;

        return (
          <div key={entityType} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>
                {entityType.replace(/([A-Z])/g, ' $1').trim()} ({data.length} records)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePreview(activePreview === entityType ? null : entityType as keyof EntitySelection)}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {activePreview === entityType ? 'Hide' : 'Preview'}
                </button>
                <button
                  onClick={() => exportToCSV(entityType as keyof EntitySelection)}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
            </div>

            {activePreview === entityType && (
              <div className="p-6">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {entityType === 'sales' && (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Sale ID</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Qty</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Unit Price</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Item Total</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Customer</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Phone</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Payment</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Delivery</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Deliver Date</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Sale Total</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Net Profit</th>
                          </>
                        )}
                        {entityType === 'saleItems' && (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Sale Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Quantity</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Selling Price</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Profit</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Vendor</th>
                          </>
                        )}
                        {entityType === 'expenses' && (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Amount</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Notes</th>
                          </>
                        )}
                        {entityType === 'vendorTransactions' && (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Vendor</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Sale Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Buying Price</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Vendor Paid</th>
                          </>
                        )}
                        {entityType === 'deliveryPayments' && (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Delivery Person</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Sale Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Delivery Fee</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Delivery Paid</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.slice(0, 10).map((row: any, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {entityType === 'sales' && (
                            <>
                              <td className="px-3 py-2 font-mono text-xs">{row.sale_id.slice(0, 8)}...</td>
                              <td className="px-3 py-2">{formatDate(row.date)}</td>
                              <td className="px-3 py-2 text-xs text-gray-600">{row.sale_time}</td>
                              <td className="px-3 py-2 font-medium">{row.product_name}</td>
                              <td className="px-3 py-2 text-right">{row.quantity}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.item_total)}</td>
                              <td className="px-3 py-2">{row.customer_name || '-'}</td>
                              <td className="px-3 py-2 text-xs text-gray-600">{row.customer_phone || '-'}</td>
                              <td className="px-3 py-2">{row.payment_method}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  row.delivery_status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {row.delivery_status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">{row.delivery_date || '-'}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.total_selling)}</td>
                              <td className="px-3 py-2 text-right font-bold text-green-600">{formatCurrency(row.net_profit)}</td>
                            </>
                          )}
                          {entityType === 'saleItems' && (
                            <>
                              <td className="px-3 py-2">{formatDate(row.sale_date)}</td>
                              <td className="px-3 py-2 font-medium">{row.product_name}</td>
                              <td className="px-3 py-2">{row.quantity}</td>
                              <td className="px-3 py-2">{formatCurrency(row.selling_price)}</td>
                              <td className="px-3 py-2 font-bold text-green-600">{formatCurrency(row.profit)}</td>
                              <td className="px-3 py-2">{row.vendor}</td>
                            </>
                          )}
                          {entityType === 'expenses' && (
                            <>
                              <td className="px-3 py-2">{formatDate(row.date)}</td>
                              <td className="px-3 py-2">{row.expense_type}</td>
                              <td className="px-3 py-2 font-medium text-red-600">{formatCurrency(row.amount)}</td>
                              <td className="px-3 py-2 text-xs">{row.notes}</td>
                            </>
                          )}
                          {entityType === 'vendorTransactions' && (
                            <>
                              <td className="px-3 py-2 font-medium">{row.vendor}</td>
                              <td className="px-3 py-2">{formatDate(row.sale_date)}</td>
                              <td className="px-3 py-2">{row.product_name}</td>
                              <td className="px-3 py-2">{formatCurrency(row.buying_price)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  row.vendor_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {row.vendor_paid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                            </>
                          )}
                          {entityType === 'deliveryPayments' && (
                            <>
                              <td className="px-3 py-2 font-medium">{row.delivery_person}</td>
                              <td className="px-3 py-2">{formatDate(row.sale_date)}</td>
                              <td className="px-3 py-2">{row.product_name}</td>
                              <td className="px-3 py-2">{formatCurrency(row.delivery_fee)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  row.delivery_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {row.delivery_paid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.length > 10 && (
                    <div className="text-center py-3 text-sm text-gray-500">
                      Showing first 10 of {data.length} records. Export to see all data.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {loading && <LoadingScreen />}
    </div>
  );
};

export default ReportsAnalytics;