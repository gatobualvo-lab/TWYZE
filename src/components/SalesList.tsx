import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, User, Truck, Package, Trash2, MapPin, ChevronRight, CreditCard as Edit, Check, DollarSign, Info, CreditCard, TrendingUp, AlertCircle, BarChart3, Undo, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from './LoadingScreen';

interface EditItem {
  id: string;
  product_name: string;
  vendor_name: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  vendor_payment_status: 'Paid' | 'Unpaid';
}

interface Sale {
  id: string;
  product_name: string;
  seller: string;
  buying_price: number;
  selling_price: number;
  delivery_guy: string;
  delivery_fee: number;
  delivery_fee_paid: boolean;
  location: string;
  payment_status: 'Paid' | 'Unpaid';
  date: string;
  profit: number;
  tax_type: 'none' | 'vat' | 'turnover' | null;
  vat_amount: number | null;
  turnover_tax_amount: number | null;
  created_at: string;
  amount_owed_to_vendor?: number;
}

const SalesList: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsPerPage = 20;
  const [filters, setFilters] = useState({
    search: '',
    dateRange: { start: '', end: '' },
    paymentStatus: 'all',
    sortBy: 'date',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState<Partial<Sale>>({});
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [loadingEditItems, setLoadingEditItems] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletedSale, setDeletedSale] = useState<{sale: Sale, saleItems: any[], relatedData: any} | null>(null);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [bulkUnarchiving, setBulkUnarchiving] = useState(false);

  const [overviewStats, setOverviewStats] = useState({
    todaySalesCount: 0,
    todaySalesRevenue: 0,
    weekSalesCount: 0,
    weekSalesRevenue: 0,
    monthSalesCount: 0,
    monthSalesRevenue: 0,
    unpaidSalesAmount: 0,
    averageSaleValue: 0,
    amountOwedToVendors: 0
  });

  // Reference for infinite scroll
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const lastSaleElementRef = React.useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreSales();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore]);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    fetchSales();
    setSelectedSaleIds(new Set());
  }, [showArchived]);

  useEffect(() => {
    filterAndSortSales();
    calculateOverviewStats();
  }, [sales, filters]);

  const calculateOverviewStats = () => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Get this week's start date
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    // Get current month in YYYY-MM format
    const currentMonth = today.substring(0, 7);
    
    // Filter sales for today
    const todaySales = filteredSales.filter(sale => sale.date === today);
    const todaySalesCount = todaySales.length;
    const todaySalesRevenue = todaySales.reduce((sum, sale) => sum + sale.selling_price, 0);

    // Filter sales for this week
    const weekSales = filteredSales.filter(sale => sale.date >= weekStartStr && sale.date <= today);
    const weekSalesCount = weekSales.length;
    const weekSalesRevenue = weekSales.reduce((sum, sale) => sum + sale.selling_price, 0);
    
    // Filter sales for current month
    const monthSales = filteredSales.filter(sale => sale.date.startsWith(currentMonth));
    const monthSalesCount = monthSales.length;
    const monthSalesRevenue = monthSales.reduce((sum, sale) => sum + sale.selling_price, 0);
    const monthNetProfit = monthSales.reduce((sum, sale) => sum + sale.profit, 0);
    
    // Calculate unpaid sales amount
    const unpaidSales = filteredSales.filter(sale => sale.payment_status === 'Unpaid');
    const unpaidSalesAmount = unpaidSales.reduce((sum, sale) => sum + sale.selling_price, 0);
    
    // Calculate amount owed to vendors
    const amountOwedToVendors = filteredSales.reduce((sum, sale) => sum + (sale.amount_owed_to_vendor || 0), 0);
    
    // Calculate average sale value
    const averageSaleValue = filteredSales.length > 0 
      ? filteredSales.reduce((sum, sale) => sum + sale.selling_price, 0) / filteredSales.length 
      : 0;
    
    setOverviewStats({
      todaySalesCount,
      todaySalesRevenue,
      weekSalesCount,
      weekSalesRevenue,
      monthSalesCount,
      monthSalesRevenue,
      unpaidSalesAmount,
      averageSaleValue,
      amountOwedToVendors
    });
  };

  const fetchSales = async (resetPage = true) => {
    try {
      if (resetPage) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view sales');
        return;
      }

      const currentPage = resetPage ? 1 : page;
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', showArchived)
        .order('date', { ascending: false });
        //.range(from, to);  // Uncomment this for server-side pagination

      if (error) {
        throw error;
      }

      if (resetPage) {
        setSales(data || []);
      } else {
        setSales(prev => [...prev, ...(data || [])]);
      }
      
      // For client-side pagination
      const allData = data || [];
      const paginatedData = allData.slice(0, currentPage * itemsPerPage);
      setFilteredSales(paginatedData);
      
      // Check if there are more items to load
      setHasMore(allData.length > currentPage * itemsPerPage);
      
      if (!resetPage) {
        setPage(currentPage + 1);
      }
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      toast.error(error.message || 'Failed to load sales data');
    } finally {
      if (resetPage) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreSales = () => {
    fetchSales(false);
  };

  const filterAndSortSales = () => {
    let filtered = [...sales];

    // Apply search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(sale =>
        (sale.product_name ?? '').toLowerCase().includes(q) ||
        (sale.seller ?? '').toLowerCase().includes(q) ||
        (sale.location ?? '').toLowerCase().includes(q)
      );
    }

    // Apply date range filter
    if (filters.dateRange.start) {
      filtered = filtered.filter(sale => sale.date >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter(sale => sale.date <= filters.dateRange.end);
    }

    // Apply payment status filter
    if (filters.paymentStatus !== 'all') {
      filtered = filtered.filter(sale => sale.payment_status === filters.paymentStatus);
    }

    // Apply sorting
    const sortedSales = filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'product':
          comparison = (a.product_name ?? '').localeCompare(b.product_name ?? '');
          break;
        case 'seller':
          comparison = (a.seller ?? '').localeCompare(b.seller ?? '');
          break;
        case 'amount':
          comparison = a.selling_price - b.selling_price;
          break;
        case 'profit':
          comparison = a.profit - b.profit;
          break;
        default:
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply client-side pagination
    setFilteredSales(sortedSales.slice(0, page * itemsPerPage));
    setHasMore(sortedSales.length > page * itemsPerPage);
  };

  const toggleVendorPaymentStatus = async (saleId: string) => {
    try {
      setUpdatingSaleId(saleId);
      // Get the current sale
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;
      
      // Toggle the amount_owed_to_vendor value
      const newAmountOwed = sale.amount_owed_to_vendor > 0 ? 0 : sale.buying_price;
      
      // Update the sale in the database
      const { error } = await supabase
        .from('sales')
        .update({ amount_owed_to_vendor: newAmountOwed })
        .eq('id', saleId);

      if (error) throw error;

      // Update local state
      setSales(prev => prev.map(s => 
        s.id === saleId ? { ...s, amount_owed_to_vendor: newAmountOwed } : s
      ));
      
      // If vendor is now paid and delivery is also paid, update payment status to Paid
      const updatedSale = sales.find(s => s.id === saleId);
      if (updatedSale && newAmountOwed === 0 && updatedSale.delivery_fee_paid) {
        await updateSalePaymentStatus(saleId, 'Paid', true);
      } else if (updatedSale && newAmountOwed > 0 && updatedSale.payment_status === 'Paid') {
        await updateSalePaymentStatus(saleId, 'Unpaid', true);
      }
      
      // Log the action in the audit log
      await supabase
        .from('audit_log')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: newAmountOwed > 0 ? 'vendor_marked_unpaid' : 'vendor_marked_paid',
          resource_type: 'sale',
          resource_id: saleId,
          details: `Vendor payment status changed to ${newAmountOwed > 0 ? 'unpaid' : 'paid'}`
        });

      toast.success(newAmountOwed > 0 ? 'Vendor marked as unpaid' : 'Vendor marked as paid');
    } catch (error: any) {
      console.error('Error toggling vendor payment status:', error);
      toast.error('Failed to update vendor payment status');
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const toggleDeliveryPaymentStatus = async (saleId: string, currentValue: boolean) => {
    try {
      setUpdatingSaleId(saleId);
      const newValue = !currentValue;

      // Get the current sale
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      // Update delivery_fee_paid in the database
      const { error } = await supabase
        .from('sales')
        .update({ delivery_fee_paid: newValue })
        .eq('id', saleId);

      if (error) throw error;

      // Update local state
      setSales(prev => prev.map(s => 
        s.id === saleId ? { ...s, delivery_fee_paid: newValue } : s
      ));
      
      // If delivery is now paid and vendor is also paid, update payment status to Paid
      if (newValue && sale.amount_owed_to_vendor === 0) {
        await updateSalePaymentStatus(saleId, 'Paid', true);
      } else if (!newValue && sale.payment_status === 'Paid') {
        await updateSalePaymentStatus(saleId, 'Unpaid', true);
      }
      
      // Log the action in the audit log
      await supabase
        .from('audit_log')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: newValue ? 'delivery_marked_paid' : 'delivery_marked_unpaid',
          resource_type: 'sale',
          resource_id: saleId,
          details: `Delivery payment status changed to ${newValue ? 'paid' : 'unpaid'}`
        });

      toast.success(`Delivery ${newValue ? 'marked as paid' : 'marked as unpaid'}`);
    } catch (error: any) {
      console.error('Error toggling delivery payment status:', error);
      toast.error('Failed to update delivery payment status');
    } finally {
      setUpdatingSaleId(null);
    }
  };

  // Function to update sale payment status
  const updateSalePaymentStatus = async (saleId: string, status: 'Paid' | 'Unpaid', autoCollapse = false) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ payment_status: status })
        .eq('id', saleId);

      if (error) throw error;

      // Update local state
      setSales(prev => prev.map(sale => 
        sale.id === saleId ? { ...sale, payment_status: status } : sale
      ));

      // Auto-collapse if both vendor and delivery are paid
      if (autoCollapse && status === 'Paid' && expandedSaleId === saleId) {
        setExpandedSaleId(null);
      }
      
      // Log the action in the audit log
      await supabase
        .from('audit_log')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'payment_status_changed',
          resource_type: 'sale',
          resource_id: saleId,
          details: `Payment status changed to ${status}`
        });

    } catch (error: any) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  };

  const deleteSale = async (saleId: string) => {
    setShowDeleteConfirm(saleId);
  };

  const confirmDeleteSale = async (saleId: string) => {
    setShowDeleteConfirm(null);
    setDeletingSaleId(saleId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to delete sales');
        return;
      }

      // Get the sale and related data before deletion for undo functionality
      const saleToDelete = sales.find(sale => sale.id === saleId);
      if (!saleToDelete) {
        toast.error('Sale not found');
        return;
      }

      // Get related sale items
      const { data: saleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (saleItemsError) {
        console.error('Error fetching sale items:', saleItemsError);
      }

      // Get related vendor expenses (if any)
      const { data: vendorExpenses, error: vendorExpensesError } = await supabase
        .from('vendor_expenses')
        .select('*')
        .eq('user_id', user.id)
        .in('vendor', saleItems?.map(item => item.vendor) || []);

      if (vendorExpensesError) {
        console.error('Error fetching vendor expenses:', vendorExpensesError);
      }

      // Store data for undo functionality
      const deletedData = {
        sale: saleToDelete,
        saleItems: saleItems || [],
        relatedData: {
          vendorExpenses: vendorExpenses || []
        }
      };

      // Perform cascade deletion
      // 1. Delete sale items first
      if (saleItems && saleItems.length > 0) {
        const { error: deleteItemsError } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', saleId);

        if (deleteItemsError) {
          throw deleteItemsError;
        }
      }

      // 2. Delete the main sale record
      const { error: deleteSaleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (deleteSaleError) {
        throw deleteSaleError;
      }

      // 3. Log the deletion in audit log
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          action: 'delete_sale',
          resource_type: 'sale',
          resource_id: saleId,
          details: `Sale deleted: ${saleToDelete.product_name} - ${formatCurrency(saleToDelete.selling_price)}`
        });

      // Update local state immediately
      setSales(prev => prev.filter(sale => sale.id !== saleId));
      
      // Set up undo functionality
      setDeletedSale(deletedData);
      setShowUndoSnackbar(true);
      
      // Clear undo option after 5 seconds
      const timer = setTimeout(() => {
        setShowUndoSnackbar(false);
        setDeletedSale(null);
      }, 5000);
      setUndoTimer(timer);

      toast.success('Sale deleted successfully');

    } catch (error: any) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    } finally {
      setDeletingSaleId(null);
    }
  };

  const undoDeleteSale = async () => {
    if (!deletedSale) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Clear the undo timer
      if (undoTimer) {
        clearTimeout(undoTimer);
        setUndoTimer(null);
      }

      // Restore the main sale record
      const { error: restoreSaleError } = await supabase
        .from('sales')
        .insert(deletedSale.sale);

      if (restoreSaleError) {
        throw restoreSaleError;
      }

      // Restore sale items
      if (deletedSale.saleItems.length > 0) {
        const { error: restoreItemsError } = await supabase
          .from('sale_items')
          .insert(deletedSale.saleItems);

        if (restoreItemsError) {
          throw restoreItemsError;
        }
      }

      // Log the restoration
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          action: 'restore_sale',
          resource_type: 'sale',
          resource_id: deletedSale.sale.id,
          details: `Sale restored: ${deletedSale.sale.product_name} - ${formatCurrency(deletedSale.sale.selling_price)}`
        });

      // Update local state
      setSales(prev => [deletedSale.sale, ...prev]);
      
      // Clear undo state
      setShowUndoSnackbar(false);
      setDeletedSale(null);

      toast.success('Sale restored successfully');

    } catch (error: any) {
      console.error('Error restoring sale:', error);
      toast.error('Failed to restore sale');
    }
  };

  const cancelUndo = () => {
    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }
    setShowUndoSnackbar(false);
    setDeletedSale(null);
  };

  const toggleSelectSale = (saleId: string) => {
    setSelectedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedSaleIds(new Set(filteredSales.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSaleIds(new Set());
  };

  const confirmBulkDelete = async () => {
    if (selectedSaleIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const ids = Array.from(selectedSaleIds);

      // Delete sale_items first
      const { error: itemsErr } = await supabase
        .from('sale_items')
        .delete()
        .in('sale_id', ids);
      if (itemsErr) throw itemsErr;

      // Delete the sales
      const { error: salesErr } = await supabase
        .from('sales')
        .delete()
        .in('id', ids);
      if (salesErr) throw salesErr;

      setSales(prev => prev.filter(s => !selectedSaleIds.has(s.id)));
      toast.success(`${ids.length} sale${ids.length > 1 ? 's' : ''} deleted`);
      setSelectedSaleIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      toast.error('Failed to delete sales');
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmBulkArchive = async () => {
    if (selectedSaleIds.size === 0) return;
    setBulkArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const ids = Array.from(selectedSaleIds);

      const { error } = await supabase
        .from('sales')
        .update({ is_archived: true })
        .in('id', ids);
      if (error) throw error;

      setSales(prev => prev.filter(s => !selectedSaleIds.has(s.id)));
      toast.success(`${ids.length} sale${ids.length > 1 ? 's' : ''} archived`);
      setSelectedSaleIds(new Set());
      setBulkArchiveConfirm(false);
    } catch (err: any) {
      console.error('Bulk archive error:', err);
      toast.error('Failed to archive sales');
    } finally {
      setBulkArchiving(false);
    }
  };

  const confirmBulkUnarchive = async () => {
    if (selectedSaleIds.size === 0) return;
    setBulkUnarchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const ids = Array.from(selectedSaleIds);

      const { error } = await supabase
        .from('sales')
        .update({ is_archived: false })
        .in('id', ids);
      if (error) throw error;

      setSales(prev => prev.filter(s => !selectedSaleIds.has(s.id)));
      toast.success(`${ids.length} sale${ids.length > 1 ? 's' : ''} unarchived`);
      setSelectedSaleIds(new Set());
    } catch (err: any) {
      console.error('Bulk unarchive error:', err);
      toast.error('Failed to unarchive sales');
    } finally {
      setBulkUnarchiving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimer) {
        clearTimeout(undoTimer);
      }
    };
  }, [undoTimer]);

  const openEditSale = async (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      location: sale.location,
      delivery_guy: sale.delivery_guy,
      delivery_fee: sale.delivery_fee,
      date: sale.date,
      payment_status: sale.payment_status,
    });
    setEditItems([]);
    setLoadingEditItems(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, product_name, vendor_name, vendor, buying_price, selling_price, quantity, vendor_payment_status')
        .eq('sale_id', sale.id)
        .eq('is_deleted', false);

      if (error) throw error;

      const items: EditItem[] = (data || []).map((row: any) => ({
        id: row.id,
        product_name: row.product_name ?? '',
        vendor_name: row.vendor_name ?? row.vendor ?? '',
        buying_price: Number(row.buying_price ?? 0),
        selling_price: Number(row.selling_price ?? 0),
        quantity: Number(row.quantity ?? 1),
        vendor_payment_status: (row.vendor_payment_status === 'Paid' ? 'Paid' : 'Unpaid'),
      }));

      if (items.length === 0) {
        items.push({
          id: '',
          product_name: sale.product_name,
          vendor_name: sale.seller,
          buying_price: sale.buying_price,
          selling_price: sale.selling_price,
          quantity: 1,
          vendor_payment_status: (sale.amount_owed_to_vendor ?? 0) > 0 ? 'Unpaid' : 'Paid',
        });
      }

      setEditItems(items);
    } catch (err: any) {
      console.error('Error loading sale items:', err);
      toast.error('Failed to load products for this sale');
    } finally {
      setLoadingEditItems(false);
    }
  };

  const updateEditItem = (index: number, patch: Partial<EditItem>) => {
    setEditItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const saveEditSale = async () => {
    if (!editingSale) return;
    setSavingEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to edit a sale');
        return;
      }

      if (editItems.length === 0) {
        toast.error('At least one product is required');
        return;
      }

      for (let i = 0; i < editItems.length; i++) {
        const it = editItems[i];
        if (!it.product_name.trim()) {
          toast.error(`Product ${i + 1}: name is required`);
          return;
        }
        if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
          toast.error(`Product ${i + 1}: quantity must be greater than 0`);
          return;
        }
        if (!Number.isFinite(it.buying_price) || it.buying_price < 0) {
          toast.error(`Product ${i + 1}: buying price is invalid`);
          return;
        }
        if (!Number.isFinite(it.selling_price) || it.selling_price < 0) {
          toast.error(`Product ${i + 1}: selling price is invalid`);
          return;
        }
      }

      const deliveryFee = Number(editForm.delivery_fee ?? 0);

      // 1) Update each sale_item individually
      for (const it of editItems) {
        const itemUpdates: any = {
          product_name: it.product_name.trim(),
          vendor: it.vendor_name,
          vendor_name: it.vendor_name,
          buying_price: it.buying_price,
          selling_price: it.selling_price,
          unit_price: it.selling_price,
          quantity: it.quantity,
          subtotal: it.selling_price * it.quantity,
          vendor_payment_status: it.vendor_payment_status,
          vendor_payment: it.vendor_payment_status === 'Paid' ? it.buying_price * it.quantity : 0,
          profit: (it.selling_price - it.buying_price) * it.quantity,
          updated_at: new Date().toISOString(),
        };

        if (it.id) {
          const { error: itemErr } = await supabase
            .from('sale_items')
            .update(itemUpdates)
            .eq('id', it.id)
            .eq('user_id', user.id);
          if (itemErr) throw itemErr;
        } else {
          const { error: insErr } = await supabase
            .from('sale_items')
            .insert({
              ...itemUpdates,
              sale_id: editingSale.id,
              user_id: user.id,
            });
          if (insErr) throw insErr;
        }
      }

      // 2) Recompute and update the parent sale aggregate
      const totalBuying = editItems.reduce((s, it) => s + it.buying_price * it.quantity, 0);
      const totalSelling = editItems.reduce((s, it) => s + it.selling_price * it.quantity, 0);
      const amountOwedToVendor = editItems.reduce(
        (s, it) => s + (it.vendor_payment_status === 'Unpaid' ? it.buying_price * it.quantity : 0),
        0
      );
      const profit = totalSelling - totalBuying - deliveryFee;

      const saleUpdates: any = {
        product_name: editItems.map(i => i.product_name.trim()).join(', '),
        seller: Array.from(new Set(editItems.map(i => i.vendor_name).filter(Boolean))).join(', '),
        buying_price: totalBuying,
        selling_price: totalSelling,
        amount_owed_to_vendor: amountOwedToVendor,
        location: editForm.location ?? editingSale.location,
        delivery_guy: editForm.delivery_guy ?? editingSale.delivery_guy,
        delivery_fee: deliveryFee,
        date: editForm.date ?? editingSale.date,
        payment_status: editForm.payment_status ?? editingSale.payment_status,
        profit,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSale, error: saleErr } = await supabase
        .from('sales')
        .update(saleUpdates)
        .eq('id', editingSale.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (saleErr) throw saleErr;
      if (!updatedSale) {
        toast.error('Sale not found or not owned by you');
        return;
      }

      setSales(prev => prev.map(s => (s.id === editingSale.id ? { ...s, ...updatedSale } : s)));

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update_sale',
        resource_type: 'sale',
        resource_id: editingSale.id,
        details: `Sale edited: ${saleUpdates.product_name}`,
      });

      toast.success('Sale updated');
      setEditingSale(null);
      setEditForm({});
      setEditItems([]);
    } catch (err: any) {
      console.error('Error updating sale:', err);
      toast.error(err.message || 'Failed to update sale');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleExpandSale = (saleId: string) => {
    setExpandedSaleId(expandedSaleId === saleId ? null : saleId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Overview */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Today's Gross */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(overviewStats.todaySalesRevenue)}</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-600">Today's Gross</p>
                  <span className="text-sm font-medium text-blue-600">
                    ({overviewStats.todaySalesCount})
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* This Week's Gross */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(overviewStats.weekSalesRevenue)}</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-600">This Week's Gross</p>
                  <span className="text-sm font-medium text-green-600">
                    ({overviewStats.weekSalesCount})
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* This Month's Net */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(overviewStats.monthSalesRevenue)}</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-600">This Month's Net</p>
                  <span className="text-sm font-medium text-purple-600">
                    ({overviewStats.monthSalesCount})
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Owed to Vendors */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(overviewStats.amountOwedToVendors)}</p>
                <p className="text-sm text-gray-600">Owed to Vendors</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">View Sales</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          <div className="relative">
            <button
              onClick={() => {
                // Toggle sort order if clicking the same field
                if (filters.sortBy === 'date') {
                  setFilters(prev => ({
                    ...prev,
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                  }));
                } else {
                  setFilters(prev => ({
                    ...prev,
                    sortBy: 'date',
                    sortOrder: 'desc'
                  }));
                }
                filterAndSortSales();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Sort by Date
              {filters.sortBy === 'date' && (
                filters.sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products, sellers, locations..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    dateRange: { ...filters.dateRange, start: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    dateRange: { ...filters.dateRange, end: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Archive Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            !showArchived ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Active Sales
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showArchived ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          Archived
        </button>
      </div>

      {/* Bulk Selection Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border p-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={filteredSales.length > 0 && selectedSaleIds.size === filteredSales.length}
            onChange={() => {
              if (selectedSaleIds.size === filteredSales.length) deselectAll();
              else selectAllVisible();
            }}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">
            {selectedSaleIds.size > 0
              ? `${selectedSaleIds.size} selected`
              : 'Select sales'}
          </span>
        </div>
        {selectedSaleIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Deselect All
            </button>
            {showArchived ? (
              <button
                onClick={confirmBulkUnarchive}
                disabled={bulkUnarchiving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {bulkUnarchiving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Undo className="w-3.5 h-3.5" />
                )}
                Unarchive ({selectedSaleIds.size})
              </button>
            ) : (
              <>
                <button
                  onClick={() => setBulkArchiveConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive ({selectedSaleIds.size})
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selectedSaleIds.size})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete {selectedSaleIds.size} Sale{selectedSaleIds.size > 1 ? 's' : ''}?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              All selected sales and their associated items will be permanently deleted.
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
                onClick={confirmBulkDelete}
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
                <h3 className="text-lg font-semibold text-gray-900">Archive {selectedSaleIds.size} Sale{selectedSaleIds.size > 1 ? 's' : ''}?</h3>
                <p className="text-sm text-gray-500">Archived sales won't appear in calculations.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Selected sales will be archived and excluded from all financial summaries and reports.
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
                onClick={confirmBulkArchive}
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

      {/* Mobile Card View */}
      <div className="space-y-2">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No sales found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.dateRange.start || filters.paymentStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first sale'}
            </p>
          </div>
        ) : (
          filteredSales.map((sale, index) => (
            <div key={sale.id} className="animate-fade-in" ref={index === filteredSales.length - 1 ? lastSaleElementRef : undefined}>
              <div 
                className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all duration-300 ${
                  (sale.amount_owed_to_vendor > 0 || !sale.delivery_fee_paid) 
                    ? 'border-l-4 border-l-red-500' 
                    : 'border-l-4 border-l-green-500'
                }`}
              >
                {/* Card Header - Always Visible */}
                <div
                  className={`p-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${
                    expandedSaleId === sale.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSaleIds.has(sale.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectSale(sale.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                  />
                  <div
                    className="flex-1"
                    onClick={() => toggleExpandSale(sale.id)}
                    aria-expanded={expandedSaleId === sale.id}
                    aria-controls={`sale-details-${sale.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Space') {
                        e.preventDefault();
                        toggleExpandSale(sale.id);
                      }
                    }}
                  >
                  <div className="grid grid-cols-12 gap-2 w-full">
                    {/* Product Name - 6 cols */}
                    <div className="col-span-6">
                      <div className="flex flex-col">                        
                        <h3 className="font-medium text-gray-900 break-words" title={sale.product_name}>{sale.product_name}</h3>
                      </div>
                    </div>
                    
                    {/* Status & Expand - 6 cols */}
                    <div className="col-span-6 flex flex-col items-end justify-center">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full mb-1 ${
                        sale.payment_status === 'Paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {sale.payment_status}
                      </span>
                      
                      {expandedSaleId === sale.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    
                    {/* Second row with Date, Location, Price - 12 cols */}
                    <div className="col-span-12 flex items-center justify-between mt-1">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 text-gray-500 mr-1 flex-shrink-0" />
                        <span className="text-xs text-gray-500 mr-3 flex-shrink-0">{new Date(sale.date).toLocaleDateString()}</span>
                        
                        <MapPin className="w-3 h-3 text-gray-500 mr-1 flex-shrink-0" />
                        <span className="text-xs text-gray-700 break-words">{sale.location}</span>
                      </div>
                      
                      <div className="font-medium text-gray-900 flex-shrink-0">{formatCurrency(sale.selling_price)}</div>
                    </div>
                  </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {expandedSaleId === sale.id && (
                  <div 
                    id={`sale-details-${sale.id}`}
                    className="p-4 border-t border-gray-100 bg-gray-50 animate-fade-in"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column - Financial Details */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-700 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-blue-500" />
                          Financial Details
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Buying Price</p>
                            <p className="font-medium">{formatCurrency(sale.buying_price)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Selling Price</p>
                            <p className="font-medium">{formatCurrency(sale.selling_price)}</p>
                          </div>
                         <div>
                           <p className="text-xs text-gray-500">Profit</p>
                           <p className="font-medium text-green-600">{formatCurrency(sale.profit)}</p>
                         </div>
                          <div>
                            <p className="text-xs text-gray-500">Delivery Fee</p>
                            <p className="font-medium">{formatCurrency(sale.delivery_fee)}</p>
                          </div>
                          
                          {sale.tax_type && sale.tax_type !== 'none' && (
                            <div>
                              <p className="text-xs text-gray-500">Tax Type</p>
                              <p className="font-medium capitalize">{sale.tax_type}</p>
                            </div>
                          )}
                          
                          {sale.tax_type === 'vat' && sale.vat_amount && (
                            <div>
                              <p className="text-xs text-gray-500">VAT Amount</p>
                              <p className="font-medium">{formatCurrency(sale.vat_amount)}</p>
                            </div>
                          )}
                          
                          {sale.tax_type === 'turnover' && sale.turnover_tax_amount && (
                            <div>
                              <p className="text-xs text-gray-500">Turnover Tax</p>
                              <p className="font-medium">{formatCurrency(sale.turnover_tax_amount)}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="pt-2 text-xs text-gray-500">
                          <p>Created: {new Date(sale.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {/* Right Column - Vendor & Delivery */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-700 flex items-center gap-1">
                          <Info className="w-4 h-4 text-blue-500" />
                          Vendor & Delivery Details
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Vendor</p>
                            <p className="font-medium">{sale.seller}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Delivery Person</p>
                            <p className="font-medium">{sale.delivery_guy}</p>
                          </div>
                          
                          {/* Vendor Toggle */}
                          <div className="flex items-center gap-2 pt-2">
                            <div className="relative inline-block w-10 mr-2 align-middle select-none">
                              <input 
                                type="checkbox" 
                                name={`vendor-toggle-${sale.id}`}
                                id={`vendor-toggle-${sale.id}`}
                                checked={sale.amount_owed_to_vendor === 0}
                                onChange={() => toggleVendorPaymentStatus(sale.id)}
                                disabled={updatingSaleId === sale.id}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                              />
                              <label 
                                htmlFor={`vendor-toggle-${sale.id}`}
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                                  sale.amount_owed_to_vendor === 0 ? 'bg-green-400' : 'bg-red-400'
                                }`}
                              ></label>
                            </div>
                            <div className="flex items-center">
                              <User className="w-4 h-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-700">Vendor Paid</span>
                              {sale.amount_owed_to_vendor === 0 && (
                                <Check className="w-3 h-3 text-green-500 ml-1" />
                              )}
                            </div>
                          </div>
                          
                          {/* Delivery Toggle */}
                          <div className="flex items-center gap-2">
                            <div className="relative inline-block w-10 mr-2 align-middle select-none">
                              <input 
                                type="checkbox" 
                                name={`delivery-toggle-${sale.id}`}
                                id={`delivery-toggle-${sale.id}`}
                                checked={sale.delivery_fee_paid}
                                onChange={() => toggleDeliveryPaymentStatus(sale.id, sale.delivery_fee_paid)}
                                disabled={updatingSaleId === sale.id}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                              />
                              <label 
                                htmlFor={`delivery-toggle-${sale.id}`}
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                                  sale.delivery_fee_paid ? 'bg-green-400' : 'bg-red-400'
                                }`}
                              ></label>
                            </div>
                            <div className="flex items-center">
                              <Truck className="w-4 h-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-700">Delivery Paid</span>
                              {sale.delivery_fee_paid && (
                                <Check className="w-3 h-3 text-green-500 ml-1" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4 pt-3 border-t border-gray-200">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditSale(sale);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSale(sale.id);
                          }}
                          disabled={deletingSaleId === sale.id}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded flex items-center gap-1"
                        >
                          {deletingSaleId === sale.id ? (
                            <>
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator for infinite scroll */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Edit Sale</h3>
                  <p className="text-xs text-gray-500">Edit each product independently. Totals recalculate on save.</p>
                </div>
              </div>

              {/* Per-product sections */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Products {editItems.length > 0 && <span className="text-gray-400">({editItems.length})</span>}
                </h4>

                {loadingEditItems ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  editItems.map((item, idx) => (
                    <div key={item.id || `new-${idx}`} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Product {idx + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          Subtotal: {formatCurrency(item.selling_price * item.quantity)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={item.product_name}
                            onChange={(e) => updateEditItem(idx, { product_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                          <input
                            type="text"
                            value={item.vendor_name}
                            onChange={(e) => updateEditItem(idx, { vendor_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateEditItem(idx, { quantity: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Buying Price</label>
                          <input
                            type="number"
                            min={0}
                            value={item.buying_price}
                            onChange={(e) => updateEditItem(idx, { buying_price: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Selling Price</label>
                          <input
                            type="number"
                            min={0}
                            value={item.selling_price}
                            onChange={(e) => updateEditItem(idx, { selling_price: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Payment Status</label>
                          <select
                            value={item.vendor_payment_status}
                            onChange={(e) =>
                              updateEditItem(idx, {
                                vendor_payment_status: e.target.value === 'Paid' ? 'Paid' : 'Unpaid',
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sale-level fields */}
              <div className="pt-2 border-t border-gray-200 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Sale Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                    <input
                      type="text"
                      value={editForm.location ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Person</label>
                    <input
                      type="text"
                      value={editForm.delivery_guy ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, delivery_guy: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Fee</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.delivery_fee ?? 0}
                      onChange={(e) => setEditForm({ ...editForm, delivery_fee: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={editForm.date ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
                    <select
                      value={editForm.payment_status ?? 'Unpaid'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, payment_status: e.target.value as 'Paid' | 'Unpaid' })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setEditingSale(null); setEditForm({}); setEditItems([]); }}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditSale}
                  disabled={savingEdit || loadingEditItems}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {savingEdit ? (
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-red-100">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Confirm Deletion</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to permanently delete this sale and all its related data? 
                This will remove the sale from all reports, dashboards, and vendor transactions.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDeleteSale(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Undo Snackbar */}
      {showUndoSnackbar && deletedSale && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span>Sale deleted. You have 5 seconds to undo.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={undoDeleteSale}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <Undo className="w-4 h-4" />
              Undo
            </button>
            <button
              onClick={cancelUndo}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesList;