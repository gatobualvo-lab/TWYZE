import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, DollarSign, CheckCircle, Calendar, Package, Filter, ChevronDown, ChevronRight, Search, Plus, Share2, X, Loader2, CreditCard as Edit, Save, Truck, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import LoadingScreen from '../LoadingScreen';
import VendorStatement from './VendorStatement';
import toast from 'react-hot-toast';
import { EXPENSE_TYPE_OPTIONS, type ExpenseType } from '../../features/vendor-expenses/api';
import { formatCurrency, formatDate } from '../../utils/format';

interface VendorSaleItem {
  id: string;
  sale_id: string;
  vendor: string;
  product_name: string;
  buying_price: number;
  quantity: number;
  vendor_payment_status: 'Paid' | 'Unpaid';
  created_at: string;
}

interface VendorExpense {
  id: string;
  vendor_name: string;
  amount_kes: number;
  occurred_on: string;
  notes: string | null;
  expense_type: string;
  is_cleared: boolean;
  cleared_at: string | null;
  cleared_by: string | null;
  created_at: string;
  created_by: string;
}

interface AddExpenseForm {
  expense_type: string;
  amount: number;
  date: string;
  notes: string;
}

interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  paymentStatus: {
    unpaidPurchases: boolean;
    paidPurchases: boolean;
  };
  searchTerm: string;
}

interface VendorData {
  name: string;
  totalPurchases: number;
  totalExpenses: number;
  netOwed: number;
  purchaseItems: VendorSaleItem[];
  expenseItems: VendorExpense[];
  purchasePage: number;
  expensePage: number;
  hasMorePurchases: boolean;
  hasMoreExpenses: boolean;
  loadingPurchases: boolean;
  loadingExpenses: boolean;
  /** Distinguishes "never fetched" from "fetched, genuinely zero results" — an empty array alone is ambiguous and caused a re-fetch loop for vendors with no purchases or no expenses. */
  purchasesLoaded: boolean;
  expensesLoaded: boolean;
}

interface SaleData {
  id: string;
  date: string | null;
  delivery_guy: string | null;
}

const VendorTransactions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<{[key: string]: VendorData}>({});
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<{[key: string]: SaleData}>({});
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [selectedVendorForExpense, setSelectedVendorForExpense] = useState<string>('');
  const [addExpenseForm, setAddExpenseForm] = useState<AddExpenseForm>({
    expense_type: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    date: '',
    expense_type: '',
    amount: 0,
    notes: ''
  });
  const [savingExpenseId, setSavingExpenseId] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showClearedExpenses, setShowClearedExpenses] = useState(true);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);
  // These three replace window.confirm() for the bulk purchase action,
  // "delete expense", and "mark all paid" — confirm()/alert() weren't
  // reliably showing anything in the packaged Electron shell (see the same
  // class of issue with window.open() for print/PDF), so a click would
  // silently no-op with no dialog and no error. An in-app arm-then-confirm
  // step needs no native API at all.
  const [pendingBulkStatus, setPendingBulkStatus] = useState<'Paid' | 'Unpaid' | null>(null);
  const [pendingDeleteExpenseId, setPendingDeleteExpenseId] = useState<string | null>(null);
  const [pendingMarkAllPaidVendor, setPendingMarkAllPaidVendor] = useState<string | null>(null);
  const itemsPerPage = 20;
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: '',
      end: ''
    },
    paymentStatus: {
      unpaidPurchases: true,
      paidPurchases: true
    },
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // References for infinite scroll
  const purchaseObserverRef = useRef<IntersectionObserver | null>(null);
  const expenseObserverRef = useRef<IntersectionObserver | null>(null);
  
  const lastPurchaseElementRef = useCallback((node: HTMLDivElement | null, vendorName: string) => {
    if (!node || !vendors[vendorName] || vendors[vendorName].loadingPurchases || !vendors[vendorName].hasMorePurchases) return;
    
    if (purchaseObserverRef.current) purchaseObserverRef.current.disconnect();
    
    purchaseObserverRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && vendors[vendorName].hasMorePurchases) {
        loadMorePurchases(vendorName);
      }
    });
    
    purchaseObserverRef.current.observe(node);
  }, [vendors]);

  const lastExpenseElementRef = useCallback((node: HTMLDivElement | null, vendorName: string) => {
    if (!node || !vendors[vendorName] || vendors[vendorName].loadingExpenses || !vendors[vendorName].hasMoreExpenses) return;
    
    if (expenseObserverRef.current) expenseObserverRef.current.disconnect();
    
    expenseObserverRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && vendors[vendorName].hasMoreExpenses) {
        loadMoreExpenses(vendorName);
      }
    });
    
    expenseObserverRef.current.observe(node);
  }, [vendors]);

  useEffect(() => {
    fetchVendorData();
  }, []);

  // fetchVendorData() rebuilds every vendor's group from scratch (used by
  // apply/clear filters, saving an expense edit, mark-all-paid, etc.), which
  // resets purchasesLoaded/expensesLoaded to false for all vendors. If one
  // is currently expanded, its detail lists would otherwise sit empty until
  // the user manually collapses and re-expands it — reload them here instead.
  useEffect(() => {
    if (!expandedVendor || !vendors[expandedVendor]) return;
    if (!vendors[expandedVendor].purchasesLoaded && !vendors[expandedVendor].loadingPurchases) {
      loadVendorPurchases(expandedVendor);
    }
    if (!vendors[expandedVendor].expensesLoaded && !vendors[expandedVendor].loadingExpenses) {
      loadVendorExpenses(expandedVendor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, expandedVendor]);

  // A selection tied to one vendor's row ids shouldn't survive switching to
  // (or collapsing) another vendor — stale ids would silently no-op or,
  // worse, match a different vendor's row that happens to reuse an id slot.
  useEffect(() => {
    setSelectedPurchaseIds(new Set());
    setPendingBulkStatus(null);
    setPendingDeleteExpenseId(null);
    setPendingMarkAllPaidVendor(null);
  }, [expandedVendor]);

  const fetchVendorData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view vendor transactions');
        return;
      }

      // Fetch all sales for reference
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, date, delivery_guy')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        toast.error('Failed to load sales data');
        return;
      }

      // Create a lookup object for sales
      const salesLookup: {[key: string]: SaleData} = {};
      salesData?.forEach(sale => {
        salesLookup[sale.id] = sale;
      });
      setAllSales(salesLookup);

      // Fetch all sale items from non-deleted sales
      const { data: saleItemsData, error: saleItemsError } = await supabase
        .from('sale_items')
        .select(`
          id,
          sale_id,
          vendor,
          product_name,
          buying_price,
          quantity,
          vendor_payment_status,
          created_at,
          sales!inner(
            date,
            delivery_guy,
            user_id,
            is_deleted,
            is_archived
          )
        `)
        .eq('sales.user_id', user.id)
        .eq('sales.is_deleted', false)
        .eq('sales.is_archived', false)
        .order('created_at', { ascending: false })
        .range(0, 49999);

      if (saleItemsError) {
        console.error('Error fetching sale items:', saleItemsError);
        toast.error('Failed to load sale items');
        return;
      }
      
      // Filter out items with empty vendor names and ensure strict vendor matching
      const validSaleItems = (saleItemsData || []).filter(item => 
        item.vendor && item.vendor.trim() !== '' && passesFilters(item, 'purchase')
      );

      // Fetch vendor expenses
      const { data: vendorExpensesData, error: vendorExpensesError } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(0, 49999);

      if (vendorExpensesError) {
        console.error('Error fetching vendor expenses:', vendorExpensesError);
        toast.error('Failed to load vendor expenses');
        return;
      }

      // Group data by vendor
      const vendorGroups: {[key: string]: VendorData} = {};
      
      // Process sale items - each item is credited only to its specific vendor
      validSaleItems.forEach(item => {
        const vendorName = (item.vendor ?? '').trim(); // Exact vendor name from the sale_item
        
        if (!vendorGroups[vendorName]) {
          vendorGroups[vendorName] = {
            name: vendorName,
            totalPurchases: 0,
            totalExpenses: 0,
            netOwed: 0,
            purchaseItems: [],
            expenseItems: [],
            purchasePage: 1,
            expensePage: 1,
            hasMorePurchases: false,
            hasMoreExpenses: false,
            loadingPurchases: false,
            loadingExpenses: false,
            purchasesLoaded: false,
            expensesLoaded: false
          };
        }
        
        // Credit this specific item's buying price only to this vendor
        const itemTotalPrice = (item.buying_price ?? 0) * (item.quantity ?? 0);
        
        if (item.vendor_payment_status === 'Unpaid') {
          vendorGroups[vendorName].totalPurchases += itemTotalPrice;
        }
      });
      
      // Process vendor expenses
      (vendorExpensesData || []).filter(expense => passesFilters(expense, 'expense')).forEach(expense => {
        const vendorName = expense.vendor_name?.trim() || '';
        
        if (!vendorGroups[vendorName]) {
          vendorGroups[vendorName] = {
            name: vendorName,
            totalPurchases: 0,
            totalExpenses: 0,
            netOwed: 0,
            purchaseItems: [],
            expenseItems: [],
            purchasePage: 1,
            expensePage: 1,
            hasMorePurchases: false,
            hasMoreExpenses: false,
            loadingPurchases: false,
            loadingExpenses: false,
            purchasesLoaded: false,
            expensesLoaded: false
          };
        }
        
        // All expenses count toward total (no is_reimbursed field in new schema)
        vendorGroups[vendorName].totalExpenses += expense.amount_kes || 0;
      });
      
      // Calculate net owed for each vendor
      Object.keys(vendorGroups).forEach(vendor => {
        vendorGroups[vendor].netOwed = vendorGroups[vendor].totalPurchases - vendorGroups[vendor].totalExpenses;
      });
      
      // Sort vendors by net owed (highest first)
      const sortedVendors = Object.values(vendorGroups).sort((a, b) => b.netOwed - a.netOwed);
      
      // Convert back to object
      const vendorsObject: {[key: string]: VendorData} = {};
      sortedVendors.forEach(vendor => {
        vendorsObject[vendor.name] = vendor;
      });
      
      setVendors(vendorsObject);
    } catch (error: any) {
      console.error('Error fetching vendor data:', error);
      toast.error(error.message || 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  const passesFilters = (item: any, type: 'purchase' | 'expense'): boolean => {
    // Date range filter — purchases are dated by the underlying sale (not
    // when the sale_item row happened to be inserted), expenses by
    // occurred_on (VendorExpense has no `date` field, so reading one
    // silently matched everything before this fix).
    const itemDate = type === 'purchase' ? (item.sales?.date || item.created_at) : item.occurred_on;
    if (filters.dateRange.start && itemDate < filters.dateRange.start) return false;
    if (filters.dateRange.end && itemDate > filters.dateRange.end) return false;
    
    // Payment status filter
    if (type === 'purchase') {
      const isPaid = item.vendor_payment_status === 'Paid';
      if (isPaid && !filters.paymentStatus.paidPurchases) return false;
      if (!isPaid && !filters.paymentStatus.unpaidPurchases) return false;
    }
    // Expenses have no paid/unpaid distinction at the filter-panel level —
    // "cleared" status is a per-vendor visibility toggle instead (see
    // showClearedExpenses), not something this top-level filter offers.
    
    // Search filter (only for purchases by product name)
    if (type === 'purchase' && filters.searchTerm) {
      const productName = item.product_name || '';
      if (!productName.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
    }
    
    return true;
  };

  const applyFilters = () => {
    fetchVendorData();
    toast.success('Filters applied');
  };

  const clearFilters = () => {
    setFilters({
      dateRange: {
        start: '',
        end: ''
      },
      paymentStatus: {
        unpaidPurchases: true,
        paidPurchases: true
      },
      searchTerm: ''
    });
    fetchVendorData();
    toast.success('Filters cleared');
  };

  const loadVendorPurchases = async (vendorName: string) => {
    if (!vendors[vendorName]) return;

    // Neither status checked means "show nothing" — skip the query rather
    // than send a filter that can never match.
    const { unpaidPurchases, paidPurchases } = filters.paymentStatus;
    if (!unpaidPurchases && !paidPurchases) {
      setVendors(prev => ({
        ...prev,
        [vendorName]: { ...prev[vendorName], purchaseItems: [], hasMorePurchases: false, loadingPurchases: false }
      }));
      return;
    }

    try {
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          loadingPurchases: true
        }
      }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const page = vendors[vendorName].purchasePage;
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Join with sales table to exclude deleted sales. Filters applied here
      // must mirror passesFilters()/fetchVendorData() exactly, otherwise the
      // expanded item list disagrees with the vendor's summary totals above it.
      let query = supabase
        .from('sale_items')
        .select(`
          id,
          sale_id,
          vendor,
          product_name,
          buying_price,
          quantity,
          vendor_payment_status,
          created_at,
          sales!inner(
            date,
            delivery_guy,
            user_id,
            is_deleted,
            is_archived
          )
        `)
        .eq('vendor', vendorName)
        .eq('sales.user_id', user.id)
        .eq('sales.is_deleted', false)
        .eq('sales.is_archived', false);

      if (filters.dateRange.start) query = query.gte('sales.date', filters.dateRange.start);
      if (filters.dateRange.end) query = query.lte('sales.date', filters.dateRange.end);
      if (unpaidPurchases && !paidPurchases) query = query.eq('vendor_payment_status', 'Unpaid');
      if (paidPurchases && !unpaidPurchases) query = query.eq('vendor_payment_status', 'Paid');
      if (filters.searchTerm) query = query.ilike('product_name', `%${filters.searchTerm}%`);

      const { data: saleItemsData, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
        .returns<VendorSaleItem[]>();

      if (error) throw error;

      const newItems = saleItemsData || [];

      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          purchaseItems: page === 1 ? newItems : [...prev[vendorName].purchaseItems, ...newItems],
          hasMorePurchases: newItems.length === itemsPerPage,
          loadingPurchases: false,
          purchasesLoaded: true
        }
      }));

    } catch (error: any) {
      console.error('Error loading vendor purchases:', error);
      toast.error('Failed to load vendor purchases');

      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          loadingPurchases: false
        }
      }));
    }
  };

  const loadVendorExpenses = async (vendorName: string) => {
    if (!vendors[vendorName]) return;
    
    try {
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          loadingExpenses: true
        }
      }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const page = vendors[vendorName].expensePage;
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id)
        .eq('vendor_name', vendorName);

      if (filters.dateRange.start) query = query.gte('occurred_on', filters.dateRange.start);
      if (filters.dateRange.end) query = query.lte('occurred_on', filters.dateRange.end);

      const { data: expensesData, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
        .returns<VendorExpense[]>();

      if (error) throw error;

      const newItems = expensesData || [];
      
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          expenseItems: page === 1 ? newItems : [...prev[vendorName].expenseItems, ...newItems],
          hasMoreExpenses: newItems.length === itemsPerPage,
          loadingExpenses: false,
          expensesLoaded: true
        }
      }));
      
    } catch (error: any) {
      console.error('Error loading vendor expenses:', error);
      toast.error('Failed to load vendor expenses');
      
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          loadingExpenses: false
        }
      }));
    }
  };

  const loadMorePurchases = async (vendorName: string) => {
    if (!vendors[vendorName] || vendors[vendorName].loadingPurchases || !vendors[vendorName].hasMorePurchases) return;
    
    setVendors(prev => ({
      ...prev,
      [vendorName]: {
        ...prev[vendorName],
        purchasePage: prev[vendorName].purchasePage + 1
      }
    }));
    
    await loadVendorPurchases(vendorName);
  };

  const loadMoreExpenses = async (vendorName: string) => {
    if (!vendors[vendorName] || vendors[vendorName].loadingExpenses || !vendors[vendorName].hasMoreExpenses) return;
    
    setVendors(prev => ({
      ...prev,
      [vendorName]: {
        ...prev[vendorName],
        expensePage: prev[vendorName].expensePage + 1
      }
    }));
    
    await loadVendorExpenses(vendorName);
  };

  const handleExpandVendor = async (vendorName: string) => {
    if (expandedVendor === vendorName) {
      setExpandedVendor(null);
      return;
    }
    
    setExpandedVendor(vendorName);

    // Load initial data if not already loaded. Checked via purchasesLoaded/
    // expensesLoaded rather than an empty-array check — a vendor can
    // legitimately have zero purchases or zero expenses, and re-deriving
    // "loaded" from array length would re-fetch that empty list forever.
    if (!vendors[vendorName].purchasesLoaded) {
      await loadVendorPurchases(vendorName);
    }
    if (!vendors[vendorName].expensesLoaded) {
      await loadVendorExpenses(vendorName);
    }
  };

  const openAddExpenseModal = (vendorName: string) => {
    setSelectedVendorForExpense(vendorName);
    setAddExpenseForm({
      expense_type: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowAddExpenseModal(true);
  };

  const closeAddExpenseModal = () => {
    setShowAddExpenseModal(false);
    setSelectedVendorForExpense('');
    setAddExpenseForm({
      expense_type: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const handleAddExpenseFormChange = (field: keyof AddExpenseForm, value: any) => {
    setAddExpenseForm(prev => ({ ...prev, [field]: value }));
  };

  const startEditExpense = (expense: VendorExpense) => {
    setEditingExpenseId(expense.id);
    setEditExpenseForm({
      date: expense.occurred_on,
      expense_type: expense.expense_type,
      amount: expense.amount_kes,
      notes: expense.notes || ''
    });
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setEditExpenseForm({
      date: '',
      expense_type: '',
      amount: 0,
      notes: ''
    });
  };

  const saveEditExpense = async () => {
    if (!editingExpenseId) return;

    // Validation
    if (!editExpenseForm.date || !editExpenseForm.expense_type || editExpenseForm.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSavingExpenseId(editingExpenseId);

      // Routed through the shared vendor-expenses API (same one
      // ExpenseOverview.tsx uses) rather than a hand-rolled update, so the
      // two screens can't drift onto different column names again.
      const { updateVendorExpense } = await import('../../features/vendor-expenses/api');
      await updateVendorExpense(editingExpenseId, {
        expenseType: editExpenseForm.expense_type as ExpenseType,
        amountKES: editExpenseForm.amount,
        dateString: editExpenseForm.date,
        notes: editExpenseForm.notes || undefined,
      });

      // Update local state
      const vendorName = Object.keys(vendors).find(vendor => 
        vendors[vendor].expenseItems.some(expense => expense.id === editingExpenseId)
      );

      if (vendorName) {
        setVendors(prev => ({
          ...prev,
          [vendorName]: {
            ...prev[vendorName],
            expenseItems: prev[vendorName].expenseItems.map(expense =>
              expense.id === editingExpenseId
                ? {
                    ...expense,
                    occurred_on: editExpenseForm.date,
                    expense_type: editExpenseForm.expense_type,
                    amount_kes: editExpenseForm.amount,
                    notes: editExpenseForm.notes
                  }
                : expense
            )
          }
        }));

        // Recalculate vendor totals
        fetchVendorData();
      }

      toast.success('Expense updated successfully');
      setEditingExpenseId(null);

    } catch (error: any) {
      console.error('Error updating expense:', error);
      toast.error('Failed to update expense');
    } finally {
      setSavingExpenseId(null);
    }
  };

  const submitAddExpense = async () => {
    if (!addExpenseForm.expense_type || addExpenseForm.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmittingExpense(true);

      const { addVendorExpense } = await import('../../features/vendor-expenses/api');

      const newExpense = await addVendorExpense({
        vendorName: selectedVendorForExpense,
        expenseType: addExpenseForm.expense_type as ExpenseType,
        amountKES: addExpenseForm.amount,
        dateString: addExpenseForm.date,
        notes: addExpenseForm.notes || undefined
      });

      const expenseData: VendorExpense = {
        id: newExpense.id,
        vendor_name: selectedVendorForExpense,
        expense_type: newExpense.expense_type,
        amount_kes: newExpense.amount_kes,
        occurred_on: newExpense.occurred_on,
        notes: newExpense.notes,
        is_cleared: newExpense.is_cleared,
        cleared_at: newExpense.cleared_at,
        cleared_by: newExpense.cleared_by,
        created_at: newExpense.created_at,
        created_by: newExpense.created_by
      };

      // Update local state - add to vendor's expense items and update totals
      setVendors(prev => ({
        ...prev,
        [selectedVendorForExpense]: {
          ...prev[selectedVendorForExpense],
          expenseItems: [expenseData, ...prev[selectedVendorForExpense].expenseItems],
          totalExpenses: prev[selectedVendorForExpense].totalExpenses + addExpenseForm.amount,
          netOwed: prev[selectedVendorForExpense].totalPurchases - (prev[selectedVendorForExpense].totalExpenses + addExpenseForm.amount)
        }
      }));

      toast.success('Vendor expense added successfully');
      closeAddExpenseModal();
    } catch (error: any) {
      console.error('Error adding vendor expense:', error);
      toast.error(`Failed to add vendor expense: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const toggleVendorPaymentStatus = async (itemId: string, vendorName: string, currentStatus: 'Paid' | 'Unpaid', buyingPrice: number, quantity: number) => {
    try {
      // First check if the parent sale still exists and isn't deleted
      const item = vendors[vendorName].purchaseItems.find(p => p.id === itemId);
      if (!item) {
        toast.error('Cannot update payment status: item not found');
        return;
      }
      
      const newStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
      
      const { error } = await supabase
        .from('sale_items')
        .update({ vendor_payment_status: newStatus })
        .eq('id', itemId);

      if (error) throw error;

      // Calculate the exact price for this specific item
      const itemTotalPrice = buyingPrice * quantity;
      
      // Update local state
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          purchaseItems: prev[vendorName].purchaseItems.map(item => 
            item.id === itemId ? { ...item, vendor_payment_status: newStatus } : item
          ),
          // Update totals based on this specific item's price
          totalPurchases: newStatus === 'Unpaid' 
            ? prev[vendorName].totalPurchases + itemTotalPrice
            : prev[vendorName].totalPurchases - itemTotalPrice,
          netOwed: newStatus === 'Unpaid'
            ? prev[vendorName].netOwed + itemTotalPrice
            : prev[vendorName].netOwed - itemTotalPrice
        }
      }));
      
      toast.success(`Vendor payment status updated to ${newStatus.toLowerCase()}`);
    } catch (error: any) {
      console.error('Error toggling vendor payment status:', error);
      toast.error('Failed to update vendor payment status');
    }
  };

  const togglePurchaseSelection = (itemId: string) => {
    setSelectedPurchaseIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Purchases are paginated (itemsPerPage=20) so vendor.purchaseItems only
  // ever holds however many pages have been scrolled/loaded so far.
  // "Select all"/"Select unpaid" need every matching row regardless of what
  // happens to be loaded, so this queries ids directly rather than reading
  // off the paginated array — a lightweight query (just id +
  // vendor_payment_status, no product/price columns) mirroring the same
  // filter conditions loadVendorPurchases() applies.
  const fetchAllPurchaseIds = async (vendorName: string, options: { onlyUnpaid?: boolean } = {}): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('sale_items')
      .select('id, vendor_payment_status, sales!inner(date, user_id, is_deleted, is_archived)')
      .eq('vendor', vendorName)
      .eq('sales.user_id', user.id)
      .eq('sales.is_deleted', false)
      .eq('sales.is_archived', false);

    if (filters.dateRange.start) query = query.gte('sales.date', filters.dateRange.start);
    if (filters.dateRange.end) query = query.lte('sales.date', filters.dateRange.end);
    if (filters.searchTerm) query = query.ilike('product_name', `%${filters.searchTerm}%`);

    if (options.onlyUnpaid) {
      // "Select unpaid" always means unpaid, regardless of the Paid/Unpaid
      // visibility checkboxes — those control what's *shown*, not what this
      // explicit action targets.
      query = query.eq('vendor_payment_status', 'Unpaid');
    } else {
      const { unpaidPurchases, paidPurchases } = filters.paymentStatus;
      if (unpaidPurchases && !paidPurchases) query = query.eq('vendor_payment_status', 'Unpaid');
      if (paidPurchases && !unpaidPurchases) query = query.eq('vendor_payment_status', 'Paid');
    }

    const { data, error } = await query.range(0, 49999).returns<{ id: string; vendor_payment_status: string }[]>();
    if (error) {
      console.error('Error fetching all purchase ids for selection:', error);
      toast.error('Failed to load all items for selection');
      return [];
    }
    return (data ?? []).map(row => row.id);
  };

  const toggleSelectAllPurchases = async (vendorName: string) => {
    if (selectedPurchaseIds.size > 0) {
      setSelectedPurchaseIds(new Set());
      return;
    }
    setLoadingSelection(true);
    const ids = await fetchAllPurchaseIds(vendorName);
    setSelectedPurchaseIds(new Set(ids));
    setLoadingSelection(false);
  };

  const selectUnpaidPurchases = async (vendorName: string) => {
    setLoadingSelection(true);
    const ids = await fetchAllPurchaseIds(vendorName, { onlyUnpaid: true });
    setSelectedPurchaseIds(new Set(ids));
    setLoadingSelection(false);
  };

  // Batched into one `.in(...)` update instead of looping
  // toggleVendorPaymentStatus per id — a vendor can easily have 100+ unpaid
  // items, and firing that many individual requests (plus individual toasts)
  // would be both slow and noisy.
  const bulkUpdateVendorPaymentStatus = async (itemIds: string[], newStatus: 'Paid' | 'Unpaid') => {
    if (itemIds.length === 0) return;
    const verb = newStatus === 'Paid' ? 'paid' : 'unpaid';

    try {
      setBulkUpdating(true);

      const { error } = await supabase
        .from('sale_items')
        .update({ vendor_payment_status: newStatus })
        .in('id', itemIds);
      if (error) throw error;

      // Selection can now span far more items than are actually paginated
      // into vendor.purchaseItems (see fetchAllPurchaseIds), so a delta
      // computed only over currently-loaded items would silently under- or
      // over-count totalPurchases/netOwed whenever the bulk action touched
      // an item that isn't loaded. fetchVendorData() recomputes every
      // vendor's totals from the full, unpaginated data — correct
      // regardless of how much of the list happens to be loaded — and
      // resets purchasesLoaded, which the existing auto-reload effect
      // (keyed on [vendors, expandedVendor]) picks up to refresh the
      // expanded vendor's visible item list too.
      await fetchVendorData();

      setSelectedPurchaseIds(new Set());
      toast.success(`Marked ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} as ${verb}`);
    } catch (error: any) {
      console.error('Error bulk updating vendor payment status:', error);
      toast.error(error.message || 'Failed to update selected items');
    } finally {
      setBulkUpdating(false);
      setPendingBulkStatus(null);
    }
  };

  const toggleExpenseCleared = async (expense: VendorExpense, vendorName: string) => {
    const newClearedState = !expense.is_cleared;

    try {
      const { setExpenseCleared } = await import('../../features/vendor-expenses/api');

      // Optimistically update UI
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          expenseItems: prev[vendorName].expenseItems.map(exp =>
            exp.id === expense.id
              ? { ...exp, is_cleared: newClearedState }
              : exp
          )
        }
      }));

      await setExpenseCleared(expense.id, newClearedState);

      toast.success(newClearedState ? 'Expense marked as paid' : 'Expense marked as unpaid');
    } catch (error: any) {
      console.error('Error toggling expense cleared state:', error);
      toast.error(error.message || 'Failed to update expense');

      // Revert optimistic update
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          expenseItems: prev[vendorName].expenseItems.map(exp =>
            exp.id === expense.id
              ? { ...exp, is_cleared: expense.is_cleared }
              : exp
          )
        }
      }));
    }
  };

  const deleteExpense = async (expenseId: string, vendorName: string) => {
    setPendingDeleteExpenseId(null);
    try {
      const { deleteVendorExpense } = await import('../../features/vendor-expenses/api');

      // Optimistically update UI
      const expenseToDelete = vendors[vendorName].expenseItems.find(e => e.id === expenseId);

      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          expenseItems: prev[vendorName].expenseItems.filter(exp => exp.id !== expenseId),
          totalExpenses: prev[vendorName].totalExpenses - (expenseToDelete?.amount_kes || 0),
          netOwed: prev[vendorName].totalPurchases - (prev[vendorName].totalExpenses - (expenseToDelete?.amount_kes || 0))
        }
      }));

      await deleteVendorExpense(expenseId);

      toast.success('Expense deleted successfully');
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast.error(error.message || 'Failed to delete expense');

      // Refresh data on error
      fetchVendorData();
    }
  };

  const markAllPaidForVendor = async (vendorName: string) => {
    setPendingMarkAllPaidVendor(null);
    try {
      const { markAllPaidForVendor: markAllPaidAPI } = await import('../../features/vendor-expenses/api');

      const count = await markAllPaidAPI(vendorName);

      // Refresh vendor data
      await fetchVendorData();

      toast.success(count > 0 ? `Marked ${count} expenses as paid` : 'All expenses marked as paid');
    } catch (error: any) {
      console.error('Error marking all expenses as paid:', error);
      toast.error(error.message || 'Failed to mark all expenses as paid');
    }
  };

  const openShareModal = (vendorName: string) => {
    setSelectedVendor(vendorName);
    setShareModalOpen(true);
  };
  
  const closeShareModal = () => {
    setShareModalOpen(false);
    setSelectedVendor(null);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-purple-100">
            <User className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>
              Vendor Transactions
            </h2>
            <p className="text-gray-600">Track purchases and expenses per vendor</p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div 
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-800">Filter Transactions</h3>
          </div>
          {showFilters ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        {showFilters && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Date Range */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Date Range
                </h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              {/* Payment Status Toggles */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  Payment Status
                </h4>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Purchases</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.paymentStatus.unpaidPurchases}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        paymentStatus: { ...prev.paymentStatus, unpaidPurchases: e.target.checked }
                      }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Unpaid Purchases</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.paymentStatus.paidPurchases}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        paymentStatus: { ...prev.paymentStatus, paidPurchases: e.target.checked }
                      }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Paid Purchases</span>
                  </label>
                </div>
              </div>
              
              {/* Search Input */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 flex items-center gap-1">
                  <Search className="w-4 h-4 text-gray-500" />
                  Search
                </h4>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Product Name</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.searchTerm}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        searchTerm: e.target.value
                      }))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Search by product name..."
                    />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={applyFilters}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearFilters}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vendor Statement Modal */}
      {shareModalOpen && selectedVendor && (
        <VendorStatement
          isOpen={shareModalOpen}
          onClose={closeShareModal}
          vendorName={selectedVendor}
        />
      )}

      {/* Vendor Cards */}
      <div className="space-y-4">
        {Object.keys(vendors).length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center text-gray-500">
            No vendor data found
          </div>
        ) : (
          Object.values(vendors).map((vendor) => (
            <div 
              key={vendor.name} 
              className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 ${
                vendor.netOwed > 0 ? 'border-l-4 border-l-red-500' : 
                vendor.netOwed < 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300'
              }`}
            >
              {/* Vendor Header */}
              <div 
                className={`p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                  expandedVendor === vendor.name ? 'bg-gray-50 border-b border-gray-200' : ''
                }`}
                onClick={() => handleExpandVendor(vendor.name)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{vendor.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        vendor.netOwed > 0 
                          ? 'bg-red-100 text-red-800' 
                          : vendor.netOwed < 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {vendor.netOwed > 0 
                          ? 'Owed to Vendor' 
                          : vendor.netOwed < 0 
                            ? 'Vendor Owes Me' 
                            : 'Balanced'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Add Expense Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddExpenseModal(vendor.name);
                    }}
                    disabled={editingExpenseId !== null}
                    className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-lg transition-colors"
                    title="Add Expense"
                  >
                    <Plus className="w-3 h-3" />
                    Add Expense
                  </button>
                  
                  {/* Share Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openShareModal(vendor.name);
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    title="Share this vendor's transactions"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                  
                  {expandedVendor === vendor.name ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Vendor Summary */}
              <div className="p-5 border-t border-gray-200 bg-gray-50">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Unpaid Purchases</p>
                    <p className="font-medium">{formatCurrency(vendor.totalPurchases)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Expenses</p>
                    <p className="font-medium text-green-600">{formatCurrency(vendor.totalExpenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Owed</p>
                    <p className={`font-bold ${
                      vendor.netOwed > 0 ? 'text-red-600' : 
                      vendor.netOwed < 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(Math.abs(vendor.netOwed))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedVendor === vendor.name && (
                <div className="border-t border-gray-200">
                  <div className="p-6 space-y-6">
                    {/* Purchase Items */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
                        <Package className="w-4 h-4 text-blue-500" />
                        Purchase Items
                      </h5>

                      {vendor.purchaseItems.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={vendor.purchaseItems.every(i => selectedPurchaseIds.has(i.id))}
                              disabled={loadingSelection}
                              onChange={() => toggleSelectAllPurchases(vendor.name)}
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                            />
                            Select all{loadingSelection ? '…' : ''}
                          </label>
                          <button
                            type="button"
                            disabled={loadingSelection}
                            onClick={() => selectUnpaidPurchases(vendor.name)}
                            className="text-xs font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Select unpaid
                          </button>

                          {selectedPurchaseIds.size > 0 && !pendingBulkStatus && (
                            <>
                              <span className="h-4 w-px bg-gray-300" />
                              <span className="text-xs text-gray-500">{selectedPurchaseIds.size} selected</span>
                              <button
                                type="button"
                                onClick={() => setPendingBulkStatus('Paid')}
                                disabled={bulkUpdating}
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingBulkStatus('Unpaid')}
                                disabled={bulkUpdating}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-xs font-medium rounded-lg transition-colors"
                              >
                                Mark Unpaid
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPurchaseIds(new Set())}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Clear
                              </button>
                            </>
                          )}

                          {selectedPurchaseIds.size > 0 && pendingBulkStatus && (
                            <>
                              <span className="h-4 w-px bg-gray-300" />
                              <span className="text-xs font-medium text-gray-700">
                                Mark {selectedPurchaseIds.size} item{selectedPurchaseIds.size !== 1 ? 's' : ''} as {pendingBulkStatus.toLowerCase()}?
                              </span>
                              <button
                                type="button"
                                onClick={() => bulkUpdateVendorPaymentStatus(Array.from(selectedPurchaseIds), pendingBulkStatus)}
                                disabled={bulkUpdating}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                {bulkUpdating ? 'Saving…' : 'Yes, confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingBulkStatus(null)}
                                disabled={bulkUpdating}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {vendor.purchaseItems.length === 0 && !vendor.loadingPurchases ? (
                          <div className="text-center py-8 text-gray-500">
                            No purchase items found
                          </div>
                        ) : (
                          <>
                            {vendor.purchaseItems.map((item, index) => {
                              const sale = allSales[item.sale_id];
                              const totalPrice = item.buying_price * item.quantity;
                              
                              return (
                                <div 
                                  key={item.id}
                                  className="p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                                  ref={index === vendor.purchaseItems.length - 1 ? (node) => lastPurchaseElementRef(node, vendor.name) : undefined}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedPurchaseIds.has(item.id)}
                                        onChange={() => togglePurchaseSelection(item.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                      />
                                      <Calendar className="w-4 h-4 text-gray-500" />
                                      <span className="text-sm font-medium text-gray-700">{formatDate(sale?.date || item.created_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{formatCurrency(totalPrice)}</span>
                                      <div className="relative inline-block w-10 align-middle select-none">
                                        <input
                                          type="checkbox"
                                          checked={item.vendor_payment_status === 'Paid'}
                                          onChange={() => toggleVendorPaymentStatus(item.id, vendor.name, item.vendor_payment_status, item.buying_price, item.quantity)}
                                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        />
                                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                                          item.vendor_payment_status === 'Paid' ? 'bg-green-400' : 'bg-red-400'
                                        }`}></label>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="mb-2">
                                    <div className="flex items-center gap-1">
                                      <Package className="w-4 h-4 text-gray-500" />
                                      <span className="text-sm font-medium text-gray-700">{item.product_name}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="w-4 h-4 text-gray-500" />
                                      <span className="text-sm text-gray-600">
                                        {formatCurrency(item.buying_price)} × {item.quantity}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Truck className="w-4 h-4 text-gray-500" />
                                      <span className="text-sm text-gray-600">{sale?.delivery_guy || 'No delivery person'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Loading indicator for purchases */}
                            {vendor.loadingPurchases && (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                              </div>
                            )}
                            
                            {/* Load more button for purchases */}
                            {vendor.hasMorePurchases && !vendor.loadingPurchases && (
                              <div className="flex justify-center pt-3">
                                <button
                                  onClick={() => loadMorePurchases(vendor.name)}
                                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                  Load More...
                                </button>
                              </div>
                            )}
                            
                            {/* All caught up message for purchases */}
                            {!vendor.hasMorePurchases && vendor.purchaseItems.length > 0 && !vendor.loadingPurchases && (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                All caught up!
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expense Items */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-700 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          Expense Items
                        </h5>
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={showClearedExpenses}
                              onChange={(e) => setShowClearedExpenses(e.target.checked)}
                              className="rounded"
                            />
                            Show cleared
                          </label>
                          {vendor.expenseItems.some(e => !e.is_cleared) && (
                            pendingMarkAllPaidVendor === vendor.name ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">Mark all as paid?</span>
                                <button
                                  onClick={() => markAllPaidForVendor(vendor.name)}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  Yes, confirm
                                </button>
                                <button
                                  onClick={() => setPendingMarkAllPaidVendor(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPendingMarkAllPaidVendor(vendor.name)}
                                className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg shadow-sm hover:shadow transition-all"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Mark all paid
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {vendor.expenseItems.filter(e => showClearedExpenses || !e.is_cleared).length === 0 && !vendor.loadingExpenses ? (
                          <div className="text-center py-8 text-gray-500">
                            {showClearedExpenses ? 'No expense items found' : 'No outstanding expense items'}
                          </div>
                        ) : (
                          <>
                            {vendor.expenseItems.filter(e => showClearedExpenses || !e.is_cleared).map((expense, index) => (
                              <div
                                key={expense.id}
                                className={`p-4 border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
                                  editingExpenseId === expense.id
                                    ? 'border-blue-300 bg-blue-50'
                                    : expense.is_cleared
                                      ? 'border-green-300 bg-green-50/50 opacity-75'
                                      : 'border-gray-200 bg-white'
                                }`}
                                ref={index === vendor.expenseItems.length - 1 ? (node) => lastExpenseElementRef(node, vendor.name) : undefined}
                              >
                                {editingExpenseId === expense.id ? (
                                  // Edit Mode
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="font-medium text-blue-800">Edit Expense</h4>
                                      {savingExpenseId === expense.id && (
                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                      )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                                        <input
                                          type="date"
                                          value={editExpenseForm.date}
                                          onChange={(e) => setEditExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          disabled={savingExpenseId === expense.id}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Expense Type *</label>
                                        <input
                                          type="text"
                                          value={editExpenseForm.expense_type}
                                          onChange={(e) => setEditExpenseForm(prev => ({ ...prev, expense_type: e.target.value }))}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="Expense type"
                                          disabled={savingExpenseId === expense.id}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={editExpenseForm.amount}
                                          onChange={(e) => setEditExpenseForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="0.00"
                                          disabled={savingExpenseId === expense.id}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                        <input
                                          type="text"
                                          value={editExpenseForm.notes}
                                          onChange={(e) => setEditExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="Optional notes"
                                          disabled={savingExpenseId === expense.id}
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                                      <button
                                        type="button"
                                        onClick={cancelEditExpense}
                                        disabled={savingExpenseId === expense.id}
                                        className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded transition-colors flex items-center gap-1"
                                      >
                                        <X className="w-3 h-3" />
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={saveEditExpense}
                                        disabled={savingExpenseId === expense.id}
                                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors flex items-center gap-1"
                                      >
                                        {savingExpenseId === expense.id ? (
                                          <>
                                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                          </>
                                        ) : (
                                          <>
                                            <Save className="w-3 h-3" />
                                            Save
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // Display Mode
                                  <div>
                                    {/* Paid checkbox */}
                                    <div className="flex items-center gap-3 mb-2 pb-2 border-b">
                                      <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={expense.is_cleared || false}
                                          onChange={() => toggleExpenseCleared(expense, vendor.name)}
                                          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className={`text-sm font-medium ${expense.is_cleared ? 'text-green-700' : 'text-gray-600'}`}>
                                          {expense.is_cleared ? 'Paid' : 'Mark as paid'}
                                        </span>
                                      </label>
                                      {expense.is_cleared && expense.cleared_at && (
                                        <span className="text-xs text-gray-500">
                                          on {formatDate(expense.cleared_at)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-700">{formatDate(expense.occurred_on)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{formatCurrency(expense.amount_kes)}</span>
                                        <div className="flex items-center gap-1">
                                          {pendingDeleteExpenseId === expense.id ? (
                                            <>
                                              <span className="text-xs text-gray-600">Delete?</span>
                                              <button
                                                onClick={() => deleteExpense(expense.id, vendor.name)}
                                                className="text-xs font-medium text-red-600 hover:text-red-800 px-1"
                                              >
                                                Yes
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteExpenseId(null)}
                                                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1"
                                              >
                                                No
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => startEditExpense(expense)}
                                                disabled={editingExpenseId !== null}
                                                className="text-blue-500 hover:text-blue-700 disabled:text-gray-400 p-1 hover:bg-blue-50 rounded"
                                                title="Edit expense"
                                              >
                                                <Edit className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteExpenseId(expense.id)}
                                                disabled={editingExpenseId !== null}
                                                className="text-red-500 hover:text-red-700 disabled:text-gray-400 p-1 hover:bg-red-50 rounded"
                                                title="Delete expense"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mb-2">
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="w-4 h-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-700">{expense.expense_type}</span>
                                      </div>
                                    </div>

                                    {expense.notes && (
                                      <div className="text-sm text-gray-600 mt-2">
                                        {expense.notes}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {/* Loading indicator for expenses */}
                            {vendor.loadingExpenses && (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                              </div>
                            )}
                            
                            {/* Load more button for expenses */}
                            {vendor.hasMoreExpenses && !vendor.loadingExpenses && (
                              <div className="flex justify-center pt-3">
                                <button
                                  onClick={() => loadMoreExpenses(vendor.name)}
                                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                  Load More...
                                </button>
                              </div>
                            )}
                            
                            {/* All caught up message for expenses */}
                            {!vendor.hasMoreExpenses && vendor.expenseItems.length > 0 && !vendor.loadingExpenses && (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                All caught up!
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                Add Expense for {selectedVendorForExpense}
              </h3>
              <button
                onClick={closeAddExpenseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Expense Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expense Type *
                </label>
                <select
                  value={addExpenseForm.expense_type}
                  onChange={(e) => handleAddExpenseFormChange('expense_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Select expense type</option>
                  {EXPENSE_TYPE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addExpenseForm.amount}
                  onChange={(e) => handleAddExpenseFormChange('amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={addExpenseForm.date}
                  onChange={(e) => handleAddExpenseFormChange('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={addExpenseForm.notes}
                  onChange={(e) => handleAddExpenseFormChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Additional details about this expense..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-6 border-t border-gray-200">
              <button
                onClick={closeAddExpenseModal}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAddExpense}
                disabled={submittingExpense}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors"
              >
                {submittingExpense ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Add Expense
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorTransactions;