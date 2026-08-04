import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, DollarSign, AlertTriangle, CheckCircle, Calendar, MapPin, Package, Filter, ChevronDown, ChevronRight, Search, Plus, Share2, X, Loader2, CreditCard as Edit, Save, Truck, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import LoadingScreen from '../LoadingScreen';
import ShareVendorReport from './ShareVendorReport';
import toast from 'react-hot-toast';

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
  csvDateRange: {
    start: string;
    end: string;
  };
  paymentStatus: {
    unpaidPurchases: boolean;
    paidPurchases: boolean;
    unreimbursedExpenses: boolean;
    reimbursedExpenses: boolean;
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
}

interface SaleData {
  id: string;
  date: string;
  delivery_guy: string;
}

const VendorTransactions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<{[key: string]: VendorData}>({});
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [shareDateRange, setShareDateRange] = useState({
    start: '',
    end: ''
  });
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
  const itemsPerPage = 20;
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: '',
      end: ''
    },
    csvDateRange: {
      start: '',
      end: ''
    },
    paymentStatus: {
      unpaidPurchases: true,
      paidPurchases: true,
      unreimbursedExpenses: true,
      reimbursedExpenses: true
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
            is_deleted
          )
        `)
        .eq('sales.user_id', user.id)
        .eq('sales.is_deleted', false)
        .order('created_at', { ascending: false });
      
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
        .order('created_at', { ascending: false });

      if (vendorExpensesError) {
        console.error('Error fetching vendor expenses:', vendorExpensesError);
        toast.error('Failed to load vendor expenses');
        return;
      }

      // Group data by vendor
      const vendorGroups: {[key: string]: VendorData} = {};
      
      // Process sale items - each item is credited only to its specific vendor
      validSaleItems.forEach(item => {
        const vendorName = item.vendor.trim(); // Exact vendor name from the sale_item
        
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
            loadingExpenses: false
          };
        }
        
        // Credit this specific item's buying price only to this vendor
        const itemTotalPrice = item.buying_price * item.quantity;
        
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
            loadingExpenses: false
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
    // Date range filter
    const itemDate = type === 'purchase' ? item.created_at : item.date;
    if (filters.dateRange.start && itemDate < filters.dateRange.start) return false;
    if (filters.dateRange.end && itemDate > filters.dateRange.end) return false;
    
    // Payment status filter
    if (type === 'purchase') {
      const isPaid = item.vendor_payment_status === 'Paid';
      if (isPaid && !filters.paymentStatus.paidPurchases) return false;
      if (!isPaid && !filters.paymentStatus.unpaidPurchases) return false;
    } else {
      // Skip expense filtering (no reimbursement status in new schema)
      // All expenses pass through
    }
    
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
      csvDateRange: {
        start: '',
        end: ''
      },
      paymentStatus: {
        unpaidPurchases: true,
        paidPurchases: true,
        unreimbursedExpenses: true,
        reimbursedExpenses: true
      },
      searchTerm: ''
    });
    fetchVendorData();
    toast.success('Filters cleared');
  };

  const loadVendorPurchases = async (vendorName: string) => {
    if (!vendors[vendorName]) return;
    
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

      // Join with sales table to exclude deleted sales
      const { data: saleItemsData, error } = await supabase
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
            is_deleted
          )
        `)
        .eq('vendor', vendorName)
        .eq('sales.user_id', user.id)
        .eq('sales.is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      const newItems = saleItemsData || [];
      
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          purchaseItems: page === 1 ? newItems : [...prev[vendorName].purchaseItems, ...newItems],
          hasMorePurchases: newItems.length === itemsPerPage,
          loadingPurchases: false
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

      const { data: expensesData, error } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id)
        .eq('vendor_name', vendorName)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      const newItems = expensesData || [];
      
      setVendors(prev => ({
        ...prev,
        [vendorName]: {
          ...prev[vendorName],
          expenseItems: page === 1 ? newItems : [...prev[vendorName].expenseItems, ...newItems],
          hasMoreExpenses: newItems.length === itemsPerPage,
          loadingExpenses: false
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
    
    // Load initial data if not already loaded
    if (vendors[vendorName].purchaseItems.length === 0) {
      await loadVendorPurchases(vendorName);
    }
    if (vendors[vendorName].expenseItems.length === 0) {
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

      const { error } = await supabase
        .from('vendor_expenses')
        .update({
          date: editExpenseForm.date,
          expense_type: editExpenseForm.expense_type,
          amount: editExpenseForm.amount,
          notes: editExpenseForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingExpenseId);

      if (error) throw error;

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
                    date: editExpenseForm.date,
                    expense_type: editExpenseForm.expense_type,
                    amount: editExpenseForm.amount,
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
        expenseType: addExpenseForm.expense_type as 'Payment' | 'Refund' | 'Adjustment' | 'Other',
        amountKES: addExpenseForm.amount,
        dateString: addExpenseForm.date,
        notes: addExpenseForm.notes || undefined
      });

      const expenseData = {
        id: newExpense.id,
        vendor_name: selectedVendorForExpense,
        expense_type: newExpense.expense_type,
        amount_kes: newExpense.amount_kes,
        occurred_on: newExpense.occurred_on,
        notes: newExpense.notes,
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

  // Reimbursement feature removed - not in new schema
  const toggleExpenseReimbursement = async (expenseId: string, vendorName: string, currentReimbursed: boolean, amount: number) => {
    toast.error('Reimbursement tracking is not available in the current version');
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
    if (!confirm('Delete this expense? This cannot be undone.')) return;

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
    if (!confirm(`Mark all outstanding expenses for ${vendorName} as paid?`)) return;

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
    // Reset date filters
    setStartDate('');
    setEndDate('');
    // Reset date range when opening modal
    setShareDateRange({
      start: '',
      end: ''
    });
  };
  
  // Generate vendor transactions for sharing
  const generateVendorTransactions = (vendorName: string) => {
    const vendor = vendors[vendorName];
    if (!vendor) return [];

    const transactions: {
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
    }[] = [];
    
    let filteredPurchases = vendor.purchaseItems;
    let filteredExpenses = vendor.expenseItems;
    
    if (shareDateRange.start || shareDateRange.end) {
      if (shareDateRange.start) {
        filteredPurchases = filteredPurchases.filter(item => {
          const saleDate = allSales[item.sale_id]?.date || item.created_at;
          return saleDate >= shareDateRange.start;
        });
        filteredExpenses = filteredExpenses.filter(expense =>
          expense.occurred_on >= shareDateRange.start
        );
      }
      
      if (shareDateRange.end) {
        filteredPurchases = filteredPurchases.filter(item => {
          const saleDate = allSales[item.sale_id]?.date || item.created_at;
          return saleDate <= shareDateRange.end;
        });
        filteredExpenses = filteredExpenses.filter(expense =>
          expense.occurred_on <= shareDateRange.end
        );
      }
    }

    // Filter transactions by CSV date range
    const purchaseTransactions = filteredPurchases.filter(item => {
      const sale = allSales[item.sale_id];
      const itemDate = sale?.date || item.created_at;
      if (filters.csvDateRange.start && itemDate < filters.csvDateRange.start) return false;
      if (filters.csvDateRange.end && itemDate > filters.csvDateRange.end) return false;
      return true;
    }).map(item => ({
      id: item.id,
      date: allSales[item.sale_id]?.date || item.created_at,
      type: 'Purchase' as const,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.buying_price,
      amount: item.buying_price * item.quantity,
      vendor: item.vendor,
      delivery_person: allSales[item.sale_id]?.delivery_guy || '',
      status: item.vendor_payment_status,
      notes: ''
    }));

    const expenseTransactions = vendor.expenseItems.filter(expense => {
      if (filters.csvDateRange.start && expense.occurred_on < filters.csvDateRange.start) return false;
      if (filters.csvDateRange.end && expense.occurred_on > filters.csvDateRange.end) return false;
      return true;
    }).map(expense => ({
      id: expense.id,
      date: expense.occurred_on,
      type: 'Expense' as const,
      product_name: expense.expense_type,
      quantity: 1,
      unit_price: expense.amount_kes,
      amount: expense.amount_kes,
      vendor: expense.vendor_name,
      delivery_person: '',
      status: 'Expense',
      notes: expense.notes || ''
    }));

    return [...purchaseTransactions, ...expenseTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };
  
  const closeShareModal = () => {
    setShareModalOpen(false);
    setSelectedVendor(null);
    setShareEmail('');
    setShareDateRange({
      start: '',
      end: ''
    });
    setShareLoading(false);
    setStartDate('');
    setEndDate('');
  };

  const generateVendorReport = (vendorName: string) => {
    const vendor = vendors[vendorName];
    if (!vendor) return null;

    const transactions: {
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
    }[] = [];
    let filteredPurchases = vendor.purchaseItems;
    let filteredExpenses = vendor.expenseItems;
    
    if (shareDateRange.start || shareDateRange.end) {
      if (shareDateRange.start) {
        filteredPurchases = filteredPurchases.filter(item => {
          const saleDate = allSales[item.sale_id]?.date || item.created_at;
          return saleDate >= shareDateRange.start;
        });
        filteredExpenses = filteredExpenses.filter(expense =>
          expense.occurred_on >= shareDateRange.start
        );
      }
      
      if (shareDateRange.end) {
        filteredPurchases = filteredPurchases.filter(item => {
          const saleDate = allSales[item.sale_id]?.date || item.created_at;
          return saleDate <= shareDateRange.end;
        });
        filteredExpenses = filteredExpenses.filter(expense =>
          expense.occurred_on <= shareDateRange.end
        );
      }
    }

    // Filter transactions by CSV date range
    const purchaseTransactions = filteredPurchases.filter(item => {
      const sale = allSales[item.sale_id];
      const itemDate = sale?.date || item.created_at;
      if (filters.csvDateRange.start && itemDate < filters.csvDateRange.start) return false;
      if (filters.csvDateRange.end && itemDate > filters.csvDateRange.end) return false;
      return true;
    }).map(item => ({
      id: item.id,
      date: allSales[item.sale_id]?.date || item.created_at,
      type: 'Purchase' as const,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.buying_price,
      amount: item.buying_price * item.quantity,
      vendor: item.vendor,
      delivery_person: allSales[item.sale_id]?.delivery_guy || '',
      status: item.vendor_payment_status,
      notes: ''
    }));

    const expenseTransactions = vendor.expenseItems.filter(expense => {
      if (filters.csvDateRange.start && expense.occurred_on < filters.csvDateRange.start) return false;
      if (filters.csvDateRange.end && expense.occurred_on > filters.csvDateRange.end) return false;
      return true;
    }).map(expense => ({
      id: expense.id,
      date: expense.occurred_on,
      type: 'Expense' as const,
      product_name: expense.expense_type,
      quantity: 1,
      unit_price: expense.amount_kes,
      amount: expense.amount_kes,
      vendor: expense.vendor_name,
      delivery_person: '',
      status: 'Expense',
      notes: expense.notes || ''
    }));

    return [...purchaseTransactions, ...expenseTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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
                <div className="space-y-2">
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
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">Expenses</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.paymentStatus.unreimbursedExpenses}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          paymentStatus: { ...prev.paymentStatus, unreimbursedExpenses: e.target.checked }
                        }))}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Unreimbursed Expenses</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.paymentStatus.reimbursedExpenses}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          paymentStatus: { ...prev.paymentStatus, reimbursedExpenses: e.target.checked }
                        }))}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Reimbursed Expenses</span>
                    </label>
                  </div>
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

      {/* Share Modal */}
      {shareModalOpen && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Share2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Share Vendor Report</h3>
                </div>
                <button
                  onClick={closeShareModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Share transaction report for <strong>{selectedVendor}</strong>
                </p>
                
                {/* Date Range Selection for Share */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range for Export (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={shareDateRange.start}
                        onChange={(e) => setShareDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={shareDateRange.end}
                        onChange={(e) => setShareDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Vendor Report Modal */}
      {shareModalOpen && selectedVendor && (
        <ShareVendorReport
          isOpen={shareModalOpen}
          onClose={closeShareModal}
          vendorName={selectedVendor}
          vendorTransactions={generateVendorTransactions(selectedVendor)}
          totalPurchases={vendors[selectedVendor]?.totalPurchases || 0}
          totalExpenses={vendors[selectedVendor]?.totalExpenses || 0}
          netOwed={vendors[selectedVendor]?.netOwed || 0}
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
                    <p className="text-xs text-gray-500">Total Purchases</p>
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
                  {/* CSV Export Date Range */}
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      CSV Export Date Range
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={filters.csvDateRange.start}
                          onChange={(e) => setFilters(prev => ({
                            ...prev,
                            csvDateRange: { ...prev.csvDateRange, start: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">End Date</label>
                        <input
                          type="date"
                          value={filters.csvDateRange.end}
                          onChange={(e) => setFilters(prev => ({
                            ...prev,
                            csvDateRange: { ...prev.csvDateRange, end: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      {filters.csvDateRange.start || filters.csvDateRange.end ? (
                        <span>
                          Export will include transactions from{' '}
                          {filters.csvDateRange.start ? formatDate(filters.csvDateRange.start) : 'beginning'} to{' '}
                          {filters.csvDateRange.end ? formatDate(filters.csvDateRange.end) : 'end'}
                        </span>
                      ) : (
                        <span>Export will include all transactions (no date filter)</span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Purchase Items */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
                        <Package className="w-4 h-4 text-blue-500" />
                        Purchase Items
                      </h5>
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
                                    <div className="flex items-center gap-1">
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
                            <button
                              onClick={() => markAllPaidForVendor(vendor.name)}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg shadow-sm hover:shadow transition-all"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark all paid
                            </button>
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
                                          <button
                                            onClick={() => startEditExpense(expense)}
                                            disabled={editingExpenseId !== null}
                                            className="text-blue-500 hover:text-blue-700 disabled:text-gray-400 p-1 hover:bg-blue-50 rounded"
                                            title="Edit expense"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => deleteExpense(expense.id, vendor.name)}
                                            disabled={editingExpenseId !== null}
                                            className="text-red-500 hover:text-red-700 disabled:text-gray-400 p-1 hover:bg-red-50 rounded"
                                            title="Delete expense"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
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
                  <option value="Payment">Payment</option>
                  <option value="Reimbursement">Reimbursement</option>
                  <option value="Advance">Advance</option>
                  <option value="Commission">Commission</option>
                  <option value="Bonus">Bonus</option>
                  <option value="Transport">Transport</option>
                  <option value="Materials">Materials</option>
                  <option value="Other">Other</option>
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