import { getAccountCurrency } from '../utils/accountCurrency';
import React, { useState, useEffect } from 'react';
import { Package, Plus, CreditCard as Edit, Trash2, AlertTriangle, TrendingDown, Search, Filter, Receipt, X, Palette, Image as ImageIcon, Briefcase } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';
import { toNum, parseInput, NumericInput } from '../utils/numberInput';
import { formatCurrency } from '../utils/format';
import { enqueueWrite, isNetworkError } from '../services/offline/offlineQueue';
import { uploadPublicImage, ImageUploadError } from '../services/storage/publicImageUpload';
import { syncProductCatalog } from '../services/inventory/productCatalog';
import CameraBarcodeScanner, { isCameraScanSupported } from './CameraBarcodeScanner';

interface InventoryItem {
  id: string;
  product_name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | null;
  current_stock: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
  unit: string | null;
  description: string | null;
  colors: string[] | null;
  item_type?: 'goods' | 'service' | null;
  image_url?: string | null;
  created_at: string;
}

interface ProductSaleRow {
  id: string;
  quantity: number;
  buying_price: number | null;
  selling_price: number | null;
  unit_price: number | null;
  subtotal: number | null;
  profit: number | null;
  vendor_payment_status: string | null;
  vendor: string | null;
  vendor_name: string | null;
  sale: {
    id: string;
    date: string | null;
    sale_date: string | null;
    client_name: string | null;
    payment_status: string | null;
    seller: string | null;
  } | null;
}

const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [salesProduct, setSalesProduct] = useState<InventoryItem | null>(null);
  const [salesRows, setSalesRows] = useState<ProductSaleRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  const [formData, setFormData] = useState<{
    product_name: string;
    sku: string;
    barcode: string;
    category: string;
    current_stock: NumericInput;
    reorder_level: NumericInput;
    cost_price: NumericInput;
    selling_price: NumericInput;
    unit: string;
    description: string;
    colors: string[];
    item_type: 'goods' | 'service';
    image_url: string;
  }>({
    product_name: '',
    sku: '',
    barcode: '',
    category: '',
    current_stock: '',
    reorder_level: '',
    cost_price: '',
    selling_price: '',
    unit: '',
    description: '',
    colors: [],
    item_type: 'goods',
    image_url: ''
  });

  const [showCameraScan, setShowCameraScan] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [colorInput, setColorInput] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, filterCategory, showLowStock]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view inventory');
        return;
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('product_name');

      if (error) {
        throw error;
      }

      // Services live on their own page (Inventory > Services).
      setItems((data || []).filter(row => row.item_type !== 'service'));
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast.error(error.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = items;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        (item.product_name ?? '').toLowerCase().includes(q) ||
        (item.sku ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filterCategory) {
      filtered = filtered.filter(item => item.category === filterCategory);
    }

    // Low stock filter
    if (showLowStock) {
      filtered = filtered.filter(item => item.item_type !== 'service' && item.current_stock <= item.reorder_level);
    }

    setFilteredItems(filtered);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error('You must be logged in');
      const url = await uploadPublicImage({
        bucket: 'product-images',
        userId: uid,
        prefix: 'product',
        file,
        maxDim: 900,
        previousUrl: formData.image_url,
      });
      setFormData(prev => ({ ...prev, image_url: url }));
    } catch (error) {
      console.error('Error uploading product image:', error);
      toast.error(error instanceof ImageUploadError ? error.message : 'Could not upload the photo');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_name || toNum(formData.selling_price) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // getUser() round-trips to the server, which fails outright while
      // offline — fall back to the locally persisted session so a queued
      // item doesn't get blocked by the connectivity check itself.
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // fall through to session fallback below
      }
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }
      if (!userId) {
        toast.error('You must be logged in to manage inventory');
        return;
      }

      const isService = formData.item_type === 'service';
      // item_type / image_url are only sent when they carry information, so
      // a plain goods item saves exactly as it always did.
      const { item_type: _itemType, image_url: _imageUrl, ...baseFields } = formData;
      const typeFields: { item_type?: 'goods' | 'service'; image_url?: string | null } = {};
      if (isService || editingItem?.item_type === 'service') typeFields.item_type = formData.item_type;
      if (formData.image_url) typeFields.image_url = formData.image_url;
      else if (editingItem?.image_url) typeFields.image_url = null;

      const itemData = {
        ...baseFields,
        ...typeFields,
        barcode: formData.barcode.trim() || null,
        current_stock: isService ? 0 : toNum(formData.current_stock),
        reorder_level: isService ? 0 : toNum(formData.reorder_level),
        cost_price: toNum(formData.cost_price),
        selling_price: toNum(formData.selling_price),
        colors: formData.colors,
        user_id: userId,
        id: editingItem?.id || crypto.randomUUID()
      };

      // upsert rather than insert/update so a queued offline write replays
      // the exact same way whether it was a new item or a stock edit.
      const { error } = await supabase.from('inventory_items').upsert(itemData);

      if (error) {
        if (!isNetworkError(error)) throw error;
        enqueueWrite({
          id: itemData.id,
          kind: 'inventory_item',
          table: 'inventory_items',
          payload: itemData,
          label: `${formData.product_name} — stock ${toNum(formData.current_stock)}`,
        });
        toast.success("Saved offline — will sync when you're back online", { duration: 5000 });
        resetForm();
        return;
      }

      // Sync with user_products so the sales form auto-fills buying/selling prices
      await syncProductCatalog(userId, formData.product_name, toNum(formData.cost_price), toNum(formData.selling_price), typeFields);

      toast.success(`Item ${editingItem ? 'updated' : 'added'} successfully!`);
      resetForm();
      fetchInventory();
    } catch (error: any) {
      console.error('Error saving item:', error);
      toast.error(
        /idx_inventory_items_user_barcode|duplicate key/i.test(error.message || '')
          ? 'Another item already uses this barcode'
          : error.message || 'Failed to save item'
      );
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      toast.success('Item deleted successfully');
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      sku: '',
      barcode: '',
      category: '',
      current_stock: '',
      reorder_level: '',
      cost_price: '',
      selling_price: '',
      unit: '',
      description: '',
      colors: [],
      item_type: 'goods',
      image_url: ''
    });
    setColorInput('');
    setEditingItem(null);
    setShowAddForm(false);
  };

  const addColorChip = () => {
    const value = colorInput.trim();
    if (!value) return;
    const exists = formData.colors.some(c => c.toLowerCase() === value.toLowerCase());
    if (exists) {
      setColorInput('');
      return;
    }
    setFormData(prev => ({ ...prev, colors: [...prev.colors, value] }));
    setColorInput('');
  };

  const removeColorChip = (color: string) => {
    setFormData(prev => ({ ...prev, colors: prev.colors.filter(c => c !== color) }));
  };

  const startEdit = (item: InventoryItem) => {
    setFormData({
      product_name: item.product_name,
      sku: item.sku || '',
      barcode: item.barcode || '',
      category: item.category || '',
      current_stock: item.current_stock,
      reorder_level: item.reorder_level,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
      unit: item.unit || '',
      description: item.description || '',
      colors: item.colors ?? [],
      item_type: item.item_type === 'service' ? 'service' : 'goods',
      image_url: item.image_url || ''
    });
    setColorInput('');
    setEditingItem(item);
    setShowAddForm(true);
  };

  const openSalesFor = async (item: InventoryItem) => {
    setSalesProduct(item);
    setSalesRows([]);
    setSalesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id, quantity, buying_price, selling_price, unit_price, subtotal, profit,
          vendor_payment_status, vendor, vendor_name,
          sale:sales!sale_items_sale_id_fkey (
            id, date, sale_date, client_name, payment_status, seller
          )
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .ilike('product_name', item.product_name)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        ...r,
        sale: Array.isArray(r.sale) ? r.sale[0] ?? null : r.sale ?? null,
      })) as ProductSaleRow[];
      setSalesRows(rows);
    } catch (err: any) {
      console.error('Error loading product sales:', err);
      toast.error(err.message || 'Failed to load sales for this product');
    } finally {
      setSalesLoading(false);
    }
  };

  const closeSalesModal = () => {
    setSalesProduct(null);
    setSalesRows([]);
  };

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const lowStockItems = items.filter(item => item.item_type !== 'service' && item.current_stock <= item.reorder_level);
  const totalValue = items.reduce((sum, item) => sum + (item.item_type === 'service' ? 0 : item.current_stock * item.cost_price), 0);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-indigo-100">
              <Package className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-3xl font-extrabold text-indigo-600">{items.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-green-100">
              <TrendingDown className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Inventory Value</p>
              <p className="text-3xl font-extrabold text-green-600">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-3xl font-extrabold text-red-600">{lowStockItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>Inventory Items</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search items..."
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Low Stock Only</span>
          </label>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 p-6 border border-gray-200 rounded-xl bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4" style={{ color: '#374151' }}>
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden">
                    {formData.image_url
                      ? <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-7 h-7 text-gray-300" />}
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                      {uploadingImage ? 'Uploading...' : formData.image_url ? 'Replace photo' : 'Add photo'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                    {formData.image_url && (
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))} className="block text-xs text-red-600 hover:text-red-700">
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Blue T-Shirt"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., TSH-BLU-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Scan with a barcode reader, or type it"
                  />
                  {isCameraScanSupported() && (
                    <button type="button" onClick={() => setShowCameraScan(true)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                      Camera
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Clothing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="pcs, kg, liters"
                />
              </div>

              {formData.item_type !== 'service' && (
              <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.current_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_stock: parseInput(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorder_level: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Alert when stock falls to this level</p>
              </div>
              </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buying Price (per unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{getAccountCurrency()}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">What it costs you per unit</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selling Price (per unit) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{getAccountCurrency()}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, selling_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">What you charge customers per unit</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Palette className="w-4 h-4 inline mr-1 -mt-0.5 text-indigo-600" />
                  Available Colors
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addColorChip();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. Red, Navy Blue, Black (press Enter to add)"
                  />
                  <button
                    type="button"
                    onClick={addColorChip}
                    className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium rounded-lg transition"
                  >
                    <Plus className="w-4 h-4 inline" /> Add
                  </button>
                </div>
                {formData.colors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.colors.map((color) => (
                      <span
                        key={color}
                        className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-sm text-indigo-800"
                      >
                        {color}
                        <button
                          type="button"
                          onClick={() => removeColorChip(color)}
                          className="p-0.5 hover:bg-indigo-200 rounded-full"
                          aria-label={`Remove ${color}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Optional. Add each color this item is available in.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Optional notes about this item"
                  rows={2}
                />
              </div>
              
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {editingItem ? 'Update' : 'Add'} Item
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prices</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-600">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-start gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-10 h-10 rounded-md object-cover border border-gray-200 flex-shrink-0" loading="lazy" />
                      ) : null}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.product_name}
                          {item.item_type === 'service' && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-xs font-medium text-sky-700">
                              <Briefcase className="w-3 h-3" /> Service
                            </span>
                          )}
                        </div>
                        {item.sku && <div className="text-sm text-gray-500">SKU: {item.sku}</div>}
                        {item.category && <div className="text-sm text-gray-500">{item.category}</div>}
                        {item.colors && item.colors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.colors.map((color) => (
                              <span
                                key={color}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs text-indigo-700"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {item.item_type === 'service' ? (
                        <div className="text-sm text-gray-400">Not tracked</div>
                      ) : (<>
                      <div className="text-sm text-gray-900">
                        {item.current_stock} {item.unit}
                      </div>
                      <div className="text-sm text-gray-500">
                        Reorder: {item.reorder_level}
                      </div>
                      </>)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>Cost: {formatCurrency(item.cost_price)}</div>
                      <div>Sell: {formatCurrency(item.selling_price)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-extrabold text-gray-900 text-right">
                      {item.item_type === 'service' ? '—' : formatCurrency(item.current_stock * item.cost_price)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {item.item_type === 'service' ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800">
                          Service
                        </span>
                      ) : item.current_stock <= item.reorder_level ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openSalesFor(item)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View sales for this product"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit item"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {salesProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeSalesModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Sales for {salesProduct.product_name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Every recorded sale of this product, with vendor and payment details.
                </p>
              </div>
              <button
                onClick={closeSalesModal}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1">
              {salesLoading ? (
                <div className="p-12 text-center text-gray-500">Loading sales...</div>
              ) : salesRows.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  No sales recorded for this product yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Units sold</p>
                      <p className="text-xl font-bold text-gray-900">
                        {salesRows.reduce((s, r) => s + (r.quantity || 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(salesRows.reduce((s, r) => s + ((r.subtotal ?? (r.selling_price ?? 0) * (r.quantity || 0))), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Profit</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(salesRows.reduce((s, r) => s + (r.profit || 0), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Sale count</p>
                      <p className="text-xl font-bold text-gray-900">{salesRows.length}</p>
                    </div>
                  </div>

                  <table className="w-full">
                    <thead className="bg-white sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sell</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {salesRows.map((row) => {
                        const rawDate = row.sale?.date ?? row.sale?.sale_date ?? null;
                        const displayDate = rawDate ? new Date(rawDate).toLocaleDateString('en-KE') : '-';
                        const vendor = row.vendor_name ?? row.vendor ?? row.sale?.seller ?? '-';
                        return (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{displayDate}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.sale?.client_name ?? '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{vendor}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{row.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {formatCurrency(row.selling_price ?? row.unit_price ?? 0)}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-semibold ${((row.profit || 0) >= 0) ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(row.profit || 0)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                row.vendor_payment_status === 'Paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {row.vendor_payment_status ?? 'Unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCameraScan && (
        <CameraBarcodeScanner
          onDetected={(code) => {
            setFormData(prev => ({ ...prev, barcode: code }));
            setShowCameraScan(false);
          }}
          onClose={() => setShowCameraScan(false)}
        />
      )}
    </div>
  );
};

export default InventoryManagement;