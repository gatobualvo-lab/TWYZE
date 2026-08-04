import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, DollarSign, BarChart3, PieChart, Target, Download } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';

interface MonthlyData {
  month: string;
  salesRevenue: number;
  salesProfit: number;
  adExpenses: number;
  generalExpenses: number;
  netProfit: number;
  salesCount: number;
  supplierRevenue: number;
  supplierProfit: number;
}

const MonthlyDashboard: React.FC = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchMonthlyData();
  }, [selectedYear]);

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view dashboard');
        return;
      }

      // Generate months for the selected year
      const months = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(selectedYear, i, 1);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        months.push({
          month: monthKey,
          salesRevenue: 0,
          salesProfit: 0,
          adExpenses: 0,
          generalExpenses: 0,
          netProfit: 0,
          salesCount: 0,
          supplierRevenue: 0,
          supplierProfit: 0
        });
      }

      // Fetch sales data
      const { data: salesData } = await supabase
        .from('sales')
        .select('selling_price, profit, date')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

      // Fetch supplier data
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('selling_price, profit, date')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

      // Fetch ad expenses
      const { data: adExpensesData } = await supabase
        .from('ad_expenses')
        .select('amount, date')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

      // Fetch general expenses
      const { data: generalExpensesData } = await supabase
        .from('general_expenses')
        .select('amount, date')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

      // Process data by month
      months.forEach(monthData => {
        // Sales data
        const monthSales = salesData?.filter(sale => sale.date.startsWith(monthData.month)) || [];
        monthData.salesRevenue = monthSales.reduce((sum, sale) => sum + sale.selling_price, 0);
        monthData.salesProfit = monthSales.reduce((sum, sale) => sum + sale.profit, 0);
        monthData.salesCount = monthSales.length;

        // Supplier data
        const monthSuppliers = supplierData?.filter(supplier => supplier.date.startsWith(monthData.month)) || [];
        monthData.supplierRevenue = monthSuppliers.reduce((sum, supplier) => sum + supplier.selling_price, 0);
        monthData.supplierProfit = monthSuppliers.reduce((sum, supplier) => sum + supplier.profit, 0);

        // Ad expenses
        const monthAdExpenses = adExpensesData?.filter(expense => expense.date.startsWith(monthData.month)) || [];
        monthData.adExpenses = monthAdExpenses.reduce((sum, expense) => sum + expense.amount, 0);

        // General expenses
        const monthGeneralExpenses = generalExpensesData?.filter(expense => expense.date.startsWith(monthData.month)) || [];
        monthData.generalExpenses = monthGeneralExpenses.reduce((sum, expense) => sum + expense.amount, 0);

        // Calculate net profit
        monthData.netProfit = monthData.salesProfit + monthData.supplierProfit - monthData.adExpenses - monthData.generalExpenses;
      });

      setMonthlyData(months);
    } catch (error: any) {
      console.error('Error fetching monthly data:', error);
      toast.error(error.message || 'Failed to load monthly data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: unknown) => {
    const n = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(Number.isFinite(n) ? n : 0);
  };

  const formatMonth = (monthString: string) => {
    return new Date(monthString + '-01').toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Calculate totals for the year
  const yearTotals = monthlyData.reduce((totals, month) => ({
    salesRevenue: totals.salesRevenue + month.salesRevenue,
    salesProfit: totals.salesProfit + month.salesProfit,
    adExpenses: totals.adExpenses + month.adExpenses,
    generalExpenses: totals.generalExpenses + month.generalExpenses,
    netProfit: totals.netProfit + month.netProfit,
    salesCount: totals.salesCount + month.salesCount,
    supplierRevenue: totals.supplierRevenue + month.supplierRevenue,
    supplierProfit: totals.supplierProfit + month.supplierProfit
  }), {
    salesRevenue: 0,
    salesProfit: 0,
    adExpenses: 0,
    generalExpenses: 0,
    netProfit: 0,
    salesCount: 0,
    supplierRevenue: 0,
    supplierProfit: 0
  });

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ color: '#374151' }}>
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Monthly Business Dashboard
          </h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Year Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-blue-100">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-extrabold text-blue-600">
                {formatCurrency(yearTotals.salesRevenue + yearTotals.supplierRevenue)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-green-100">
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Gross Profit</p>
              <p className="text-3xl font-extrabold text-green-600">
                {formatCurrency(yearTotals.salesProfit + yearTotals.supplierProfit)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-red-100">
              <BarChart3 className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-3xl font-extrabold text-red-600">
                {formatCurrency(yearTotals.adExpenses + yearTotals.generalExpenses)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-purple-100">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Net Profit</p>
              <p className={`text-3xl font-extrabold ${yearTotals.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {formatCurrency(yearTotals.netProfit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>Monthly Breakdown</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200">
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyData.map((month) => (
                <tr key={month.month} className="hover:bg-gray-50 even:bg-gray-25">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatMonth(month.month)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="text-right font-medium">{formatCurrency(month.salesRevenue)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="text-right font-medium">{formatCurrency(month.supplierRevenue)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-extrabold text-right">
                    {formatCurrency(month.salesProfit + month.supplierProfit)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium text-right">
                    {formatCurrency(month.adExpenses + month.generalExpenses)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-extrabold text-right">
                    <span className={month.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}>
                      {formatCurrency(month.netProfit)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {month.salesCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Revenue Trend
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart visualization would go here
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
            <PieChart className="w-5 h-5 text-green-600" />
            Expense Breakdown
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart visualization would go here
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyDashboard;