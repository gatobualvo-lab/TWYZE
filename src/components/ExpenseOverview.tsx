import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, PieChart, BarChart3, ChevronDown, ChevronRight, Users, Plus, CreditCard as Edit, Trash2, Save, X, Check, RefreshCw, CheckCircle2, AlertTriangle, Archive } from 'lucide-react';
import { supabase } from '../utils/supabase';
import EnhancedDropdown from './EnhancedDropdown';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';
import {
  deleteVendorExpense as deleteVendorExpenseAPI,
  updateVendorExpense as updateVendorExpenseAPI,
  setExpenseCleared,
  markAllPaidForVendor
} from '../features/vendor-expenses/api';

interface AdExpense {
  id: string;
  ad_platform: string;
  ad_type: string;
  amount_kes: number;
  occurred_on: string;
  notes: string | null;
  created_at: string;
}

interface GeneralExpense {
  id: string;
  expense_type: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

interface SupplierExpense {
  id: string;
  vendor: string;
  expense_type: string;
  amount: number;
  date: string;
  notes: string | null;
  is_cleared?: boolean;
  cleared_at?: string | null;
  cleared_by?: string | null;
  created_at: string;
}

const ExpenseOverview: React.FC = () => {
  const [adExpenses, setAdExpenses] = useState<AdExpense[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [filteredGeneralExpenses, setFilteredGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isSupplierExpensesExpanded, setIsSupplierExpensesExpanded] = useState(false);
  const [userVendors, setUserVendors] = useState<string[]>([]);
  
  // New vendor expenses state
  const [vendorExpenses, setVendorExpenses] = useState<{[key: string]: SupplierExpense[]}>({});
  const [vendorExpensesPage, setVendorExpensesPage] = useState<{[key: string]: number}>({});
  const [vendorExpensesHasMore, setVendorExpensesHasMore] = useState<{[key: string]: boolean}>({});
  const [vendorExpensesLoading, setVendorExpensesLoading] = useState<{[key: string]: boolean}>({});
  const [showAddVendorExpense, setShowAddVendorExpense] = useState(false);
  const [editingVendorExpense, setEditingVendorExpense] = useState<SupplierExpense | null>(null);
  const [vendorBalances, setVendorBalances] = useState<{[key: string]: {
    totalOwed: number;
    totalExpenses: number;
    balance: number;
  }}>({});
  
  const [vendorExpenseForm, setVendorExpenseForm] = useState({
    vendor: '',
    expense_type: 'Payment',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [showClearedExpenses, setShowClearedExpenses] = useState(true);

  const [editingAdExpense, setEditingAdExpense] = useState<AdExpense | null>(null);
  const [adExpenseForm, setAdExpenseForm] = useState({
    ad_platform: '',
    ad_type: '',
    amount_kes: 0,
    occurred_on: '',
    notes: '',
  });
  const [editingGeneralExpense, setEditingGeneralExpense] = useState<GeneralExpense | null>(null);
  const [generalExpenseForm, setGeneralExpenseForm] = useState({
    expense_type: '',
    amount: 0,
    date: '',
    notes: '',
  });
  const [savingExpenseEdit, setSavingExpenseEdit] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [showArchivedExpenses, setShowArchivedExpenses] = useState(false);
  const [bulkUnarchiving, setBulkUnarchiving] = useState(false);

  const openEditAdExpense = (expense: AdExpense) => {
    setEditingAdExpense(expense);
    setAdExpenseForm({
      ad_platform: expense.ad_platform ?? '',
      ad_type: expense.ad_type ?? '',
      amount_kes: Number(expense.amount_kes ?? 0),
      occurred_on: expense.occurred_on ?? '',
      notes: expense.notes ?? '',
    });
  };

  const saveAdExpenseEdit = async () => {
    if (!editingAdExpense) return;
    if (!adExpenseForm.ad_platform.trim()) {
      toast.error('Ad platform is required');
      return;
    }
    if (!Number.isFinite(adExpenseForm.amount_kes) || adExpenseForm.amount_kes <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSavingExpenseEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }
      const updates = {
        ad_platform: adExpenseForm.ad_platform.trim(),
        ad_type: adExpenseForm.ad_type.trim() || 'Other',
        amount_kes: adExpenseForm.amount_kes,
        occurred_on: adExpenseForm.occurred_on,
        notes: adExpenseForm.notes || null,
      };
      const { data, error } = await supabase
        .from('ad_expenses')
        .update(updates)
        .eq('id', editingAdExpense.id)
        .eq('created_by', user.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error('Expense not found or not owned by you');
        return;
      }
      setAdExpenses(prev => prev.map(e => (e.id === editingAdExpense.id ? { ...e, ...data } : e)));
      toast.success('Ad expense updated');
      setEditingAdExpense(null);
    } catch (err: any) {
      console.error('Error updating ad expense:', err);
      toast.error(err.message || 'Failed to update ad expense');
    } finally {
      setSavingExpenseEdit(false);
    }
  };

  const deleteAdExpense = async (id: string) => {
    if (!confirm('Delete this ad expense? This cannot be undone.')) return;
    setDeletingExpenseId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }
      const { error } = await supabase
        .from('ad_expenses')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('created_by', user.id);
      if (error) throw error;
      setAdExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Ad expense deleted');
    } catch (err: any) {
      console.error('Error deleting ad expense:', err);
      toast.error(err.message || 'Failed to delete ad expense');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const openEditGeneralExpense = (expense: GeneralExpense) => {
    setEditingGeneralExpense(expense);
    setGeneralExpenseForm({
      expense_type: expense.expense_type ?? '',
      amount: Number(expense.amount ?? 0),
      date: (expense.date ?? '').slice(0, 10),
      notes: expense.notes ?? '',
    });
  };

  const saveGeneralExpenseEdit = async () => {
    if (!editingGeneralExpense) return;
    if (!generalExpenseForm.expense_type.trim()) {
      toast.error('Expense type is required');
      return;
    }
    if (!Number.isFinite(generalExpenseForm.amount) || generalExpenseForm.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSavingExpenseEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }
      const updates = {
        expense_type: generalExpenseForm.expense_type.trim(),
        amount: generalExpenseForm.amount,
        date: generalExpenseForm.date,
        notes: generalExpenseForm.notes || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('general_expenses')
        .update(updates)
        .eq('id', editingGeneralExpense.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error('Expense not found or not owned by you');
        return;
      }
      setGeneralExpenses(prev => prev.map(e => (e.id === editingGeneralExpense.id ? { ...e, ...data } : e)));
      setFilteredGeneralExpenses(prev => prev.map(e => (e.id === editingGeneralExpense.id ? { ...e, ...data } : e)));
      toast.success('General expense updated');
      setEditingGeneralExpense(null);
    } catch (err: any) {
      console.error('Error updating general expense:', err);
      toast.error(err.message || 'Failed to update general expense');
    } finally {
      setSavingExpenseEdit(false);
    }
  };

  const deleteGeneralExpense = async (id: string) => {
    if (!confirm('Delete this general expense? This cannot be undone.')) return;
    setDeletingExpenseId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }
      const { error } = await supabase
        .from('general_expenses')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setGeneralExpenses(prev => prev.filter(e => e.id !== id));
      setFilteredGeneralExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('General expense deleted');
    } catch (err: any) {
      console.error('Error deleting general expense:', err);
      toast.error(err.message || 'Failed to delete general expense');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const toggleSelectExpense = (key: string) => {
    setSelectedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmBulkDeleteExpenses = async () => {
    if (selectedExpenses.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const adIds: string[] = [];
      const generalIds: string[] = [];
      const vendorIds: string[] = [];

      selectedExpenses.forEach(key => {
        const [type, id] = key.split('::');
        if (type === 'Ad') adIds.push(id);
        else if (type === 'General') generalIds.push(id);
        else if (type === 'Vendor') vendorIds.push(id);
      });

      if (adIds.length > 0) {
        const { error } = await supabase
          .from('ad_expenses')
          .update({ is_deleted: true })
          .in('id', adIds)
          .eq('created_by', user.id);
        if (error) throw error;
        setAdExpenses(prev => prev.filter(e => !adIds.includes(e.id)));
      }

      if (generalIds.length > 0) {
        const { error } = await supabase
          .from('general_expenses')
          .update({ is_deleted: true })
          .in('id', generalIds)
          .eq('user_id', user.id);
        if (error) throw error;
        setGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
        setFilteredGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
      }

      if (vendorIds.length > 0) {
        for (const id of vendorIds) {
          await deleteVendorExpenseAPI(id);
        }
        setVendorExpenses(prev => {
          const next = { ...prev };
          for (const vendor of Object.keys(next)) {
            next[vendor] = next[vendor].filter(e => !vendorIds.includes(e.id));
          }
          return next;
        });
      }

      toast.success(`${selectedExpenses.size} expense${selectedExpenses.size > 1 ? 's' : ''} deleted`);
      setSelectedExpenses(new Set());
      setBulkDeleteConfirm(false);
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      toast.error('Failed to delete expenses');
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmBulkArchiveExpenses = async () => {
    if (selectedExpenses.size === 0) return;
    setBulkArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const adIds: string[] = [];
      const generalIds: string[] = [];

      selectedExpenses.forEach(key => {
        const [type, id] = key.split('::');
        if (type === 'Ad') adIds.push(id);
        else if (type === 'General') generalIds.push(id);
      });

      if (adIds.length > 0) {
        const { error } = await supabase
          .from('ad_expenses')
          .update({ is_archived: true })
          .in('id', adIds)
          .eq('created_by', user.id);
        if (error) throw error;
        setAdExpenses(prev => prev.filter(e => !adIds.includes(e.id)));
      }

      if (generalIds.length > 0) {
        const { error } = await supabase
          .from('general_expenses')
          .update({ is_archived: true })
          .in('id', generalIds)
          .eq('user_id', user.id);
        if (error) throw error;
        setGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
        setFilteredGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
      }

      const archivedCount = adIds.length + generalIds.length;
      const vendorCount = selectedExpenses.size - archivedCount;
      if (vendorCount > 0) {
        toast('Vendor expenses cannot be archived', { icon: '!' });
      }
      if (archivedCount > 0) {
        toast.success(`${archivedCount} expense${archivedCount > 1 ? 's' : ''} archived`);
      }
      setSelectedExpenses(new Set());
      setBulkArchiveConfirm(false);
    } catch (err: any) {
      console.error('Bulk archive error:', err);
      toast.error('Failed to archive expenses');
    } finally {
      setBulkArchiving(false);
    }
  };

  const confirmBulkUnarchiveExpenses = async () => {
    if (selectedExpenses.size === 0) return;
    setBulkUnarchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const adIds: string[] = [];
      const generalIds: string[] = [];

      selectedExpenses.forEach(key => {
        const [type, id] = key.split('::');
        if (type === 'Ad') adIds.push(id);
        else if (type === 'General') generalIds.push(id);
      });

      if (adIds.length > 0) {
        const { error } = await supabase
          .from('ad_expenses')
          .update({ is_archived: false })
          .in('id', adIds)
          .eq('created_by', user.id);
        if (error) throw error;
        setAdExpenses(prev => prev.filter(e => !adIds.includes(e.id)));
      }

      if (generalIds.length > 0) {
        const { error } = await supabase
          .from('general_expenses')
          .update({ is_archived: false })
          .in('id', generalIds)
          .eq('user_id', user.id);
        if (error) throw error;
        setGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
        setFilteredGeneralExpenses(prev => prev.filter(e => !generalIds.includes(e.id)));
      }

      const unarchivedCount = adIds.length + generalIds.length;
      if (unarchivedCount > 0) {
        toast.success(`${unarchivedCount} expense${unarchivedCount > 1 ? 's' : ''} unarchived`);
      }
      setSelectedExpenses(new Set());
    } catch (err: any) {
      console.error('Bulk unarchive error:', err);
      toast.error('Failed to unarchive expenses');
    } finally {
      setBulkUnarchiving(false);
    }
  };

  // Reference for infinite scroll
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const lastItemElementRef = React.useCallback((node: HTMLDivElement | null, vendorName: string) => {
    if (!node || !vendorExpensesHasMore[vendorName] || vendorExpensesLoading[vendorName]) return;
    
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && vendorExpensesHasMore[vendorName]) {
        loadMoreVendorExpenses(vendorName);
      }
    });
    
    observerRef.current.observe(node);
  }, [vendorExpensesHasMore, vendorExpensesLoading]);

  useEffect(() => {
    fetchExpenses();
    fetchVendorBalances();
  }, []);

  useEffect(() => {
    fetchExpenses();
    setSelectedExpenses(new Set());
  }, [showArchivedExpenses]);

  // Centralized vendor management functions
  const addNewVendor = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to add vendors');
      }

