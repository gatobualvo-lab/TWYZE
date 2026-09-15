import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Plus, Menu, X, Target, TrendingUp, Download, Zap, LogOut, Users, History, Settings, User, User as UserIcon, Package, BookOpen, Layers, Calendar, TrendingDown, Wallet, Truck, ChevronLeft, ChevronRight, Receipt, ChevronDown, ShoppingCart, FileText, Percent, Lightbulb, Sparkles, Trophy, Bell, UserCog, Repeat, HelpCircle, Briefcase } from 'lucide-react';
import { CSSTransition } from 'react-transition-group';
import { supabase, refreshSession } from '../utils/supabase';
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
import CashPosition from './payments/CashPosition';
import MobileBottomNav from './MobileBottomNav';
import RecurringInvoices from './documents/RecurringInvoices';
import ProjectsPage from './projects/ProjectsPage';
import { runDueRecurringInvoices } from '../services/documents/recurringInvoiceService';
import DropdownManagement from './DropdownManagement';
import AccountSettings from './AccountSettings';
import PaymentManagement from '../pages/PaymentManagement';
import ClientManagement from './ClientManagement';
import AdminPanel from '../pages/AdminPanel';
import DashboardHome from './DashboardHome';
import DocumentsPage from './documents/DocumentsPage';
import NotificationBell from './notifications/NotificationBell';
import { useOfflineSalesSync } from '../hooks/useOfflineSalesSync';
import ProfitAnalytics from './analytics/ProfitAnalytics';
import DailyClosingReport from './analytics/DailyClosingReport';
import CustomerTimeline from './customers/CustomerTimeline';
import SmartInventoryPredictions from './inventory/SmartInventoryPredictions';
import OpportunityCenter from './opportunities/OpportunityCenter';
import AIBusinessAdvisor from './advisor/AIBusinessAdvisor';
import BusinessGoals from './goals/BusinessGoals';
import UniversalSearch from './search/UniversalSearch';
import BusinessCalendar from './calendar/BusinessCalendar';
import NotificationCenter from './notifications/NotificationCenter';
import { useNotificationSync } from '../services/notifications/useNotificationSync';
import TeamManagement from './team/TeamManagement';
import { useBusinessRole } from '../services/team/useBusinessRole';
import { filterNavForRole } from '../services/team/navPermissions';
import RecurringExpenses from './expenses/RecurringExpenses';
import { runDueRecurringExpenses } from '../services/expenses/recurringExpenseService';
import { applyMySubscriptionLapse, computeAccessLevel } from '../services/subscription/subscriptionLapseService';
import { sendSubscriptionExpiryWarningEmail } from '../services/email/emailService';
import { SubscriptionBanner, RestrictedFeatureGate } from './SubscriptionGate';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  subscription_status?: string;
  subscription_expiry?: string;
  trial_end_date?: string;
  current_billing_cycle?: string;
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

// Sidebar nav is data-driven from here rather than hand-written per item —
// with 21+ top-level destinations (10 existing + 11 new BI features), three
// parallel hardcoded switch-statements (sidebar JSX / header title / body
// content) would mean every new feature touches three near-duplicate spots.
// This registry drives the sidebar and header title; the body content switch
// stays an explicit chain below since each tab renders a different component
// with different props, which a generic map wouldn't meaningfully simplify.
type IconType = React.ComponentType<{ className?: string }>;

interface NavLeaf {
  id: string;
  label: string;
  /** Header title, if different from the sidebar label. */
  title?: string;
  icon: IconType;
}

interface NavGroup {
  kind: 'group';
  id: string;
  label: string;
  icon: IconType;
  iconClassName: string;
  items: NavLeaf[];
}

type NavTopItem = ({ kind: 'leaf' } & NavLeaf) | NavGroup;

// Reorganized per a business-owner usability pass: "Suppliers" was actually
// a second sales channel (confusingly named the same as "vendor" elsewhere
// in the app, which means who you BUY from) — folded into Sales under
// clearer "Wholesale" labels. "Payment Management" collided in meaning
// with the separate subscription-billing page of the same name — folded
// into a new "Money" group alongside Expenses, since a business owner
// thinks of "who I owe / who owes me" as one activity. "Reports &
// Analytics" and "Insights" were an arbitrary split from the user's point
// of view (both answer "how's my business doing") — merged into one
// Insights group. Leaf ids are unchanged so routing, permissions
// (SECTION_BY_NAV_ID), and existing deep links all keep working.
const NAV_ITEMS: NavTopItem[] = [
  { kind: 'leaf', id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  {
    kind: 'group', id: 'sales', label: 'Sales', icon: ShoppingCart, iconClassName: 'text-blue-600',
    items: [
      { id: 'add-sale', label: 'Add Sale', icon: Plus },
      { id: 'view-sales', label: 'View Sales', icon: ShoppingCart },
      { id: 'add-supplier', label: 'Add Wholesale Sale', icon: Plus },
      { id: 'view-suppliers', label: 'Wholesale Dashboard', icon: Users },
    ],
  },
  {
    kind: 'group', id: 'money', label: 'Money', icon: Wallet, iconClassName: 'text-orange-600',
    items: [
      { id: 'cash-position', label: 'Cash Position', icon: Wallet },
      { id: 'ad-expenses', label: 'Ad Expenses', icon: Target },
      { id: 'general-expenses', label: 'General Expenses', icon: Receipt },
      { id: 'recurring-expenses', label: 'Recurring Expenses', icon: Repeat },
      { id: 'expense-overview', label: 'Expense Overview', icon: TrendingDown },
      { id: 'vendor-transactions', label: 'Vendor Transactions', icon: User },
      { id: 'delivery-payments', label: 'Delivery Payments', icon: Truck },
    ],
  },
  {
    kind: 'group', id: 'inventory-group', label: 'Inventory', icon: Package, iconClassName: 'text-cyan-600',
    items: [
      { id: 'inventory', label: 'Inventory', title: 'Inventory Management', icon: Package },
      { id: 'inventory-predictions', label: 'Smart Inventory', icon: Zap },
    ],
  },
  {
    kind: 'group', id: 'customers-group', label: 'Customers', icon: Users, iconClassName: 'text-pink-600',
    items: [
      { id: 'clients', label: 'Clients', title: 'Client Management', icon: Users },
      { id: 'customer-timeline', label: 'Customer Timeline', icon: History },
    ],
  },
  {
    kind: 'group', id: 'documents', label: 'Documents', icon: BookOpen, iconClassName: 'text-teal-600',
    items: [
      { id: 'documents-quotations', label: 'Quotations', icon: Layers },
      { id: 'documents-invoices', label: 'Invoices', icon: FileText },
      { id: 'documents-receipts', label: 'Receipts', icon: Receipt },
      { id: 'recurring-invoices', label: 'Recurring Invoices', icon: Repeat },
      { id: 'projects', label: 'Projects', icon: Briefcase },
      { id: 'documents-settings', label: 'Doc Settings', title: 'Document Settings', icon: Settings },
    ],
  },
  {
    kind: 'group', id: 'insights-group', label: 'Insights', icon: Lightbulb, iconClassName: 'text-amber-600',
    items: [
      { id: 'opportunities', label: 'Opportunity Center', icon: Lightbulb },
      { id: 'advisor', label: 'Business Advisor', icon: Sparkles },
      { id: 'goals', label: 'Business Goals', icon: Trophy },
      { id: 'calendar', label: 'Business Calendar', icon: Calendar },
      { id: 'notifications', label: 'Notification Center', icon: Bell },
      { id: 'monthly-dashboard', label: 'Monthly Dashboard', icon: TrendingUp },
      { id: 'profit-analytics', label: 'Profit Analytics', icon: Percent },
      { id: 'daily-closing', label: 'Daily Closing Report', icon: Receipt },
      { id: 'data-export', label: 'Data Export', icon: Download },
    ],
  },
  {
    kind: 'group', id: 'settings-group', label: 'Settings', icon: Settings, iconClassName: 'text-gray-600',
    items: [
      { id: 'dropdown-management', label: 'Dropdown Management', icon: Settings },
      { id: 'team', label: 'Team', icon: UserCog },
    ],
  },
];

const NAV_TITLES: Record<string, string> = { account: 'Account Settings', admin: 'Admin Panel', 'payment-management': 'Manage Subscription' };
for (const entry of NAV_ITEMS) {
  if (entry.kind === 'leaf') {
    NAV_TITLES[entry.id] = entry.title ?? entry.label;
  } else {
    for (const item of entry.items) NAV_TITLES[item.id] = item.title ?? item.label;
  }
}

interface NavButtonProps {
  active: boolean;
  collapsed: boolean;
  label: string;
  icon: IconType;
  onClick: () => void;
  iconClassName?: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, collapsed, label, icon: Icon, onClick, iconClassName }) => (
  <button
    onClick={onClick}
    className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-gray-700 hover:bg-gray-100 hover:translate-x-0.5 active:translate-x-0 active:bg-gray-200'
    }`}
  >
    <Icon
      className={`w-5 h-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 ${
        active ? '' : iconClassName ?? ''
      }`}
    />
    {!collapsed && <span className="truncate">{label}</span>}
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({ activeTab: initialActiveTab }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { showModal, handleCloseModal } = useDownloadReminder();
  useNotificationSync();
  const { role: businessRole } = useBusinessRole();
  const visibleNavItems = filterNavForRole(NAV_ITEMS, businessRole.isStaff, businessRole.permissions);
  useEffect(() => { runDueRecurringExpenses().catch(() => {}); }, []);
  useEffect(() => { runDueRecurringInvoices().catch(() => {}); }, []);
  const { pendingCount: pendingOfflineSales } = useOfflineSalesSync();
  useEffect(() => {
    applyMySubscriptionLapse().then(newStatus => {
      if (!newStatus) return;
      setUser(prev => {
        if (!prev?.profile) return prev;
        // Send the "you've lapsed" email exactly once, right as the
        // transition happens — not on every subsequent lapse check while
        // still expired/restricted.
        if (prev.profile.subscription_status !== newStatus && newStatus === 'expired') {
          sendSubscriptionExpiryWarningEmail();
        }
        return { ...prev, profile: { ...prev.profile, subscription_status: newStatus } };
      });
    });
  }, []);
  const location = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const accessLevel = computeAccessLevel(user?.profile?.subscription_status);
  const [activeTab, setActiveTab] = useState<string>(initialActiveTab || 'dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Groups start collapsed — except whichever one contains the page we're
  // actually landing on, so a deep link never opens onto a hidden nav item.
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const landingTab = initialActiveTab || 'dashboard';
    const state: Record<string, boolean> = {};
    for (const entry of NAV_ITEMS) {
      if (entry.kind !== 'group') continue;
      state[entry.id] = entry.items.some(item => item.id === landingTab);
    }
    return state;
  });
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Picking a destination from the mobile drawer should close it — otherwise
  // the user has to tap the backdrop or the X separately every single time.
  const handleSidebarNavigate = (tab: string) => {
    setActiveTab(tab);
    if (isMobileView) setIsMobileMenuOpen(false);
  };

  // All useEffect hooks must be declared before any early returns
  useEffect(() => {
    const getUser = async () => {
      try {
        try {
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
    } else if (location.pathname === '/payment-management') {
      setActiveTab('payment-management');
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

      {/* Mobile sidebar backdrop */}
      {isMobileMenuOpen && isMobileView && (
        <div
          className="fixed inset-0 bg-black/40 z-[9] md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <CSSTransition
        in={isMobileMenuOpen || !isMobileView}
        timeout={300}
        classNames="sidebar"
        unmountOnExit={isMobileView}
        nodeRef={sidebarRef}
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
              {visibleNavItems.map(entry => {
                if (entry.kind === 'leaf') {
                  return (
                    <NavButton
                      key={entry.id}
                      active={activeTab === entry.id}
                      collapsed={isSidebarCollapsed}
                      label={entry.label}
                      icon={entry.icon}
                      onClick={() => handleSidebarNavigate(entry.id)}
                    />
                  );
                }

                const expanded = expandedCategories[entry.id] ?? false;
                const GroupIcon = entry.icon;
                return (
                  <div key={entry.id} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(entry.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <GroupIcon className={`w-5 h-5 flex-shrink-0 ${entry.iconClassName}`} />
                        {!isSidebarCollapsed && <span className="font-medium">{entry.label}</span>}
                      </div>
                      {!isSidebarCollapsed && (
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    <div
                      className={`grid transition-all duration-200 ease-smooth ${
                        isSidebarCollapsed || expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className={`overflow-hidden space-y-1 ${isSidebarCollapsed ? '' : 'ml-4'}`}>
                        {entry.items.map(item => (
                          <NavButton
                            key={item.id}
                            active={activeTab === item.id}
                            collapsed={isSidebarCollapsed}
                            label={item.label}
                            icon={item.icon}
                            onClick={() => handleSidebarNavigate(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
            
            {/* Help & Support Section */}
            <div className="mt-4 px-2 pt-4 border-t border-gray-200">
              <h3 className={`px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                Help & Support
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                >
                  <HelpCircle className="w-5 h-5 flex-shrink-0 text-purple-600" />
                  {!isSidebarCollapsed && <span>Help Center</span>}
                </a>
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
                  onClick={() => handleSidebarNavigate('account')}
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
                      handleSidebarNavigate('admin');
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
      <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6 ml-0 md:ml-0 transition-all duration-300">
        {/* User Profile Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex justify-between items-center">
          <div key={activeTab} className="animate-slide-up">
            <h1 className="text-xl font-bold text-gray-800">
              {NAV_TITLES[activeTab] ?? ''}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
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
            {pendingOfflineSales > 0 && (
              <span
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200"
                title="Recorded while offline — will sync automatically once you're back online"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingOfflineSales} pending sync
              </span>
            )}
            <UniversalSearch onNavigate={setActiveTab} />
            <NotificationBell onNavigate={setActiveTab} />
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center transition-transform duration-150 hover:scale-105">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <SubscriptionBanner accessLevel={accessLevel} onNavigate={setActiveTab} />

        {/* Main Content Area — key={activeTab} replays the entrance animation on every tab switch, giving each page a smooth transition without any extra transition-management code. Each tab component owns its own data fetch and loading state; nothing here needs to gate on them. */}
        <div key={activeTab} className="animate-slide-up">
          {activeTab === 'dashboard' && (
            <DashboardHome
              userName={user?.profile?.full_name || user?.email || ''}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'opportunities' && <OpportunityCenter onNavigate={setActiveTab} />}
          {activeTab === 'advisor' && <AIBusinessAdvisor onNavigate={setActiveTab} />}
          {activeTab === 'goals' && <BusinessGoals />}
          {activeTab === 'calendar' && <BusinessCalendar onNavigate={setActiveTab} />}
          {activeTab === 'notifications' && <NotificationCenter onNavigate={setActiveTab} />}
          {activeTab === 'team' && <TeamManagement />}
          {activeTab === 'recurring-expenses' && <RecurringExpenses />}

          {activeTab === 'add-sale' && (
            <RestrictedFeatureGate accessLevel={accessLevel} onNavigate={setActiveTab}>
              <MultiProductSalesForm />
            </RestrictedFeatureGate>
          )}
          {activeTab === 'view-sales' && <SalesList />}
          {activeTab === 'add-supplier' && (
            <RestrictedFeatureGate accessLevel={accessLevel} onNavigate={setActiveTab}>
              <SupplierForm />
            </RestrictedFeatureGate>
          )}
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
          {activeTab === 'general-expenses' && (
            <RestrictedFeatureGate accessLevel={accessLevel} onNavigate={setActiveTab}>
              <GeneralExpenseForm />
            </RestrictedFeatureGate>
          )}
          {activeTab === 'expense-overview' && <ExpenseOverview />}
          {activeTab === 'inventory' && <InventoryManagement />}
          {activeTab === 'inventory-predictions' && <SmartInventoryPredictions />}
          {activeTab === 'clients' && <ClientManagement />}
          {activeTab === 'customer-timeline' && <CustomerTimeline />}
          {activeTab === 'documents-quotations' && <DocumentsPage initialTab="quotation" />}
          {activeTab === 'documents-invoices' && <DocumentsPage initialTab="invoice" />}
          {activeTab === 'documents-receipts' && <DocumentsPage initialTab="receipt" />}
          {activeTab === 'recurring-invoices' && <RecurringInvoices />}
          {activeTab === 'projects' && <ProjectsPage />}
          {activeTab === 'documents-settings' && <DocumentsPage initialTab="settings" />}
          {activeTab === 'monthly-dashboard' && <MonthlyDashboard />}
          {activeTab === 'profit-analytics' && <ProfitAnalytics />}
          {activeTab === 'daily-closing' && <DailyClosingReport />}
          {activeTab === 'data-export' && <ReportsAnalytics />}
          {activeTab === 'cash-position' && <CashPosition onNavigate={setActiveTab} />}
          {activeTab === 'delivery-payments' && <DeliveryPayments />}
          {activeTab === 'vendor-transactions' && <VendorTransactions />}
          {activeTab === 'dropdown-management' && <DropdownManagement />}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'payment-management' && <PaymentManagement />}
          {activeTab === 'admin' && <AdminPanel />}
        </div>
      </div>
    </div>

    <MobileBottomNav activeTab={activeTab} onNavigate={handleSidebarNavigate} onMore={() => setIsMobileMenuOpen(true)} />

    {/* Download Modal (triggered by button) */}
    <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />
    </>
  );
};

export default Dashboard;