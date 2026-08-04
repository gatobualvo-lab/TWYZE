import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Plus, Menu, X, Target, Shield, TrendingUp, Download, Zap, LogOut, Users, History, Settings, User, User as UserIcon, Package, BookOpen, Layers, DollarSign, Calendar, TrendingDown, Wallet, Truck, ChevronLeft, ChevronRight, Check, Receipt, AlertTriangle, Trash2, ChevronUp, ChevronDown, ShoppingCart, FileText } from 'lucide-react';
import { CSSTransition } from 'react-transition-group';
import { supabase, refreshSession } from '../utils/supabase';
import { Sale, Supplier, AdExpense, GeneralExpense } from '../types';
import { DownloadModal } from './DownloadModal';
import { useDownloadReminder } from '../hooks/useDownloadReminder';
import MultiProductSalesForm from './MultiProductSalesForm';
import SalesList from './SalesList';
import SupplierForm from './SupplierForm';
import SupplierDashboard from './SupplierDashboard';
import ExpenseOverview from './ExpenseOverview';
import AdExpensesPage from '../pages/AdExpensesPage';
import GeneralExpenseForm from './GeneralExpenseForm';
import InventoryManagement from './InventoryManagement';
import MonthlyDashboard from './MonthlyDashboard';
import ReportsAnalytics from './ReportsAnalytics';
import DeliveryPayments from './payments/DeliveryPayments';
import VendorTransactions from './payments/VendorTransactions';
import DropdownManagement from './DropdownManagement';
import LoadingScreen from './LoadingScreen';
import AccountSettings from './AccountSettings';
import ClientManagement from './ClientManagement';
import AdminPanel from '../pages/AdminPanel';
import DashboardHome from './DashboardHome';
import DocumentsPage from './documents/DocumentsPage';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  subscription_status?: string;
  role?: string;
  created_at?: string;
  last_login?: string;
}

interface DashboardProps {
  activeTab?: string;
}


interface UserData {
  id: string;
  email?: string;
  profile?: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = ({ activeTab: initialActiveTab }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { showModal, handleCloseModal } = useDownloadReminder();
  const location = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adExpenses, setAdExpenses] = useState<AdExpense[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialActiveTab || 'dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{
    sales: boolean;
    suppliers: boolean;
    expenses: boolean;
    reports: boolean;
    payments: boolean;
    documents: boolean;
  }>({
    sales: true,
    suppliers: true,
    expenses: true,
    reports: true,
    payments: true,
    documents: true
  });
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState({
    todayGrossProfit: 0,
    weekGrossProfit: 0,
    monthNetProfit: 0,
    owedToVendors: 0,
    owedToDelivery: 0
  });

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const toggleCategory = (category: 'sales' | 'suppliers' | 'expenses' | 'reports' | 'payments' | 'documents') => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Calculate dashboard metrics
  const calculateDashboardMetrics = async (salesData: Sale[], suppliersData: Supplier[]) => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Today's gross profit
    const todayGrossProfit = salesData
      .filter(sale => sale.date === today)
      .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

    // Week's gross profit
    const weekGrossProfit = salesData
      .filter(sale => sale.date >= weekAgo)
      .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

    // Month's net profit (sales profit minus expenses)
    const monthSalesProfit = salesData
      .filter(sale => sale.date >= monthStart)
      .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

    const monthExpenses = [...adExpenses, ...generalExpenses]
      .filter(expense => {
        const expenseDate = expense.date || expense.occurred_on;
        return expenseDate >= monthStart;
      })
      .reduce((sum, expense) => sum + Number(expense.amount || expense.amount_kes || 0), 0);

    const monthNetProfit = monthSalesProfit - monthExpenses;

    // Calculate owed to vendors from sale_items table
    let owedToVendors = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: saleItems, error } = await supabase
          .from('sale_items')
          .select('buying_price, quantity, vendor_payment_status')
          .eq('user_id', user.id)
          .neq('vendor_payment_status', 'Paid');

        if (!error && saleItems) {
          owedToVendors = saleItems.reduce((sum, item) => {
            return sum + (Number(item.buying_price || 0) * Number(item.quantity || 1));
          }, 0);
        }
      }
    } catch (error) {
      console.error('Error calculating owed to vendors:', error);
    }

    // Calculate owed to delivery
    const owedToDelivery = salesData
      .filter(sale => !sale.delivery_fee_paid)
      .reduce((sum, sale) => sum + Number(sale.delivery_fee || 0), 0);

    setDashboardMetrics({
      todayGrossProfit,
      weekGrossProfit,
      monthNetProfit,
      owedToVendors,
      owedToDelivery
    });
  };

  // Load user data function
  async function loadUserData(userId: string) {
    try {
      try {
        setDataLoading(true);
        
        // Fetch sales data
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .eq('is_archived', false)
          .order('date', { ascending: false });

        if (salesError) {
          console.error('Error fetching sales:', salesError);
          toast.error('Failed to load sales data');
          setSales([]);
        } else {
          setSales(salesData || []);
        }

        // Fetch suppliers data
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .order('date', { ascending: false });

        if (suppliersError) {
          console.error('Error fetching suppliers:', suppliersError);
          toast.error('Failed to load suppliers data');
          setSuppliers([]);
        } else {
          setSuppliers(suppliersData || []);
        }

        // Fetch ad expenses data
        const { data: adExpensesData, error: adExpensesError } = await supabase
          .from('ad_expenses')
          .select('*')
          .eq('created_by', userId)
          .eq('is_archived', false)
          .order('occurred_on', { ascending: false });

        if (adExpensesError) {
          console.error('Error fetching ad expenses:', adExpensesError);
          toast.error('Failed to load ad expenses data');
          setAdExpenses([]);
        } else {
          setAdExpenses(adExpensesData || []);
        }

        // Fetch general expenses data
        const { data: generalExpensesData, error: generalExpensesError } = await supabase
          .from('general_expenses')
          .select('*')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .eq('is_archived', false)
          .order('date', { ascending: false });

        if (generalExpensesError) {
          console.error('Error fetching general expenses:', generalExpensesError);
          toast.error('Failed to load general expenses data');
          setGeneralExpenses([]);
        } else {
          setGeneralExpenses(generalExpensesData || []);
        }

        // Calculate dashboard metrics with available data
        await calculateDashboardMetrics(salesData || [], suppliersData || []);
      } catch (dataError: any) {
        console.error('Error in loadUserData:', dataError);
        toast.error('Failed to load data. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load data');
    } finally {
      setDataLoading(false);
    }
  }

  // All useEffect hooks must be declared before any early returns
  useEffect(() => {
    const getUser = async () => {
      try {
        try {
          setLoading(true);
          // Get current session
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            
            // Try to refresh the session
            const refreshResult = await refreshSession();
            if (!refreshResult.success) {
              navigate('/login');
              return;
            }
            
            // Continue with the refreshed session
          } else if (!sessionData.session) {
            navigate('/login');
            return;
          }
          
          const { data: userData, error } = await supabase.auth.getUser();

          if (error) {
            throw error;
          }

          if (userData.user) {
            try {
              // Get user profile from database
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userData.user.id)
                .maybeSingle();

              if (profileError) {
                console.error('Error fetching profile:', profileError);
                // Continue without profile data
                setUser({
                  id: userData.user.id,
                  email: userData.user.email
                });
              } else if (profile) {
                // Set user with profile data
                console.log('✅ Profile loaded:', profile);
                console.log('👤 User role:', profile.role);
                setUser({
                  id: userData.user.id,
                  email: userData.user.email,
                  profile: profile as UserProfile
                });
              } else {
                // Profile not found
                console.warn('Profile not found for user:', userData.user.id);
                setUser({
                  id: userData.user.id,
                  email: userData.user.email
                });
              }
              
              // Load user data
              await loadUserData(userData.user.id);
            } catch (profileError) {
              console.error('Error in profile fetch:', profileError);
              // Set basic user without profile
              setUser({
                id: userData.user.id,
                email: userData.user.email
              });
            }
          }
        } catch (authError: any) {
          console.error('Auth error:', authError);
          toast.error('Authentication error. Please log in again.');
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('Error getting user:', error);
        toast.error('Failed to load user data');
        // Redirect to login if there's an auth error
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    getUser();
    
    // Add window resize listener for mobile view detection
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [navigate]);
  
  // Update active tab when location changes
  useEffect(() => {
    if (location.pathname === '/account') {
      setActiveTab('account');
    } else if (location.pathname === '/admin') {
      setActiveTab('admin');
    }
  }, [location]);

  // Handle click outside sidebar to close it on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <>
    <div className={`min-h-screen flex transition-colors duration-200 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Download Modal */}
      <DownloadModal isOpen={showModal} onClose={handleCloseModal} />
      
      {/* Mobile Menu Button */}
      <div
        className="md:hidden fixed left-4 z-20 safe-top"
        style={{ left: 'calc(env(safe-area-inset-left, 0px) + 1rem)' }}
      >
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`p-3 rounded-lg shadow-md min-w-[44px] min-h-[44px] flex items-center justify-center ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-white'
          }`}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-700" />
          ) : (
            <Menu className="w-6 h-6 text-gray-700" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <CSSTransition
        in={isMobileMenuOpen || !isMobileView}
        timeout={300}
        classNames="sidebar"
        unmountOnExit={isMobileView}
      >
        <div
          ref={sidebarRef}
          className={`fixed md:sticky top-0 left-0 h-screen z-10 shadow-lg transition-all duration-300 safe-pb ${
            theme === 'dark' ? 'bg-slate-800 border-r border-slate-700' : 'bg-white'
          } ${isSidebarCollapsed ? 'w-20' : 'w-64'} flex flex-col`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Sidebar Header */}
          <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : ''}`}>
            <div className="flex items-center gap-3">
              <img
                src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png"
                alt="Trackwyze Logo"
                className="w-8 h-8"
              />
              {!isSidebarCollapsed && (
                <span className="text-xl font-bold text-gray-800">Trackwyze</span>
              )}
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 rounded-lg hover:bg-gray-100 hidden md:block"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>

          {/* Sidebar Navigation */}
          <div className="flex-1 overflow-y-auto py-4 flex flex-col">
            <nav className="px-2 space-y-2">
              {/* Dashboard */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Dashboard</span>}
              </button>

              {/* Sales Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('sales')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 flex-shrink-0 text-blue-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Sales</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.sales ? 
                    <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {(expandedCategories.sales || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    {/* Add Sale */}
                    <button
                      onClick={() => setActiveTab('add-sale')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'add-sale'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Plus className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Add Sale</span>}
                    </button>
                    
                    {/* View Sales */}
                    <button
                      onClick={() => setActiveTab('view-sales')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'view-sales'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>View Sales</span>}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Suppliers Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('suppliers')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 flex-shrink-0 text-green-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Suppliers</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.suppliers ? 
                    <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {(expandedCategories.suppliers || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    {/* Add Supplier Sale */}
                    <button
                      onClick={() => setActiveTab('add-supplier')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'add-supplier'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Plus className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Add Supplier Sale</span>}
                    </button>
                    
                    {/* View Suppliers */}
                    <button
                      onClick={() => setActiveTab('view-suppliers')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'view-suppliers'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Users className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Supply Dashboard</span>}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Expenses Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('expenses')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 flex-shrink-0 text-red-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Expenses</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.expenses ? 
                    <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {(expandedCategories.expenses || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    {/* Ad Expenses */}
                    <button
                      onClick={() => setActiveTab('ad-expenses')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'ad-expenses'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Target className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Ad Expenses</span>}
                    </button>
                    
                    {/* General Expenses */}
                    <button
                      onClick={() => setActiveTab('general-expenses')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'general-expenses'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Receipt className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>General Expenses</span>}
                    </button>
                    
                    {/* Expense Overview */}
                    <button
                      onClick={() => setActiveTab('expense-overview')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'expense-overview'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Expense Overview</span>}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Inventory */}
              <button
                onClick={() => setActiveTab('inventory')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'inventory'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Package className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Inventory</span>}
              </button>

              {/* Clients */}
              <button
                onClick={() => setActiveTab('clients')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'clients'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Clients</span>}
              </button>

              {/* Documents Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('documents')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 flex-shrink-0 text-teal-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Documents</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.documents ?
                    <ChevronUp className="w-4 h-4 text-gray-500" /> :
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {(expandedCategories.documents || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    <button
                      onClick={() => setActiveTab('documents-quotations')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'documents-quotations'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Layers className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Quotations</span>}
                    </button>
                    <button
                      onClick={() => setActiveTab('documents-invoices')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'documents-invoices'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Invoices</span>}
                    </button>
                    <button
                      onClick={() => setActiveTab('documents-receipts')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'documents-receipts'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Receipt className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Receipts</span>}
                    </button>
                    <button
                      onClick={() => setActiveTab('documents-settings')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'documents-settings'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Settings className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Doc Settings</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* Reports & Analytics Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('reports')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 flex-shrink-0 text-purple-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Reports & Analytics</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.reports ? 
                    <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {(expandedCategories.reports || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    {/* Monthly Dashboard */}
                    <button
                      onClick={() => setActiveTab('monthly-dashboard')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'monthly-dashboard'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Monthly Dashboard</span>}
                    </button>
                    
                    {/* Data Export */}
                    <button
                      onClick={() => setActiveTab('data-export')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'data-export'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Download className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Data Export</span>}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Payment Management Category */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleCategory('payments')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 flex-shrink-0 text-orange-600" />
                    {!isSidebarCollapsed && <span className="font-medium">Payment Management</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    expandedCategories.payments ? 
                    <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {(expandedCategories.payments || isSidebarCollapsed) && (
                  <div className={`space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                    {/* Delivery Payments */}
                    <button
                      onClick={() => setActiveTab('delivery-payments')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'delivery-payments'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Truck className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Delivery Payments</span>}
                    </button>
                    
                    {/* Vendor Transactions */}
                    <button
                      onClick={() => setActiveTab('vendor-transactions')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'vendor-transactions'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <User className="w-5 h-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Vendor Transactions</span>}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Dropdown Management */}
              <button
                onClick={() => setActiveTab('dropdown-management')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'dropdown-management'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Dropdown Management</span>}
              </button>
            </nav>
            
            {/* Help & Support Section */}
            <div className="mt-4 px-2 pt-4 border-t border-gray-200">
              <h3 className={`px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                Help & Support
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="https://wa.me/0113476311"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 text-green-600">
                    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/>
                    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z"/>
                    <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z"/>
                    <path d="M12 17a5 5 0 0 1-5-5v-1a5 5 0 0 1 10 0v1a5 5 0 0 1-5 5Z"/>
                  </svg>
                  {!isSidebarCollapsed && <span>Chat on WhatsApp</span>}
                </a>
                <a
                  href="tel:0113476311"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 text-blue-600">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  {!isSidebarCollapsed && <span>Call Customer Care</span>}
                </a>
                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                >
                  <Download className="w-5 h-5 flex-shrink-0 text-blue-600" />
                  {!isSidebarCollapsed && <span>Download App</span>}
                </button>
              </div>
            </div>
            
            {/* User Section */}
            <div className={`mt-auto px-2 pt-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                User
              </h3>
              <div className="mt-2 space-y-1">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === 'account'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <span>Account</span>}
                </button>
                <button
                  onClick={toggleTheme}
                  className={`theme-toggle w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-300 hover:bg-slate-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  )}
                  {!isSidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>
              </div>
            </div>
            
            {/* Admin Section - Only visible to admin users */}
            {user?.profile?.role === 'admin' && (
              <div className={`mt-4 px-2 pt-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                <h3 className={`px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                  Administration
                </h3>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      navigate('/admin');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === 'admin'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    {!isSidebarCollapsed && <span>Admin Panel</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t">
            <div className="space-y-2">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  // Clear any stored tokens
                  localStorage.removeItem('sb-trackwyze-auth');
                  sessionStorage.removeItem('sb-trackwyze-auth');
                  navigate('/login');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors`}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Logout</span>}
              </button>
            </div>
          </div>
        </div>
      </CSSTransition>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 ml-0 md:ml-0 transition-all duration-300">
        {/* User Profile Bar */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'add-sale' && 'Add Sale'}
              {activeTab === 'view-sales' && 'View Sales'}
              {activeTab === 'add-supplier' && 'Add Supplier Sale'}
              {activeTab === 'view-suppliers' && 'Supply Dashboard'}
              {activeTab === 'ad-expenses' && 'Ad Expenses'}
              {activeTab === 'general-expenses' && 'General Expenses'}
              {activeTab === 'expense-overview' && 'Expense Overview'}
              {activeTab === 'inventory' && 'Inventory Management'}
              {activeTab === 'clients' && 'Client Management'}
              {activeTab === 'documents-quotations' && 'Quotations'}
              {activeTab === 'documents-invoices' && 'Invoices'}
              {activeTab === 'documents-receipts' && 'Receipts'}
              {activeTab === 'documents-settings' && 'Document Settings'}
              {activeTab === 'monthly-dashboard' && 'Monthly Dashboard'}
              {activeTab === 'data-export' && 'Data Export'}
              {activeTab === 'delivery-payments' && 'Delivery Payments'}
              {activeTab === 'vendor-transactions' && 'Vendor Transactions'}
              {activeTab === 'dropdown-management' && 'Dropdown Management'}
              {activeTab === 'account' && 'Account Settings'}
              {activeTab === 'admin' && 'Admin Panel'}
            </h1>
            <p className="text-gray-600">
              {user?.profile?.full_name || user?.email || 'Welcome back!'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.profile?.subscription_status === 'trial' ? 'Free Trial' : 'Subscribed'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.profile?.subscription_status === 'trial'
                  ? `Expires: ${user?.profile?.trial_end_date
                      ? new Date(user.profile.trial_end_date).toLocaleDateString()
                      : 'Unknown'}`
                  : `Billing: ${user?.profile?.current_billing_cycle || 'Unknown'}`}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="animate-fadeIn">
          {dataLoading ? (
            <LoadingScreen />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardHome
                  userName={user?.profile?.full_name || user?.email || ''}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'add-sale' && <MultiProductSalesForm />}
              {activeTab === 'view-sales' && <SalesList />}
              {activeTab === 'add-supplier' && <SupplierForm />}
              {activeTab === 'view-suppliers' && (
                <div>
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Supply Dashboard</h2>
                    <p className="text-gray-600">View and manage your supply-to-client transactions</p>
                  </div>
                  <SupplierDashboard />
                </div>
              )}
              {activeTab === 'ad-expenses' && <AdExpensesPage />}
              {activeTab === 'general-expenses' && <GeneralExpenseForm />}
              {activeTab === 'expense-overview' && <ExpenseOverview />}
              {activeTab === 'inventory' && <InventoryManagement />}
              {activeTab === 'clients' && <ClientManagement />}
              {activeTab === 'documents-quotations' && <DocumentsPage initialTab="quotation" />}
              {activeTab === 'documents-invoices' && <DocumentsPage initialTab="invoice" />}
              {activeTab === 'documents-receipts' && <DocumentsPage initialTab="receipt" />}
              {activeTab === 'documents-settings' && <DocumentsPage initialTab="settings" />}
              {activeTab === 'monthly-dashboard' && <MonthlyDashboard />}
              {activeTab === 'data-export' && <ReportsAnalytics />}
              {activeTab === 'delivery-payments' && <DeliveryPayments />}
              {activeTab === 'vendor-transactions' && <VendorTransactions />}
              {activeTab === 'dropdown-management' && <DropdownManagement />}
              {activeTab === 'account' && <AccountSettings />}
              {activeTab === 'admin' && <AdminPanel />}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Download Modal (triggered by button) */}
    <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />
    </>
  );
};

export default Dashboard;