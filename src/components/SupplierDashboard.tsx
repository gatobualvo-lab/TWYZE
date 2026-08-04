import React, { useState, useEffect } from 'react';
import { Users, DollarSign, AlertTriangle, TrendingUp, Calendar, Receipt, Eye, Trash2, Search, Filter, ChevronRight, ChevronDown, User, ChevronUp, Check } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';

interface Supplier {
  id: string;
  client: string;
  product: string;
  buying_price: number;
  selling_price: number;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: 'Paid' | 'Partial' | 'Pending' | 'Not Paid';
  date: string;
  profit: number;
  delivery_guy: string;
  tax_type: 'none' | 'vat' | 'turnover' | null;
  vat_amount: number | null;
  turnover_tax_amount: number | null;
  created_at: string;
}

const computePayment = (s: Supplier) => {
  const selling = s.selling_price || 0;
  const explicitPaid = s.amount_paid != null ? Number(s.amount_paid) : null;
  const explicitBalance = s.balance_due != null ? Number(s.balance_due) : null;

  let paid: number;
  if (explicitPaid != null) paid = explicitPaid;
  else paid = s.payment_status === 'Paid' ? selling : 0;

  let balance: number;
  if (explicitBalance != null) balance = explicitBalance;
  else balance = Math.max(0, selling - paid);

  return { paid, balance };
};