      const { error } = await supabase
        .from('user_sellers')
        .insert({ 
          id: crypto.randomUUID(),
          user_id: user.id, 
          name 
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This vendor already exists');
          return;
        }
        throw error;
      }

      setUserVendors(prev => [...prev, name].sort());
      toast.success('Vendor added successfully');
    } catch (error: any) {
      console.error('Error adding vendor:', error);
      toast.error(error.message || 'Failed to add vendor');
      throw error;
    }
  };

  const editVendor = async (oldName: string, newName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to edit vendors');
      }

      const { error: updateError } = await supabase
        .from('user_sellers')
        .update({ name: newName })
        .eq('user_id', user.id)
        .eq('name', oldName);

      if (updateError) {
        if (updateError.code === '23505') {
          toast.error('This vendor already exists');
          return;
        }
        throw updateError;
      }

      setUserVendors(prev =>
        prev.map(s => (s === oldName ? newName : s)).sort()
      );
      toast.success('Vendor updated successfully');
    } catch (error: any) {
      console.error('Error editing vendor:', error);
      toast.error(error.message || 'Failed to edit vendor');
      throw error;
    }
  };

  const deleteVendor = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to delete vendors');
      }

      const { error } = await supabase
        .from('user_sellers')
        .delete()
        .eq('user_id', user.id)
        .eq('name', name);

      if (error) {
        throw error;
      }

      setUserVendors(prev => prev.filter(s => s !== name));
      toast.success('Vendor deleted successfully');
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      toast.error(error.message || 'Failed to delete vendor');
      throw error;
    }
  };

  const fetchVendorBalances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view vendor balances');
        return;
      }

      // Fetch unpaid sales to calculate amounts owed to vendors
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .gt('amount_owed_to_vendor', 0);

      if (salesError) {
        console.error('Error fetching sales for vendor balances:', salesError);
        return;
      }

      // Fetch vendor expenses
      const { data: vendorExpensesData, error: vendorExpensesError } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id);

      if (vendorExpensesError) {
        console.error('Error fetching vendor expenses:', vendorExpensesError);
        // Continue with empty vendor expenses
      }

      // Calculate balances per vendor
      const balances: {[key: string]: {totalOwed: number; totalExpenses: number; balance: number}} = {};

      // Process sales data
      salesData?.forEach(sale => {
        const vendor = sale.seller;
        if (!balances[vendor]) {
          balances[vendor] = { totalOwed: 0, totalExpenses: 0, balance: 0 };
        }
        balances[vendor].totalOwed += Number(sale.amount_owed_to_vendor || 0);
      });

      // Process vendor expenses
      vendorExpensesData?.forEach(expense => {
        const vendor = expense.vendor_name;
        if (!balances[vendor]) {
          balances[vendor] = { totalOwed: 0, totalExpenses: 0, balance: 0 };
        }
        balances[vendor].totalExpenses += Number(expense.amount_kes || 0);
      });

      // Calculate final balances
      Object.keys(balances).forEach(vendor => {
        balances[vendor].balance = balances[vendor].totalOwed - balances[vendor].totalExpenses;
      });

      setVendorBalances(balances);

    } catch (error: any) {
      console.error('Error calculating vendor balances:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view expenses');
        return;
      }

      // Fetch ad expenses
      const { data: adData, error: adError } = await supabase
        .from('ad_expenses')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', showArchivedExpenses)
        .order('occurred_on', { ascending: false });

      if (adError) {
        console.error('Error fetching ad expenses:', adError);
      } else {
        setAdExpenses(adData || []);
      }

      // Fetch general expenses
      const { data: generalData, error: generalError } = await supabase
        .from('general_expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', showArchivedExpenses)
        .order('date', { ascending: false });

      if (generalError) {
        console.error('Error fetching general expenses:', generalError);
      } else {
        setGeneralExpenses(generalData || []);
        setFilteredGeneralExpenses(generalData || []);
      }

      // Fetch vendor expenses
      const { data: vendorExpensesData, error: vendorExpensesError } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id)
        .order('occurred_on', { ascending: false });

      if (vendorExpensesError) {
        console.error('Error fetching vendor expenses:', vendorExpensesError);
      } else {
        // Group vendor expenses by vendor
        const groupedExpenses: {[key: string]: SupplierExpense[]} = {};
        
        (vendorExpensesData || []).forEach(expense => {
          if (!expense.vendor_name) return;

          if (!groupedExpenses[expense.vendor_name]) {
            groupedExpenses[expense.vendor_name] = [];
          }

          groupedExpenses[expense.vendor_name].push({
            id: expense.id,
            vendor: expense.vendor_name,
            expense_type: expense.expense_type || 'Payment',
            amount: expense.amount_kes,
            date: expense.occurred_on,
            notes: expense.notes,
            is_cleared: expense.is_cleared || false,
            cleared_at: expense.cleared_at,
            cleared_by: expense.cleared_by,
            created_at: expense.created_at
          });
        });
        
        setVendorExpenses(groupedExpenses);
        
        // Initialize pagination state for each vendor
        const pageState: {[key: string]: number} = {};
        const hasMoreState: {[key: string]: boolean} = {};
        const loadingState: {[key: string]: boolean} = {};
        
        Object.keys(groupedExpenses).forEach(vendor => {
          pageState[vendor] = 1;
          hasMoreState[vendor] = groupedExpenses[vendor].length > 5; // 5 items per page
          loadingState[vendor] = false;
        });
        
        setVendorExpensesPage(pageState);
        setVendorExpensesHasMore(hasMoreState);
        setVendorExpensesLoading(loadingState);
      }

      // Fetch vendors for dropdown
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('user_sellers')
        .select('name')
        .eq('user_id', user.id)
        .order('name');

      if (vendorsError) {
        console.error('Error fetching vendors:', vendorsError);
      } else {
        setUserVendors(vendorsData?.map(v => v.name) || []);
      }

    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      toast.error(error.message || 'Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreVendorExpenses = async (vendorName: string) => {
    if (!vendorExpensesHasMore[vendorName] || vendorExpensesLoading[vendorName]) return;
    
    try {
      setVendorExpensesLoading(prev => ({
        ...prev,
        [vendorName]: true
      }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const nextPage = vendorExpensesPage[vendorName] + 1;
      const pageSize = 5;
      const from = nextPage * pageSize - pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('created_by', user.id)
        .eq('vendor_name', vendorName)
        .order('occurred_on', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      const newExpenses = data.map(expense => ({
        id: expense.id,
        vendor: expense.vendor_name,
        expense_type: expense.expense_type || 'Payment',
        amount: expense.amount_kes,
        date: expense.occurred_on,
        notes: expense.notes,
        is_cleared: expense.is_cleared || false,
        cleared_at: expense.cleared_at,
        cleared_by: expense.cleared_by,
        created_at: expense.created_at
      }));
      
      setVendorExpenses(prev => ({
        ...prev,
        [vendorName]: [...prev[vendorName], ...newExpenses]
      }));
      
      setVendorExpensesPage(prev => ({
        ...prev,
        [vendorName]: nextPage
      }));
      
      setVendorExpensesHasMore(prev => ({
        ...prev,
        [vendorName]: data.length === pageSize
      }));
      
    } catch (error) {
      console.error(`Error loading more expenses for ${vendorName}:`, error);
      toast.error(`Failed to load more expenses for ${vendorName}`);
    } finally {
      setVendorExpensesLoading(prev => ({
        ...prev,
        [vendorName]: false
      }));
    }
  };

  const handleVendorExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorExpenseForm.vendor || vendorExpenseForm.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to add expenses');
        return;
      }

      if (editingVendorExpense) {
        // Update existing expense
        await updateVendorExpenseAPI(editingVendorExpense.id, {
          expenseType: vendorExpenseForm.expense_type,
          amountKES: vendorExpenseForm.amount,
          dateString: vendorExpenseForm.date,
          notes: vendorExpenseForm.notes || undefined,
        });

        // Update local state
        setVendorExpenses(prev => {
          const vendorName = vendorExpenseForm.vendor;
          return {
            ...prev,
            [vendorName]: prev[vendorName]
              ? prev[vendorName].map(expense =>
                  expense.id === editingVendorExpense.id
                    ? {
                        ...expense,
                        expense_type: vendorExpenseForm.expense_type,
                        amount: vendorExpenseForm.amount,
                        date: vendorExpenseForm.date,
                        notes: vendorExpenseForm.notes || null,
                      }
                    : expense
                )
              : []
          };
        });
        toast.success('Vendor expense updated successfully');
      } else {
        // Insert new expense
        const expenseData = {
          vendor_name: vendorExpenseForm.vendor,
          expense_type: vendorExpenseForm.expense_type,
          amount_kes: vendorExpenseForm.amount,
          occurred_on: vendorExpenseForm.date,
          notes: vendorExpenseForm.notes || null,
        };

        const { data: insertedData, error } = await supabase
          .from('vendor_expenses')
          .insert(expenseData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Update local state with inserted data
        if (insertedData) {
          setVendorExpenses(prev => {
            const vendorName = vendorExpenseForm.vendor;
            const newExpense: SupplierExpense = {
              id: insertedData.id,
              vendor: vendorName,
              expense_type: insertedData.expense_type,
              amount: insertedData.amount_kes,
              date: insertedData.occurred_on,
              notes: insertedData.notes,
              created_at: insertedData.created_at
            };
            return {
              ...prev,
              [vendorName]: prev[vendorName]
                ? [newExpense, ...prev[vendorName]]
                : [newExpense]
            };
          });
        }
        toast.success('Vendor expense added successfully');
      }

      // Refresh vendor balances
      fetchVendorBalances();

      // Reset form
      setVendorExpenseForm({
        vendor: '',
        expense_type: 'Payment',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setShowAddVendorExpense(false);
      setEditingVendorExpense(null);

    } catch (error: any) {
      console.error('Error saving vendor expense:', error);
      toast.error(error.message || 'Failed to save vendor expense');
    }
  };

  const editVendorExpense = (expense: SupplierExpense) => {
    setVendorExpenseForm({
      vendor: expense.vendor,
      expense_type: expense.expense_type || 'Payment',
      amount: expense.amount,
      date: expense.date,
      notes: expense.notes || ''
    });
    setEditingVendorExpense(expense);
    setShowAddVendorExpense(true);
  };

  const deleteVendorExpense = async (id: string, vendorName: string) => {
    if (!confirm('Are you sure you want to delete this vendor expense? This cannot be undone.')) return;

    try {
      await deleteVendorExpenseAPI(id);

      // Update local state
      setVendorExpenses(prev => {
        if (!prev[vendorName]) return prev;

        return {
          ...prev,
          [vendorName]: prev[vendorName].filter(expense => expense.id !== id)
        };
      });

      // Refresh vendor balances
      fetchVendorBalances();

      toast.success('Vendor expense deleted successfully');
    } catch (error: any) {
      console.error('Error deleting vendor expense:', error);
      toast.error(error.message || 'Failed to delete vendor expense');
    }
  };

  const cancelVendorExpenseForm = () => {
    setVendorExpenseForm({
      vendor: '',
      expense_type: 'Payment',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowAddVendorExpense(false);
    setEditingVendorExpense(null);
  };

  const handleToggleCleared = async (expense: SupplierExpense, vendorName: string) => {
    const newClearedState = !expense.is_cleared;

    try {
      // Optimistically update UI
      setVendorExpenses(prev => ({
        ...prev,
        [vendorName]: prev[vendorName].map(exp =>
          exp.id === expense.id
            ? { ...exp, is_cleared: newClearedState }
            : exp
        )
      }));

      await setExpenseCleared(expense.id, newClearedState);

      // Refresh to get server data
      await fetchVendorBalances();

      toast.success(newClearedState ? 'Expense marked as paid' : 'Expense marked as unpaid');
    } catch (error: any) {
      console.error('Error toggling expense cleared state:', error);
      toast.error(error.message || 'Failed to update expense');

      // Revert optimistic update
      setVendorExpenses(prev => ({
        ...prev,
        [vendorName]: prev[vendorName].map(exp =>
          exp.id === expense.id
            ? { ...exp, is_cleared: expense.is_cleared }
            : exp
        )
      }));
    }
  };

  const handleMarkAllPaid = async (vendorName: string) => {
    if (!confirm(`Mark all outstanding expenses for ${vendorName} as paid?`)) return;

    try {
      const count = await markAllPaidForVendor(vendorName);

      // Refresh data
      await fetchExpenses();
      await fetchVendorBalances();

      toast.success(count > 0 ? `Marked ${count} expenses as paid` : 'All expenses marked as paid');
    } catch (error: any) {
      console.error('Error marking all expenses as paid:', error);
      toast.error(error.message || 'Failed to mark all expenses as paid');
    }
  };

  const filterGeneralExpenses = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredGeneralExpenses(generalExpenses);
      return;
    }
    
    const lowercaseSearch = searchTerm.toLowerCase();
    const filtered = generalExpenses.filter(expense =>
      (expense.expense_type ?? '').toLowerCase().includes(lowercaseSearch) ||
      (expense.notes && expense.notes.toLowerCase().includes(lowercaseSearch))
    );
    setFilteredGeneralExpenses(filtered);
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

  // Filter expenses by selected month
  const filteredAdExpenses = adExpenses.filter(expense =>
    expense.occurred_on.startsWith(selectedMonth)
  );

  // Calculate totals
  const totalAdExpenses = filteredAdExpenses.reduce((sum, expense) => sum + expense.amount_kes, 0);
  const totalGeneralExpenses = filteredGeneralExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = totalAdExpenses + totalGeneralExpenses;
  
  // Calculate total vendor expenses for the selected month
  const calculateTotalVendorExpenses = () => {
    let total = 0;
    Object.values(vendorExpenses).forEach(expenses => {
      expenses.forEach(expense => {
        if (expense.date.startsWith(selectedMonth)) {
          total += expense.amount;
        }
      });
    });
    return total;
  };
  
  const totalVendorExpenses = calculateTotalVendorExpenses();

  // Calculate breakdown by type
  const adTypeBreakdown = filteredAdExpenses.reduce((acc, expense) => {
    acc[expense.ad_type] = (acc[expense.ad_type] || 0) + expense.amount_kes;
    return acc;
  }, {} as Record<string, number>);

  const generalTypeBreakdown = filteredGeneralExpenses.reduce((acc, expense) => {
    acc[expense.expense_type] = (acc[expense.expense_type] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ color: '#374151' }}>
            <DollarSign className="w-5 h-5 text-red-600" />
            Expense Overview
          </h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-red-100">
              <DollarSign className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-3xl font-extrabold text-red-600">{formatCurrency(totalExpenses)}</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-orange-100">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Ad Expenses</p>
              <p className="text-3xl font-extrabold text-orange-600">{formatCurrency(totalAdExpenses)}</p>
              <p className="text-xs text-gray-500">{filteredAdExpenses.length} transactions</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-purple-100">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">General Expenses</p>
              <p className="text-3xl font-extrabold text-purple-600">{formatCurrency(totalGeneralExpenses)}</p>
              <p className="text-xs text-gray-500">{filteredGeneralExpenses.length} transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ad Expenses Breakdown */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
            <PieChart className="w-5 h-5 text-orange-600" />
            Ad Expenses by Type
          </h3>
          {Object.keys(adTypeBreakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(adTypeBreakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-500 h-2 rounded-full" 
                          style={{ width: `${(amount / totalAdExpenses) * 100}%` }}
                        ></div>
                      </div>
                      <span className="font-extrabold text-orange-600 min-w-[80px] text-right">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No ad expenses this month</p>
          )}
        </div>

        {/* General Expenses Breakdown */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
            <BarChart3 className="w-5 h-5 text-purple-600" />
            General Expenses by Type
          </h3>
          {Object.keys(generalTypeBreakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(generalTypeBreakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${(amount / totalGeneralExpenses) * 100}%` }}
                        ></div>
                      </div>
                      <span className="font-extrabold text-purple-600 min-w-[80px] text-right">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No general expenses this month</p>
          )}
        </div>
      </div>

      {/* Supplier Expenses Panel */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div 
          className="flex items-center justify-between p-6 cursor-pointer"
          onClick={() => setIsSupplierExpensesExpanded(!isSupplierExpensesExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>
                Vendor Expenses
              </h3>
              <p className="text-sm text-gray-600">
                {formatCurrency(totalVendorExpenses)} this month • {Object.values(vendorExpenses).flat().filter(expense => expense.date.startsWith(selectedMonth)).length} expenses
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSupplierExpensesExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>

        {isSupplierExpensesExpanded && (
          <div className="px-6 pb-6 border-t border-gray-200">
            <div className="pt-4">
              {/* Add New Button */}
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-bold text-gray-800" style={{ color: '#374151' }}>
                  Vendor Expense Entries
                </h4>
                <button
                  onClick={() => setShowAddVendorExpense(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  Add New
                </button>
              </div>

              {/* Add/Edit Form */}
              {showAddVendorExpense && (
                <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <h5 className="text-md font-bold text-gray-800 mb-4" style={{ color: '#374151' }}>
                    {editingVendorExpense ? 'Edit Vendor Expense' : 'Add New Vendor Expense'}
                  </h5>
                  <form onSubmit={handleVendorExpenseSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EnhancedDropdown
                      label="Vendor"
                      value={vendorExpenseForm.vendor}
                      onChange={(value) => setVendorExpenseForm(prev => ({ ...prev, vendor: value }))}
                      type="supplier"
                      placeholder="Select vendor"
                      required
                      icon={<Users className="w-4 h-4 inline mr-1" />}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type *</label>
                      <select
                        value={vendorExpenseForm.expense_type}
                        onChange={(e) => setVendorExpenseForm(prev => ({ ...prev, expense_type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="Payment">Payment</option>
                        <option value="Reimbursement">Reimbursement</option>
                        <option value="Advance">Advance</option>
                        <option value="Commission">Commission</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={vendorExpenseForm.amount}
                        onChange={(e) => setVendorExpenseForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={vendorExpenseForm.date}
                        onChange={(e) => setVendorExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <input
                        type="text"
                        value={vendorExpenseForm.notes}
                        onChange={(e) => setVendorExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Optional notes"
                      />
                    </div>

                    <div className="md:col-span-2 flex gap-2">
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <Save className="w-4 h-4" />
                        {editingVendorExpense ? 'Update' : 'Add'} Vendor Expense
                      </button>
                      <button
                        type="button"
                        onClick={cancelVendorExpenseForm}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {/* Vendor Balances */}
              <div className="mb-6">
                <h4 className="text-md font-bold text-gray-800 mb-4" style={{ color: '#374151' }}>
                  Vendor Balances
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(vendorBalances).map(([vendor, data]) => (
                    <div key={vendor} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium text-gray-800">{vendor}</h5>
                        {data.balance > 0 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                            Amount Owed to Vendor
                          </span>
                        ) : data.balance < 0 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Vendor Owes Me
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                            Balanced
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Owed:</span>
                          <span className="font-medium">{formatCurrency(data.totalOwed || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Expenses:</span>
                          <span className="font-medium">{formatCurrency(data.totalExpenses || 0)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="text-gray-700 font-medium">Balance:</span>
                          {(data.balance || 0) > 0 ? (
                            <span className="font-bold text-red-600">{formatCurrency(data.balance || 0)}</span>
                          ) : (data.balance || 0) < 0 ? (
                            <span className="font-bold text-green-600">{formatCurrency(Math.abs(data.balance || 0))}</span>
                          ) : (
                            <span className="font-bold text-gray-600">{formatCurrency(0)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {Object.keys(vendorBalances).length === 0 && (
                    <div className="col-span-full text-center py-4 text-gray-500">
                      No vendor balances found
                    </div>
                  )}
                </div>
              </div>
              
              {/* Vendor Expense Cards */}
              <div className="space-y-6 mt-6">
                {Object.keys(vendorBalances).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No vendor data found
                  </div>
                ) : (
                  Object.keys(vendorBalances).map(vendorName => {
                    const vendorData = vendorBalances[vendorName];
                    const vendorExpensesList = vendorExpenses[vendorName] || [];
                    const filteredExpenses = vendorExpensesList.filter(expense => 
                      expense.date.startsWith(selectedMonth)
                    );
                    
                    return (
                      <div 
                        key={vendorName}
                        className={`bg-white rounded-lg shadow-sm border overflow-hidden ${
                          vendorData.balance > 0 
                            ? 'border-l-4 border-l-red-500' 
                            : vendorData.balance < 0
                              ? 'border-l-4 border-l-green-500'
                              : ''
                        }`}
                      >
                        {/* Vendor Header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-full bg-blue-100">
                                <Users className="w-4 h-4 text-blue-600" />
                              </div>
                              <h4 className="font-bold text-gray-800">{vendorName}</h4>
                            </div>
                            <div className="text-sm">
                              {vendorData.balance > 0 ? (
                                <span className="text-red-600 font-medium">Owed: {formatCurrency(vendorData.balance)}</span>
                              ) : vendorData.balance < 0 ? (
                                <span className="text-green-600 font-medium">Credit: {formatCurrency(Math.abs(vendorData.balance))}</span>
                              ) : (
                                <span className="text-gray-600">Balanced</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-500">Total Owed:</span>
                              <span className="float-right font-medium">{formatCurrency(vendorData.totalOwed)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Expenses Paid:</span>
                              <span className="float-right font-medium text-green-600">{formatCurrency(vendorData.totalExpenses)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Balance:</span>
                              <span className={`float-right font-medium ${
                                vendorData.balance > 0 ? 'text-red-600' : 
                                vendorData.balance < 0 ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {formatCurrency(Math.abs(vendorData.balance))}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Vendor Expense Cards */}
                        <div className="p-4">
                          {/* Controls */}
                          <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={showClearedExpenses}
                                onChange={(e) => setShowClearedExpenses(e.target.checked)}
                                className="rounded"
                              />
                              Show cleared expenses
                            </label>
                            {vendorExpensesList.some(e => !e.is_cleared) && (
                              <button
                                onClick={() => handleMarkAllPaid(vendorName)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Mark all paid
                              </button>
                            )}
                          </div>

                          {filteredExpenses.filter(e => showClearedExpenses || !e.is_cleared).length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                              {showClearedExpenses ? 'No expenses found for this month' : 'No outstanding expenses for this month'}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredExpenses.filter(e => showClearedExpenses || !e.is_cleared).map((expense, index) => (
                                <div
                                  key={expense.id}
                                  className={`p-3 border rounded-lg hover:shadow-sm transition-all ${
                                    expense.is_cleared
                                      ? 'border-green-300 bg-green-50/50 opacity-75'
                                      : 'border-gray-200'
                                  }`}
                                  ref={index === filteredExpenses.length - 1 ? (node) => lastItemElementRef(node, vendorName) : undefined}
                                >
                                  {/* Paid checkbox */}
                                  <div className="flex items-center gap-3 mb-2 pb-2 border-b">
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={expense.is_cleared || false}
                                        onChange={() => handleToggleCleared(expense, vendorName)}
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

                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-gray-500" />
                                        <span className="text-sm font-medium">{formatDate(expense.date)}</span>
                                      </div>
                                      <div className="text-sm text-gray-700 mt-1">
                                        {expense.expense_type || 'Payment'}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold text-blue-600">{formatCurrency(expense.amount)}</div>
                                    </div>
                                  </div>
                                  
                                  {expense.notes && (
                                    <div className="text-sm text-gray-600 mt-2 border-t pt-2">
                                      {expense.notes}
                                    </div>
                                  )}
                                  
                                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => editVendorExpense(expense)}
                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                        title="Edit expense"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => deleteVendorExpense(expense.id, vendorName)}
                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                        title="Delete expense"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">Reimbursed</span>
                                      <div className="relative inline-block w-10 align-middle select-none">
                                        <input 
                                          type="checkbox" 
                                          id={`toggle-${expense.id}`}
                                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                          checked={expense.expense_type === 'Reimbursement'}
                                          onChange={() => {
                                            // Toggle between Payment and Reimbursement
                                            const newType = expense.expense_type === 'Reimbursement' ? 'Payment' : 'Reimbursement';
                                            
                                            // Update in database
                                            supabase
                                              .from('vendor_expenses')
                                              .update({ expense_type: newType })
                                              .eq('id', expense.id)
                                              .then(({ error }) => {
                                                if (error) {
                                                  toast.error('Failed to update expense type');
                                                  return;
                                                }
                                                
                                                // Update in local state
                                                setVendorExpenses(prev => {
                                                  return {
                                                    ...prev,
                                                    [vendorName]: prev[vendorName].map(exp => 
                                                      exp.id === expense.id 
                                                        ? { ...exp, expense_type: newType }
                                                        : exp
                                                    )
                                                  };
                                                });
                                                
                                                // Refresh balances
                                                fetchVendorBalances();
                                                
                                                toast.success(`Expense marked as ${newType}`);
                                              });
                                          }}
                                        />
                                        <label 
                                          htmlFor={`toggle-${expense.id}`}
                                          className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                                            expense.expense_type === 'Reimbursement' ? 'bg-green-400' : 'bg-gray-300'
                                          }`}
                                        ></label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Loading indicator or Load More button */}
                              {vendorExpensesHasMore[vendorName] && (
                                <div className="text-center pt-2">
                                  {vendorExpensesLoading[vendorName] ? (
                                    <div className="flex justify-center">
                                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => loadMoreVendorExpenses(vendorName)}
                                      className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
                                    >
                                      Load more...
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>
              {showArchivedExpenses ? 'Archived Expenses' : 'Recent Expenses'}
            </h3>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setShowArchivedExpenses(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  !showArchivedExpenses ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setShowArchivedExpenses(true)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  showArchivedExpenses ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Archive className="w-3 h-3" />
                Archived
              </button>
            </div>
          </div>
          {selectedExpenses.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedExpenses.size} selected</span>
              <button
                onClick={() => setSelectedExpenses(new Set())}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Deselect
              </button>
              {showArchivedExpenses ? (
                <button
                  onClick={confirmBulkUnarchiveExpenses}
                  disabled={bulkUnarchiving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {bulkUnarchiving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Unarchive ({selectedExpenses.size})
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setBulkArchiveConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive ({selectedExpenses.size})
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete ({selectedExpenses.size})
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const allExpenses = [
                        ...filteredAdExpenses.map(e => `Ad::${e.id}`),
                        ...filteredGeneralExpenses.map(e => `General::${e.id}`),
                        ...Object.values(vendorExpenses).flat().filter(e => e.date.startsWith(selectedMonth)).map(e => `Vendor::${e.id}`)
                      ].slice(0, 10);
                      return allExpenses.length > 0 && allExpenses.every(k => selectedExpenses.has(k));
                    })()}
                    onChange={() => {
                      const allExpenses = [
                        ...filteredAdExpenses.map(e => ({ key: `Ad::${e.id}`, date: e.occurred_on })),
                        ...filteredGeneralExpenses.map(e => ({ key: `General::${e.id}`, date: e.date })),
                        ...Object.values(vendorExpenses).flat().filter(e => e.date.startsWith(selectedMonth)).map(e => ({ key: `Vendor::${e.id}`, date: e.date }))
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
                      const allKeys = allExpenses.map(e => e.key);
                      const allSelected = allKeys.every(k => selectedExpenses.has(k));
                      if (allSelected) {
                        setSelectedExpenses(new Set());
                      } else {
                        setSelectedExpenses(new Set(allKeys));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                ...filteredAdExpenses.map(expense => ({
                  ...expense,
                  type: 'Ad',
                  category: expense.ad_type,
                  date: expense.occurred_on,
                  amount: expense.amount_kes
                })),
                ...filteredGeneralExpenses.map(expense => ({
                  ...expense,
                  type: 'General',
                  category: expense.expense_type
                })),
                ...Object.values(vendorExpenses).flat().filter(expense => expense.date.startsWith(selectedMonth))
                  .map(expense => ({
                    ...expense,
                    type: 'Vendor',
                    category: expense.expense_type
                  }))
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map((expense, index) => (
                  <tr key={`${expense.type}-${expense.id}`} className="hover:bg-gray-50 even:bg-gray-25">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(`${expense.type}::${expense.id}`)}
                        onChange={() => toggleSelectExpense(`${expense.type}::${expense.id}`)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        expense.type === 'Ad'
                          ? 'bg-orange-100 text-orange-800'
                          : expense.type === 'General'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {expense.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.category}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-extrabold text-gray-900 text-right">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {expense.notes || '-'}
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      {expense.type === 'Ad' ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditAdExpense(adExpenses.find(a => a.id === expense.id)!)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Edit ad expense"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAdExpense(expense.id)}
                            disabled={deletingExpenseId === expense.id}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete ad expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : expense.type === 'General' ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditGeneralExpense(generalExpenses.find(g => g.id === expense.id)!)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Edit general expense"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteGeneralExpense(expense.id)}
                            disabled={deletingExpenseId === expense.id}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete general expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              {filteredAdExpenses.length === 0 && filteredGeneralExpenses.length === 0 && Object.values(vendorExpenses).flat().filter(expense => expense.date.startsWith(selectedMonth)).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-600">
                    No expenses found for this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Ad Expense Modal */}
      {editingAdExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100">
                  <Edit className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Edit Ad Expense</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ad Platform</label>
                  <input
                    type="text"
                    value={adExpenseForm.ad_platform}
                    onChange={(e) => setAdExpenseForm({ ...adExpenseForm, ad_platform: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ad Type</label>
                  <input
                    type="text"
                    value={adExpenseForm.ad_type}
                    onChange={(e) => setAdExpenseForm({ ...adExpenseForm, ad_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={adExpenseForm.amount_kes}
                    onChange={(e) => setAdExpenseForm({ ...adExpenseForm, amount_kes: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={adExpenseForm.occurred_on}
                    onChange={(e) => setAdExpenseForm({ ...adExpenseForm, occurred_on: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input
                    type="text"
                    value={adExpenseForm.notes}
                    onChange={(e) => setAdExpenseForm({ ...adExpenseForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingAdExpense(null)}
                  disabled={savingExpenseEdit}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAdExpenseEdit}
                  disabled={savingExpenseEdit}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {savingExpenseEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit General Expense Modal */}
      {editingGeneralExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Edit General Expense</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expense Type</label>
                  <input
                    type="text"
                    value={generalExpenseForm.expense_type}
                    onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, expense_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={generalExpenseForm.amount}
                    onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={generalExpenseForm.date}
                    onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input
                    type="text"
                    value={generalExpenseForm.notes}
                    onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingGeneralExpense(null)}
                  disabled={savingExpenseEdit}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveGeneralExpenseEdit}
                  disabled={savingExpenseEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {savingExpenseEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete {selectedExpenses.size} Expense{selectedExpenses.size > 1 ? 's' : ''}?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              All selected expenses will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDeleteExpenses}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {bulkDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {bulkDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Archive Confirmation Modal */}
      {bulkArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-amber-100">
                <Archive className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Archive {selectedExpenses.size} Expense{selectedExpenses.size > 1 ? 's' : ''}?</h3>
                <p className="text-sm text-gray-500">Archived expenses won't appear in calculations.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Selected expenses will be archived and excluded from all financial summaries and reports.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkArchiveConfirm(false)}
                disabled={bulkArchiving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkArchiveExpenses}
                disabled={bulkArchiving}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
              >
                {bulkArchiving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                {bulkArchiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseOverview;