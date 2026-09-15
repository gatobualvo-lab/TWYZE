import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, DollarSign, Users, Receipt, ChevronDown, Check, Trash2, ArrowRight, Settings, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import toast from 'react-hot-toast';
import { formatCurrency as formatKES, formatDate } from '../utils/format';
import BusinessHealthScore from './analytics/BusinessHealthScore';
import { listTasks, createTask, toggleTaskCompleted, deleteTask as deleteTaskRecord } from '../services/tasks/taskService';
import type { BusinessTask } from '../services/tasks/taskService';
import { Skeleton, SkeletonStatGrid, SkeletonList } from './ui';
import OnboardingChecklist from './onboarding/OnboardingChecklist';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DashboardHomeProps {
  userName: string;
  onNavigate: (tab: string) => void;
}

interface DashboardPrefs {
  show_kpi_cards: boolean;
  show_chart: boolean;
  show_recent_sales: boolean;
  show_attention: boolean;
  show_tasks: boolean;
}

interface RecentSale {
  id: string;
  date: string | null;
  client_name: string | null;
  selling_price: number | null;
  product_name: string | null;
}

const DEFAULT_PREFS: DashboardPrefs = {
  show_kpi_cards: true,
  show_chart: true,
  show_recent_sales: true,
  show_attention: true,
  show_tasks: true,
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const DashboardHome: React.FC<DashboardHomeProps> = ({ userName, onNavigate }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);

  // KPI data
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [outstandingBalances, setOutstandingBalances] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);

  // Chart data
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });

  // Recent sales
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  // Attention items
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [lowStockItems, setLowStockItems] = useState(0);
  const [outstandingCustomers, setOutstandingCustomers] = useState(0);

  // Tasks
  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState('general');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Fetch preferences
      const { data: prefsData } = await supabase
        .from('dashboard_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prefsData) {
        setPrefs({
          show_kpi_cards: prefsData.show_kpi_cards ?? true,
          show_chart: prefsData.show_chart ?? true,
          show_recent_sales: prefsData.show_recent_sales ?? true,
          show_attention: prefsData.show_attention ?? true,
          show_tasks: prefsData.show_tasks ?? true,
        });
      }

      // Fetch today's sales
      const { data: todaySalesData } = await supabase
        .from('sales')
        .select('selling_price, profit')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .eq('date', today);

      const salesTotal = (todaySalesData || []).reduce((sum, s) => sum + safeNum(s.selling_price), 0);
      const profitTotal = (todaySalesData || []).reduce((sum, s) => sum + safeNum(s.profit), 0);
      setTodaySales(salesTotal);
      setTodayProfit(profitTotal);

      // Outstanding balances (unpaid sales)
      const { data: unpaidSales } = await supabase
        .from('sales')
        .select('selling_price')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .eq('payment_status', 'Unpaid');
      setOutstandingBalances((unpaidSales || []).reduce((sum, s) => sum + safeNum(s.selling_price), 0));

      // Today's expenses (vendor + ad expenses)
      const { data: vendorExpData, error: vendorExpError } = await supabase
        .from('vendor_expenses')
        .select('amount_kes')
        .eq('created_by', user.id)
        .eq('is_deleted', false)
        .eq('occurred_on', today);
      if (vendorExpError) console.error('Today vendor expenses error:', vendorExpError);
      const { data: adExpData, error: adExpError } = await supabase
        .from('ad_expenses')
        .select('amount_kes')
        .eq('created_by', user.id)
        .eq('is_deleted', false)
        .eq('occurred_on', today);
      if (adExpError) console.error('Today ad expenses error:', adExpError);
      const vendorTotal = (vendorExpData || []).reduce((sum, e) => sum + safeNum(e.amount_kes), 0);
      const adTotal = (adExpData || []).reduce((sum, e) => sum + safeNum(e.amount_kes), 0);
      setTodayExpenses(vendorTotal + adTotal);

      // Chart: last 30 days sales & profit
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: chartSales } = await supabase
        .from('sales')
        .select('date, selling_price, profit')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .gte('date', startDate)
        .order('date', { ascending: true });

      buildChartData(chartSales || [], startDate);

      // Recent sales
      const { data: recent } = await supabase
        .from('sales')
        .select('id, date, client_name, selling_price, product_name')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .order('date', { ascending: false })
        .limit(5);
      setRecentSales(recent || []);

      // Attention: pending deliveries
      const { count: deliveryCount } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .eq('delivery_status', 'Pending');
      setPendingDeliveries(deliveryCount || 0);

      // Low stock
      const { count: lowCount } = await supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .lte('current_stock', 5);
      setLowStockItems(lowCount || 0);

      // Outstanding customers count
      const { data: custData } = await supabase
        .from('sales')
        .select('client_name')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .eq('payment_status', 'Unpaid')
        .not('client_name', 'is', null);
      const uniqueCustomers = new Set((custData || []).map(s => s.client_name?.toLowerCase()).filter(Boolean));
      setOutstandingCustomers(uniqueCustomers.size);

      // Tasks
      const tasksData = await listTasks();
      setTasks(tasksData);

    } catch (err) {
      console.error('Dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const buildChartData = (sales: any[], startDate: string) => {
    const days: string[] = [];
    const salesByDay: Record<string, number> = {};
    const profitByDay: Record<string, number> = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      days.push(key);
      salesByDay[key] = 0;
      profitByDay[key] = 0;
    }

    sales.forEach(s => {
      if (salesByDay[s.date] !== undefined) {
        salesByDay[s.date] += safeNum(s.selling_price);
        profitByDay[s.date] += safeNum(s.profit);
      }
    });

    const labels = days.map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Sales',
          data: days.map(d => salesByDay[d]),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Profit',
          data: days.map(d => profitByDay[d]),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    });
  };

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const created = await createTask({ title: newTaskTitle.trim(), taskType: newTaskType, dueDate: newTaskDueDate || null });
      setTasks(prev => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      toast.success('Task added');
    } catch {
      toast.error('Failed to add task');
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await toggleTaskCompleted(id, completed);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
  };

  const deleteTask = async (id: string) => {
    await deleteTaskRecord(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const savePrefs = async (newPrefs: DashboardPrefs) => {
    setPrefs(newPrefs);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('dashboard_preferences').upsert({
      user_id: user.id,
      ...newPrefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  };

  const isDark = theme === 'dark';
  const cardClass = `rounded-xl border p-5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
    isDark ? 'bg-slate-800 border-slate-700 hover:shadow-lg hover:shadow-black/20' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
  }`;
  const sectionTitle = `text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`;

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <SkeletonStatGrid />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <SkeletonList rows={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingChecklist onNavigate={onNavigate} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {getGreeting()}, {userName.split(' ')[0] || 'there'}
          </h1>
          <p className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Here's today's business overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Quick Add
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickAdd ? 'rotate-180' : ''}`} />
            </button>
            {showQuickAdd && (
              <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-20 py-1 origin-top-right animate-scale-in ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
              }`}>
                {[
                  { label: 'Add Sale', tab: 'add-sale', icon: ShoppingCart },
                  { label: 'Add Expense', tab: 'general-expenses', icon: DollarSign },
                  { label: 'Add Delivery', tab: 'delivery-payments', icon: Truck },
                  { label: 'Add Supplier Sale', tab: 'add-supplier', icon: Users },
                ].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => { onNavigate(item.tab); setShowQuickAdd(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                      isDark ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4 text-blue-500" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className={`p-2.5 rounded-lg border transition-colors ${
              isDark ? 'border-slate-700 hover:bg-slate-700 text-gray-400' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
            }`}
            title="Customize Dashboard"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BusinessHealthScore />

      {/* Customize Panel */}
      {showCustomize && (
        <div className={`rounded-xl border p-4 animate-slide-up ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Show on Dashboard</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'show_kpi_cards', label: 'KPI Cards' },
              { key: 'show_chart', label: 'Sales & Profit Chart' },
              { key: 'show_recent_sales', label: 'Recent Sales' },
              { key: 'show_attention', label: 'Attention Needed' },
              { key: 'show_tasks', label: 'Business Tasks' },
            ].map(item => (
              <label key={item.key} className={`flex items-center gap-2 text-sm cursor-pointer px-3 py-1.5 rounded-lg border ${
                prefs[item.key as keyof DashboardPrefs]
                  ? isDark ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                  : isDark ? 'border-slate-600 text-gray-400' : 'border-gray-200 text-gray-500'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs[item.key as keyof DashboardPrefs]}
                  onChange={() => savePrefs({ ...prefs, [item.key]: !prefs[item.key as keyof DashboardPrefs] })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  prefs[item.key as keyof DashboardPrefs]
                    ? 'bg-blue-600 border-blue-600' : isDark ? 'border-slate-500' : 'border-gray-300'
                }`}>
                  {prefs[item.key as keyof DashboardPrefs] && <Check className="w-3 h-3 text-white" />}
                </div>
                {item.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {prefs.show_kpi_cards && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { tab: 'view-sales', bg: 'bg-blue-500/10', icon: TrendingUp, iconColor: 'text-blue-600', label: "Today's Sales", value: todaySales },
            { tab: 'monthly-dashboard', bg: 'bg-emerald-500/10', icon: DollarSign, iconColor: 'text-emerald-600', label: "Today's Profit", value: todayProfit },
            { tab: 'clients', bg: 'bg-amber-500/10', icon: Users, iconColor: 'text-amber-600', label: 'Outstanding', value: outstandingBalances },
            { tab: 'general-expenses', bg: 'bg-rose-500/10', icon: Receipt, iconColor: 'text-rose-600', label: "Today's Expenses", value: todayExpenses },
          ].map((kpi, i) => (
            <div
              key={kpi.tab}
              className={`${cardClass} animate-slide-up group`}
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              onClick={() => onNavigate(kpi.tab)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${kpi.bg} transition-transform duration-200 group-hover:scale-110`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                  <p className={`text-xl font-bold truncate tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatKES(kpi.value)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart + Recent Sales Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart */}
        {prefs.show_chart && (
          <div className={`lg:col-span-2 rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h2 className={sectionTitle}>Sales & Profit</h2>
            <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Last 30 days</p>
            <div className="h-56">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { intersect: false, mode: 'index' },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)' },
                      ticks: {
                        color: isDark ? '#64748b' : '#9ca3af',
                        callback: (v) => 'KES ' + Number(v).toLocaleString(),
                        font: { size: 11 },
                      },
                      border: { display: false },
                    },
                    x: {
                      grid: { display: false },
                      ticks: {
                        color: isDark ? '#64748b' : '#9ca3af',
                        maxTicksLimit: 7,
                        font: { size: 11 },
                      },
                      border: { display: false },
                    },
                  },
                  plugins: {
                    legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle', color: isDark ? '#94a3b8' : '#6b7280', font: { size: 12 } } },
                    tooltip: {
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      titleColor: isDark ? '#f1f5f9' : '#111827',
                      bodyColor: isDark ? '#cbd5e1' : '#374151',
                      borderColor: isDark ? '#334155' : '#e5e7eb',
                      borderWidth: 1,
                      callbacks: { label: (ctx) => `${ctx.dataset.label}: KES ${ctx.parsed.y.toLocaleString()}` },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}

        {/* Recent Sales */}
        {prefs.show_recent_sales && (
          <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={sectionTitle}>Recent Sales</h2>
            </div>
            {recentSales.length === 0 ? (
              <p className={`text-sm py-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No sales recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map(sale => (
                  <div key={sale.id} className={`flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b last:border-0 transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-50 hover:bg-gray-50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {sale.client_name || sale.product_name || 'Sale'}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {formatDate(sale.date, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                      {formatKES(safeNum(sale.selling_price))}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onNavigate('view-sales')}
              className="group flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-4 w-full justify-center"
            >
              View all sales <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>

      {/* Attention + Tasks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attention Needed */}
        {prefs.show_attention && (
          <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h2 className={sectionTitle}>Attention Needed</h2>
            {pendingDeliveries === 0 && lowStockItems === 0 && outstandingCustomers === 0 ? (
              <div className={`flex items-center gap-3 mt-4 py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 animate-pop-check">
                  <Check className="w-4 h-4 text-green-600" />
                </span>
                <p className="text-sm">Everything looks good today.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {pendingDeliveries > 0 && (
                  <button onClick={() => onNavigate('delivery-payments')} className={`group w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{pendingDeliveries} pending {pendingDeliveries === 1 ? 'delivery' : 'deliveries'}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                )}
                {lowStockItems > 0 && (
                  <button onClick={() => onNavigate('inventory')} className={`group w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{lowStockItems} low stock {lowStockItems === 1 ? 'item' : 'items'}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                )}
                {outstandingCustomers > 0 && (
                  <button onClick={() => onNavigate('clients')} className={`group w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{outstandingCustomers} {outstandingCustomers === 1 ? 'customer' : 'customers'} with outstanding balance</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Business Tasks */}
        {prefs.show_tasks && (
          <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h2 className={sectionTitle}>Business Tasks</h2>
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task..."
                className={`flex-1 text-sm px-3 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder:text-gray-500' : 'border-gray-200 placeholder:text-gray-400'
                }`}
              />
              <button onClick={addTask} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium flex-shrink-0">
                Add
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <select
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                className={`text-xs px-2 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
                }`}
              >
                <option value="general">General</option>
                <option value="follow_up">Follow up</option>
                <option value="pay_supplier">Pay supplier</option>
                <option value="restock">Restock</option>
                <option value="deliver">Deliver</option>
              </select>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                title="Due date (optional) — shows this task on the Business Calendar"
                className={`text-xs px-2 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
                }`}
              />
            </div>
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className={`text-sm py-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No tasks yet.</p>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg group animate-scale-in transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                    <button onClick={() => toggleTask(task.id, task.completed)} className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-150 active:scale-90 ${
                      task.completed ? 'bg-blue-600 border-blue-600' : isDark ? 'border-slate-500 hover:border-blue-400' : 'border-gray-300 hover:border-blue-400'
                    }`}>
                      {task.completed && <Check className="w-3 h-3 text-white animate-pop-check" />}
                    </button>
                    <span className={`flex-1 text-sm ${task.completed ? 'line-through opacity-50' : ''} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-600 text-gray-400' : 'bg-gray-100 text-gray-400'}`}>
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-600 text-gray-400' : 'bg-gray-100 text-gray-400'}`}>
                      {task.taskType.replace('_', ' ')}
                    </span>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