const SupplierDashboard: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientSummary, setClientSummary] = useState<{[key: string]: {
    totalSales: number;
    totalProfit: number;
    unpaidBalance: number;
    paidAmount: number;
    transactionCount: number;
    suppliers: {[key: string]: {
      totalSales: number;
      totalProfit: number;
      unpaidBalance: number;
      paidAmount: number;
      transactionCount: number;
      transactions: Supplier[];
    }};
  }}>({});

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (suppliers.length > 0) {
      calculateClientSummary();
      filterSuppliers();
    }
  }, [suppliers, searchTerm, filterStatus]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view supplier data');
        return;
      }

      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      toast.error(error.message || 'Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  const calculateClientSummary = () => {
    const summary: {[key: string]: any} = {};
    let owed = 0;
    let paid = 0;
    let profit = 0;
    
    suppliers.forEach(supplier => {
      const clientKey = supplier.client || 'Unknown Client';
      const productKey = supplier.product || 'Unspecified Product';

      if (!summary[clientKey]) {
        summary[clientKey] = {
          totalSales: 0,
          totalProfit: 0,
          unpaidBalance: 0,
          paidAmount: 0,
          transactionCount: 0,
          suppliers: {}
        };
      }

      if (!summary[clientKey].suppliers[productKey]) {
        summary[clientKey].suppliers[productKey] = {
          totalSales: 0,
          totalProfit: 0,
          unpaidBalance: 0,
          paidAmount: 0,
          transactionCount: 0,
          transactions: []
        };
      }

      const { paid: paidAmt, balance: balanceAmt } = computePayment(supplier);

      summary[clientKey].totalSales += supplier.selling_price;
      summary[clientKey].totalProfit += supplier.profit;
      summary[clientKey].transactionCount += 1;

      summary[clientKey].suppliers[productKey].totalSales += supplier.selling_price;
      summary[clientKey].suppliers[productKey].totalProfit += supplier.profit;
      summary[clientKey].suppliers[productKey].transactionCount += 1;
      summary[clientKey].suppliers[productKey].transactions.push(supplier);

      summary[clientKey].paidAmount += paidAmt;
      summary[clientKey].unpaidBalance += balanceAmt;
      summary[clientKey].suppliers[productKey].paidAmount += paidAmt;
      summary[clientKey].suppliers[productKey].unpaidBalance += balanceAmt;
      paid += paidAmt;
      owed += balanceAmt;

      profit += supplier.profit;
    });
    
    setClientSummary(summary);
    setTotalOwed(owed);
    setTotalPaid(paid);
    setTotalProfit(profit);
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(supplier =>
        (supplier.client ?? '').toLowerCase().includes(q) ||
        (supplier.product ?? '').toLowerCase().includes(q)
      );
    }

    // Status filter (treat any non-Paid status with outstanding balance as unpaid)
    if (filterStatus !== 'all') {
      filtered = filtered.filter(supplier => {
        const { balance } = computePayment(supplier);
        const isFullyPaid = supplier.payment_status === 'Paid' && balance <= 0;
        return filterStatus === 'paid' ? isFullyPaid : !isFullyPaid;
      });
    }

    setFilteredSuppliers(filtered);
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier transaction?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;

      setSuppliers(prev => prev.filter(supplier => supplier.id !== id));
      toast.success('Supplier transaction deleted successfully');
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier transaction');
    }
  };

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

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2" style={{ color: '#374151' }}>
          <Users className="w-5 h-5 text-green-600" />
          Sales to Clients Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">Total Amount Owed</p>
                <p className="text-3xl font-extrabold text-red-600">{formatCurrency(totalOwed)}</p>
                <p className="text-xs text-gray-500">Unpaid invoices</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">Total Paid</p>
                <p className="text-3xl font-extrabold text-green-600">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-gray-500">Received payments</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-blue-100">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">Total Profit</p>
                <p className="text-3xl font-extrabold text-blue-600">{formatCurrency(totalProfit)}</p>
                <p className="text-xs text-gray-500">All transactions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Breakdown */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
          <User className="w-5 h-5 text-green-600" />
          Client Breakdown
        </h2>
        
        {Object.keys(clientSummary).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(clientSummary).map(([client, stats]) => (
              <div 
                key={client} 
                className={`bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer ${
                  stats.unpaidBalance > 0 ? 'border-l-4 border-l-orange-400' : 'border-l-4 border-l-green-400'
                }`}
                onClick={() => setExpandedClient(expandedClient === client ? null : client)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800" style={{ color: '#374151' }}>{client}</h3>
                  <div className="flex items-center gap-2">
                    {stats.unpaidBalance > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    {expandedClient === client ? 
                      <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    }
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Purchases:</span>
                    <span className="font-bold text-right">{formatCurrency(stats.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payments Made:</span>
                    <span className="font-bold text-green-600 text-right">{formatCurrency(stats.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance Owed:</span>
                    <span className={`font-bold ${stats.unpaidBalance > 0 ? 'text-orange-600' : 'text-green-600'} text-right`}>
                      {formatCurrency(stats.unpaidBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-gray-500">{stats.transactionCount} transactions across {Object.keys(stats.suppliers).length} products</span>
                    <span className="text-blue-600 font-medium">
                      {expandedClient === client ? 'Hide Details' : 'View Details'}
                    </span>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedClient === client && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800 mb-3">Products sold to {client}</h4>
                    <div className="space-y-3">
                      {Object.entries(stats.suppliers).map(([productName, supplierStats]) => (
                        <div key={productName} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-800">{productName}</h5>
                            <span className="text-xs text-gray-500">{supplierStats.transactionCount} transactions</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                            <div>
                              <span className="text-gray-600">Total:</span>
                              <span className="float-right font-medium">{formatCurrency(supplierStats.totalSales)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Paid:</span>
                              <span className="float-right font-medium text-green-600">{formatCurrency(supplierStats.paidAmount)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Owed:</span>
                              <span className={`float-right font-medium ${supplierStats.unpaidBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {formatCurrency(supplierStats.unpaidBalance)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Profit:</span>
                              <span className={`float-right font-medium ${supplierStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(supplierStats.totalProfit)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Transaction list toggle button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSupplier(expandedSupplier === `${client}:${productName}` ? null : `${client}:${productName}`);
                            }}
                            className="w-full text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mt-1 pt-1 border-t border-gray-200"
                          >
                            {expandedSupplier === `${client}:${productName}` ? (
                              <>Hide Transactions <ChevronUp className="w-3 h-3" /></>
                            ) : (
                              <>Show Transactions <ChevronDown className="w-3 h-3" /></>
                            )}
                          </button>

                          {/* Transactions */}
                          {expandedSupplier === `${client}:${productName}` && (
                            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                              {supplierStats.transactions.map((transaction: Supplier) => (
                                <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                                  <div>
                                    <div className="font-medium">{transaction.product}</div>
                                    <div className="text-gray-500">{formatDate(transaction.date)}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold">{formatCurrency(transaction.selling_price)}</div>
                                    <div className={`text-xs ${transaction.payment_status === 'Paid' ? 'text-green-600' : 'text-orange-600'}`}>
                                      {transaction.payment_status}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <p className="text-gray-500">No supplier transactions found</p>
          </div>
        )}
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-md font-bold text-gray-800" style={{ color: '#374151' }}>Transaction Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Search clients, products..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'paid' | 'unpaid')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="paid">Fully Paid</option>
              <option value="unpaid">Outstanding (Partial / Pending)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Supplier Transactions Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>All Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-600">
                    No supplier transactions found
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const { paid: paidAmt, balance: balanceAmt } = computePayment(supplier);
                  const displayStatus =
                    supplier.payment_status === 'Paid' && balanceAmt <= 0
                      ? 'Paid'
                      : balanceAmt <= 0
                      ? 'Paid'
                      : paidAmt > 0
                      ? 'Partial'
                      : 'Pending';
                  const statusClass =
                    displayStatus === 'Paid'
                      ? 'bg-green-100 text-green-700'
                      : displayStatus === 'Partial'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-orange-100 text-orange-700';
                  return (
                    <tr key={supplier.id} className="hover:bg-gray-50 even:bg-gray-25">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(supplier.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {supplier.client}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {supplier.product}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(supplier.selling_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-700">
                        {formatCurrency(paidAmt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={balanceAmt > 0 ? 'text-amber-700' : 'text-gray-500'}>
                          {formatCurrency(balanceAmt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-extrabold ${supplier.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(supplier.profit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteSupplier(supplier.id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierDashboard;