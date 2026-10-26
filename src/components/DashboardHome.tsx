import { getAccountCurrency } from '../utils/accountCurrency';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, DollarSign, Users, Receipt, ChevronDown, Check, Trash2, ArrowRight, Settings, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import toast from 'react-hot-toast';
import { formatCurrency as formatKES, formatDate } from '../utils/format';
import { getPeriodRange } from '../utils/dateRange';
import BusinessHealthScore from './analytics/BusinessHealthScore';
import { listTasks, createTask, toggleTaskCompleted, deleteTask as deleteTaskRecord } from '../services/tasks/taskService';
import { REMINDER_OPTIONS, formatDueTime } from '../services/tasks/reminders';
import CountUp from './ui/CountUp';
import Spinner from './ui/Spinner';
import Sparkline from './ui/Sparkline';
import { useRotatingMessage } from './LoadingScreen';
import { ensureNotificationPermission } from '../services/tasks/useTaskReminders';
import type { BusinessTask } from '../services/tasks/taskService';
import { Skeleton, SkeletonStatGrid, SkeletonList } from './ui';
import OnboardingChecklist from './onboarding/OnboardingChecklist';
import { getCategoryConfig } from '../constants/businessCategory';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DashboardHomeProps {
  userName: string;
  onNavigate: (tab: string) => void;
  businessCategory?: string | null;
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

const DashboardHome: React.FC<DashboardHomeProps> = ({ userName, onNavigate, businessCategory }) => {
  const { theme } = useTheme();
  const categoryConfig = getCategoryConfig(businessCategory);
  const saleNounPlural = `${categoryConfig.saleNounSingular}s`;
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);

  // KPI data
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [weekGrossProfit, setWeekGrossProfit] = useState(0);
  const [weekGrossProfitChangePct, setWeekGrossProfitChangePct] = useState<number | null>(null);
  const [monthNetProfit, setMonthNetProfit] = useState(0);
  const [monthNetProfitChangePct, setMonthNetProfitChangePct] = useState<number | null>(null);
  const [weekExpenses, setWeekExpenses] = useState(0);
  const [weekExpensesChangePct, setWeekExpensesChangePct] = useState<number | null>(null);

  // Chart data
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const chartHasData = (chartData.datasets ?? []).some((d: { data: number[] }) => d.data.some((v: number) => v > 0));
  // Recent trend lines for the KPI cards, from the same daily numbers the chart uses.
  const salesSeries: number[] = chartData.datasets?.[0]?.data ?? [];
  const profitSeries: number[] = chartData.datasets?.[1]?.data ?? [];
  // Plain-language version of the chart for screen readers (and anyone who can't make out the lines).
  const chartSummary = (() => {
    const [sales, profit] = chartData.datasets ?? [];
    if (!sales || !chartHasData) return 'Sales and profit chart for the last 30 days. No data yet.';
    const total = (d?: { data: number[] }) => (d ? d.data.reduce((a: number, b: number) => a + b, 0) : 0);
    const peakIndex = sales.data.indexOf(Math.max(...sales.data));
    return `Sales and profit for the last 30 days. Sales total ${formatKES(total(sales))}, profit total ${formatKES(total(profit))}. Best day was ${chartData.labels[peakIndex]} with ${formatKES(sales.data[peakIndex])} in sales. Sales is the solid line; profit is the dashed line.`;
  })();

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
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskRemind, setNewTaskRemind] = useState<number | null>(null);

  // A fill that fades from the line colour down to nothing, built from the chart's own canvas.
  const areaGradient = (rgb: string) => (context: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return `rgba(${rgb}, 0.12)`;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `rgba(${rgb}, 0.32)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    return gradient;
  };

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

      // Fetch today's sales — order count comes free from the same query,
      // no need for a separate count-only round trip.
      const { data: todaySalesData } = await supabase
        .from('sales')
        .select('selling_price')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .eq('date', today);

      setTodaySales((todaySalesData || []).reduce((sum, s) => sum + safeNum(s.selling_price), 0));
      setTodayOrderCount((todaySalesData || []).length);

      // This Week's Gross Profit + Expenses, This Month's Net Profit, each
      // paired with its prior-period equivalent for a "vs last week/month"
      // trend — all from the same get_business_metrics RPC already used by
      // Cash Position/AI Assistant/Reports, just called per period rather
      // than re-deriving the expense/profit math a third time here.
      const weekRange = getPeriodRange('week');
      const monthRange = getPeriodRange('month');
      const lastWeekEnd = new Date(weekRange.start);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      const lastWeekRange = getPeriodRange('week', lastWeekEnd);
      const lastMonthEnd = new Date(monthRange.start);
      lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
      const lastMonthRange = getPeriodRange('month', lastMonthEnd);

      const [
        { data: weekMetrics, error: weekError },
        { data: lastWeekMetrics, error: lastWeekError },
        { data: monthMetrics, error: monthError },
        { data: lastMonthMetrics, error: lastMonthError },
      ] = await Promise.all([
        supabase.rpc('get_business_metrics', { p_start: weekRange.start, p_end: weekRange.end }),
        supabase.rpc('get_business_metrics', { p_start: lastWeekRange.start, p_end: lastWeekRange.end }),
        supabase.rpc('get_business_metrics', { p_start: monthRange.start, p_end: monthRange.end }),
        supabase.rpc('get_business_metrics', { p_start: lastMonthRange.start, p_end: lastMonthRange.end }),
      ]);
      if (weekError) console.error('Week metrics error:', weekError);
      if (lastWeekError) console.error('Last week metrics error:', lastWeekError);
      if (monthError) console.error('Month metrics error:', monthError);
      if (lastMonthError) console.error('Last month metrics error:', lastMonthError);

      // % change vs prior period — only shown when the prior period had a
      // real positive baseline to compare against. A negative/zero baseline
      // makes a percentage meaningless or actively misleading (e.g. -1000 ->
      // 500 isn't "-150%"), same reasoning as Business Health's revenue
      // trend factor, which is excluded rather than fabricated in that case.
      const pctChange = (current: number, previous: number): number | null =>
        previous > 0 ? ((current - previous) / previous) * 100 : null;

      const weekGross = safeNum(weekMetrics?.[0]?.gross_profit);
      const lastWeekGross = safeNum(lastWeekMetrics?.[0]?.gross_profit);
      setWeekGrossProfit(weekGross);
      setWeekGrossProfitChangePct(pctChange(weekGross, lastWeekGross));

      const monthNet = safeNum(monthMetrics?.[0]?.net_profit);
      const lastMonthNet = safeNum(lastMonthMetrics?.[0]?.net_profit);
      setMonthNetProfit(monthNet);
      setMonthNetProfitChangePct(pctChange(monthNet, lastMonthNet));

      const weekExp = safeNum(weekMetrics?.[0]?.total_expenses);
      const lastWeekExp = safeNum(lastWeekMetrics?.[0]?.total_expenses);
      setWeekExpenses(weekExp);
      setWeekExpensesChangePct(pctChange(weekExp, lastWeekExp));

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

      // Low stock — compared against each item's own reorder_level (set on
      // Inventory), not a flat number. An item with no reorder_level set
      // only flags once it's genuinely at 0, never a false alarm off a
      // threshold the owner never configured for that product.
      const { data: stockData } = await supabase
        .from('inventory_items')
        .select('current_stock, reorder_level')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .neq('item_type', 'service');
      const lowCount = (stockData || []).filter(item => safeNum(item.current_stock) <= safeNum(item.reorder_level)).length;
      setLowStockItems(lowCount);

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
      // Supabase returns `date` as a full timestamp string
      // ("2026-08-20T00:00:00+00:00"), not the bare "YYYY-MM-DD" these
      // buckets are keyed by — slice it down before matching, otherwise
      // the string comparison never matches and every sale is silently
      // dropped from the chart.
      const dayKey = typeof s.date === 'string' ? s.date.slice(0, 10) : s.date;
      if (salesByDay[dayKey] !== undefined) {
        salesByDay[dayKey] += safeNum(s.selling_price);
        profitByDay[dayKey] += safeNum(s.profit);
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
          borderColor: '#0e9f6e',
          borderWidth: 2.5,
          backgroundColor: areaGradient('14, 159, 110'),
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Profit',
          data: days.map(d => profitByDay[d]),
          borderColor: '#f5a524',
          borderWidth: 2.5,
          borderDash: [7, 5],
          backgroundColor: areaGradient('245, 165, 36'),
          fill: true,
          tension: 0.38,
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
      const wantsReminder = newTaskRemind !== null && !!newTaskDueDate;
      const created = await createTask({
        title: newTaskTitle.trim(),
        taskType: newTaskType,
        dueDate: newTaskDueDate || null,
        dueTime: newTaskDueTime || null,
        remindMinutesBefore: wantsReminder ? newTaskRemind : null,
      });
      setTasks(prev => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setNewTaskDueTime('');
      setNewTaskRemind(null);
      toast.success(wantsReminder ? 'Task added. You will be reminded' : 'Task added');
      if (wantsReminder) ensureNotificationPermission();
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
  const cardClass = `spotlight rounded-2xl border p-5 transition-all duration-300 ease-smooth cursor-pointer hover:-translate-y-1 active:translate-y-0 ${
    isDark ? 'bg-slate-800 border-slate-700 hover:shadow-lg hover:shadow-black/30' : 'bg-white border-gray-200/70 shadow-sm hover:shadow-lg hover:border-blue-200'
  }`;
  const sectionTitle = `text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`;
  const loadingMessage = useRotatingMessage();

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading your dashboard">
        {/* Same shape as the real hero, so nothing jumps when the numbers arrive */}
        <div className="relative rounded-3xl mesh-brand text-white shadow-xl overflow-hidden animate-reveal-up">
          <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-60" />
          <div aria-hidden="true" className="absolute -right-8 -top-12 w-64 h-64 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="skeleton-on-dark h-3 w-40 rounded-full" />
              <div className="skeleton-on-dark h-9 w-72 max-w-full rounded-xl" />
              <div className="flex items-center gap-2.5 pt-1">
                <Spinner tone="light" className="w-4 h-4" label="Loading dashboard" />
                <span key={loadingMessage} className="text-sm text-white/75 animate-fade-in">{loadingMessage}</span>
              </div>
            </div>
            <div className="flex items-end gap-6">
              <div className="space-y-2">
                <div className="skeleton-on-dark h-3 w-24 rounded-full" />
                <div className="skeleton-on-dark h-9 w-40 rounded-xl" />
              </div>
              <div className="h-12 w-36 rounded-xl bg-gradient-to-b from-accent-400 to-accent-600 opacity-60 animate-pulse" />
            </div>
          </div>
        </div>
        <SkeletonStatGrid />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/70 p-5">
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3 w-24 mb-5" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
            <SkeletonList rows={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-soft">
      <OnboardingChecklist onNavigate={onNavigate} />

      {/* Hero: greeting, today's headline number, and the main action */}
      {/* z-10: each section below animates in and so forms its own layer; without this the
          Quick Add menu (inside the hero) would be painted underneath the cards that follow. */}
      <div className="relative z-10 rounded-3xl mesh-brand text-white shadow-xl animate-reveal-up">
        <div aria-hidden="true" className="absolute inset-0 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-dots opacity-60" />
          <div className="absolute -right-8 -top-12 w-64 h-64 rounded-full bg-accent-400/25 blur-3xl" />
          <div className="absolute -left-10 -bottom-16 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
        </div>
        <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-1.5 tracking-tight text-white">
              {getGreeting()}, <span className="text-gradient">{userName.split(' ')[0] || 'there'}</span>
            </h1>
            <p className="mt-1 text-white/70">Here's today's business overview.</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-medium text-white/60">Today's {categoryConfig.salesLabel}</p>
              <p className="font-display text-3xl sm:text-4xl font-extrabold tabular-nums leading-tight">
                <CountUp value={todaySales} format={formatKES} />
              </p>
              {todayOrderCount > 0 && (
                <p className="text-xs text-white/60">
                  {todayOrderCount} {todayOrderCount === 1 ? categoryConfig.saleNounSingular : saleNounPlural} today
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="sheen-host flex items-center gap-2 px-5 py-3 bg-gradient-to-b from-accent-300 to-accent-500 hover:shadow-glow-accent text-gray-900 rounded-xl font-bold shadow-md shadow-inset transition-all duration-200 ease-smooth active:scale-[0.97] text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Quick Add
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickAdd ? 'rotate-180' : ''}`} />
                </button>
                {showQuickAdd && (
                  <div className={`absolute right-0 mt-2 w-52 rounded-xl shadow-xl border z-30 py-1.5 origin-top-right animate-scale-in ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}>
                    {[
                      { label: categoryConfig.addSaleLabel, tab: 'add-sale', icon: ShoppingCart },
                      { label: 'Add Expense', tab: 'general-expenses', icon: DollarSign },
                      { label: 'Add Delivery', tab: 'delivery-payments', icon: Truck },
                      { label: 'Add Supplier Sale', tab: 'add-supplier', icon: Users },
                    ].map(item => (
                      <button
                        key={item.tab}
                        onClick={() => { onNavigate(item.tab); setShowQuickAdd(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                          isDark ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-blue-50'
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
                className="p-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title="Customize Dashboard"
                aria-label="Customize dashboard"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
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
              { key: 'show_chart', label: `${categoryConfig.salesLabel} & Profit Chart` },
              { key: 'show_recent_sales', label: `Recent ${categoryConfig.salesLabel}` },
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-stagger">
          {([
            {
              tab: 'view-sales', bg: 'bg-blue-500/12', icon: TrendingUp, iconColor: 'text-blue-600',
              label: `Today's ${categoryConfig.salesLabel}`, value: todaySales, spark: salesSeries.slice(-7), sparkColor: '#0e9f6e',
              sub: todayOrderCount > 0 ? `${todayOrderCount} ${todayOrderCount === 1 ? categoryConfig.saleNounSingular : saleNounPlural} today` : null,
              subTone: 'neutral',
            },
            {
              tab: 'monthly-dashboard', bg: 'bg-emerald-500/10', icon: DollarSign, iconColor: 'text-emerald-600',
              label: "This Week's Gross Profit", value: weekGrossProfit, spark: profitSeries.slice(-7), sparkColor: '#0e9f6e',
              sub: weekGrossProfitChangePct !== null ? `${weekGrossProfitChangePct >= 0 ? '+' : ''}${weekGrossProfitChangePct.toFixed(0)}% vs last week` : null,
              subTone: weekGrossProfitChangePct !== null && weekGrossProfitChangePct >= 0 ? 'good' : 'bad',
            },
            {
              tab: 'monthly-dashboard', bg: 'bg-amber-500/10', icon: TrendingUp, iconColor: 'text-amber-600',
              label: "This Month's Net Profit", value: monthNetProfit, spark: profitSeries, sparkColor: '#f5a524',
              sub: monthNetProfitChangePct !== null ? `${monthNetProfitChangePct >= 0 ? '+' : ''}${monthNetProfitChangePct.toFixed(0)}% vs last month` : null,
              subTone: monthNetProfitChangePct !== null && monthNetProfitChangePct >= 0 ? 'good' : 'bad',
            },
            {
              tab: 'general-expenses', bg: 'bg-rose-500/10', icon: Receipt, iconColor: 'text-rose-600',
              label: "This Week's Expenses", value: weekExpenses,
              sub: weekExpensesChangePct !== null ? `${weekExpensesChangePct >= 0 ? '+' : ''}${weekExpensesChangePct.toFixed(0)}% vs last week` : null,
              // Inverted: lower expenses is the good direction, unlike the two profit cards above.
              subTone: weekExpensesChangePct !== null && weekExpensesChangePct <= 0 ? 'good' : 'bad',
            },
          ] as Array<{ tab: string; bg: string; icon: typeof TrendingUp; iconColor: string; label: string; value: number; sub: string | null; subTone: 'good' | 'bad' | 'neutral'; spark?: number[]; sparkColor?: string }>).map((kpi, i) => (
            <div
              key={kpi.label}
              className={`${cardClass} animate-[soft-rise_0.55s_cubic-bezier(0.16,1,0.3,1)_both] group`}
              style={{ animationDelay: `${120 + i * 55}ms` }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
              onClick={() => onNavigate(kpi.tab)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${kpi.bg} transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-3`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                  <p className={`font-display text-xl font-extrabold truncate tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}><CountUp value={kpi.value} format={formatKES} /></p>
                  {kpi.sub && (
                    <p className={`text-xs mt-0.5 truncate ${
                      kpi.subTone === 'good' ? 'text-green-600' : kpi.subTone === 'bad' ? 'text-red-500' : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {kpi.sub}
                    </p>
                  )}
                </div>
              </div>
              {kpi.spark && kpi.spark.length > 1 && kpi.spark.some(v => v !== 0) && (
                <div className="mt-3 -mx-1">
                  <Sparkline values={kpi.spark} color={kpi.sparkColor} className="w-full h-7" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chart + Recent Sales Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart */}
        {prefs.show_chart && (
          <div className={`lg:col-span-2 rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h2 className={sectionTitle}>{categoryConfig.salesLabel} & Profit</h2>
            <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Last 30 days</p>
            {!chartHasData ? (
              <div className="h-56 flex flex-col items-center justify-center text-center gap-3">
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No {categoryConfig.salesLabel.toLowerCase()} in the last 30 days yet.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('add-sale')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 text-white text-sm font-semibold shadow-md hover:shadow-glow active:scale-[0.97] transition-all"
                >
                  {categoryConfig.addSaleLabel}
                </button>
              </div>
            ) : (
            <div className="h-56" role="img" aria-label={chartSummary}>
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
                        callback: (v) => getAccountCurrency() + ' ' + Number(v).toLocaleString(),
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
                    legend: { display: true, position: 'top', align: 'end', labels: {
                      boxWidth: 8,
                      boxHeight: 8,
                      usePointStyle: true,
                      pointStyle: 'circle',
                      color: isDark ? '#94a3b8' : '#6b7280',
                      font: { size: 12 },
                      // Solid dots in the line colour: the gradient fill and thick stroke belong to the lines, not the legend.
                      generateLabels: (chart) =>
                        ChartJS.defaults.plugins.legend.labels.generateLabels(chart).map((item) => ({
                          ...item,
                          fillStyle: item.strokeStyle,
                          lineWidth: 0,
                        })),
                    } },
                    tooltip: {
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      titleColor: isDark ? '#f1f5f9' : '#111827',
                      bodyColor: isDark ? '#cbd5e1' : '#374151',
                      borderColor: isDark ? '#334155' : '#e5e7eb',
                      borderWidth: 1,
                      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${getAccountCurrency()} ${ctx.parsed.y.toLocaleString()}` },
                    },
                  },
                }}
              />
            </div>
            )}
          </div>
        )}

        {/* Recent Sales */}
        {prefs.show_recent_sales && (
          <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={sectionTitle}>Recent {categoryConfig.salesLabel}</h2>
            </div>
            {recentSales.length === 0 ? (
              <p className={`text-sm py-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No {saleNounPlural} recorded yet.</p>
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
              <input
                type="time"
                value={newTaskDueTime}
                onChange={(e) => setNewTaskDueTime(e.target.value)}
                disabled={!newTaskDueDate}
                title="Time (optional)"
                className={`text-xs px-2 py-2 rounded-lg border disabled:opacity-50 ${
                  isDark ? 'bg-slate-700 border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
                }`}
              />
              <select
                value={newTaskRemind === null ? '' : String(newTaskRemind)}
                onChange={(e) => setNewTaskRemind(e.target.value === '' ? null : Number(e.target.value))}
                disabled={!newTaskDueDate}
                title="Remind me (needs a due date)"
                className={`text-xs px-2 py-2 rounded-lg border disabled:opacity-50 ${
                  isDark ? 'bg-slate-700 border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
                }`}
              >
                {REMINDER_OPTIONS.map(o => (
                  <option key={String(o.value)} value={o.value === null ? '' : String(o.value)}>{o.value === null ? 'No reminder' : `Remind: ${o.label.toLowerCase()}`}</option>
                ))}
              </select>
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
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{task.dueTime ? ` · ${formatDueTime(task.dueTime)}` : ''}{task.remindAt && !task.completed ? ' ⏰' : ''}
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
