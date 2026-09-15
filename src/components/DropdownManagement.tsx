import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Trash2, Save, X, Package, Users, Truck, Palette, ChevronDown, ChevronUp, UserCog } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';

interface ColorOption {
  id: string;
  color_name: string;
  created_at: string;
}

interface DropdownItem {
  id: string;
  name: string;
  created_at: string;
  colors?: ColorOption[];
}

const DropdownManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers' | 'delivery_guys' | 'staff'>('products');
  const [products, setProducts] = useState<DropdownItem[]>([]);
  const [suppliers, setSuppliers] = useState<DropdownItem[]>([]);
  const [deliveryGuys, setDeliveryGuys] = useState<DropdownItem[]>([]);
  const [staff, setStaff] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [newColorName, setNewColorName] = useState('');
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editColorName, setEditColorName] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('You must be logged in to manage dropdowns');
        return;
      }

      // Fetch all dropdown data
      const [productsData, suppliersData, deliveryGuysData, staffData, colorsData] = await Promise.all([
        supabase
          .from('user_products')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),

        supabase
          .from('user_sellers')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),

        supabase
          .from('user_delivery_guys')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),

        supabase
          .from('user_staff')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),

        supabase
          .from('product_color_options')
          .select('*')
          .eq('user_id', user.id)
          .order('color_name')
      ]);

      // Attach color options to products
      const productsWithColors = (productsData.data || []).map(product => ({
        ...product,
        colors: (colorsData.data || []).filter(color => color.product_id === product.id)
      }));

      setProducts(productsWithColors);
      setSuppliers(suppliersData.data || []);
      setDeliveryGuys(deliveryGuysData.data || []);
      setStaff(staffData.data || []);

    } catch (error: any) {
      console.error('Error fetching dropdown data:', error);
      toast.error(error.message || 'Failed to load dropdown data');
    } finally {
      setLoading(false);
    }
  };

  // 'staff' doesn't pluralize with a trailing 's' like the others, so the
  // old `type.slice(0, -1)` singularizing trick breaks for it — spell out
  // the singular label per type instead.
  const singularLabel = (type: 'products' | 'suppliers' | 'delivery_guys' | 'staff'): string => {
    switch (type) {
      case 'products': return 'Product';
      case 'suppliers': return 'Supplier';
      case 'delivery_guys': return 'Delivery guy';
      case 'staff': return 'Staff member';
    }
  };

  const addItem = async (type: 'products' | 'suppliers' | 'delivery_guys' | 'staff', name: string) => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tableName = type === 'products' ? 'user_products' :
                       type === 'suppliers' ? 'user_sellers' :
                       type === 'delivery_guys' ? 'user_delivery_guys' : 'user_staff';

      const { data, error } = await supabase
        .from(tableName)
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          name: name.trim()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('This item already exists');
        } else {
          throw error;
        }
        return;
      }

      if (type === 'products') {
        setProducts(prev => [...prev, data]);
      } else if (type === 'suppliers') {
        setSuppliers(prev => [...prev, data]);
      } else if (type === 'delivery_guys') {
        setDeliveryGuys(prev => [...prev, data]);
      } else {
        setStaff(prev => [...prev, data]);
      }

      setNewItemName('');
      toast.success(`${singularLabel(type)} added successfully`);

    } catch (error: any) {
      console.error(`Error adding ${type}:`, error);
      toast.error(error.message || `Failed to add ${singularLabel(type).toLowerCase()}`);
    }
  };

  const editItem = async (type: 'products' | 'suppliers' | 'delivery_guys' | 'staff', id: string, newName: string) => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tableName = type === 'products' ? 'user_products' :
                       type === 'suppliers' ? 'user_sellers' :
                       type === 'delivery_guys' ? 'user_delivery_guys' : 'user_staff';

      const { error } = await supabase
        .from(tableName)
        .update({ name: newName.trim() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('This item already exists');
        } else {
          throw error;
        }
        return;
      }

      if (type === 'products') {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
      } else if (type === 'suppliers') {
        setSuppliers(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
      } else if (type === 'delivery_guys') {
        setDeliveryGuys(prev => prev.map(d => d.id === id ? { ...d, name: newName.trim() } : d));
      } else {
        setStaff(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
      }

      setEditingItem(null);
      setEditItemName('');
      toast.success(`${singularLabel(type)} updated successfully`);

    } catch (error: any) {
      console.error(`Error editing ${type}:`, error);
      toast.error(error.message || `Failed to edit ${singularLabel(type).toLowerCase()}`);
    }
  };

  const deleteItem = async (type: 'products' | 'suppliers' | 'delivery_guys' | 'staff', id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tableName = type === 'products' ? 'user_products' :
                       type === 'suppliers' ? 'user_sellers' :
                       type === 'delivery_guys' ? 'user_delivery_guys' : 'user_staff';

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      if (type === 'products') {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else if (type === 'suppliers') {
        setSuppliers(prev => prev.filter(s => s.id !== id));
      } else if (type === 'delivery_guys') {
        setDeliveryGuys(prev => prev.filter(d => d.id !== id));
      } else {
        setStaff(prev => prev.filter(s => s.id !== id));
      }

      toast.success(`${singularLabel(type)} deleted successfully`);

    } catch (error: any) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(error.message || `Failed to delete ${singularLabel(type).toLowerCase()}`);
    }
  };

  const addColor = async (productId: string, colorName: string) => {
    if (!colorName.trim()) {
      toast.error('Please enter a color name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('product_color_options')
        .insert({
          id: crypto.randomUUID(),
          product_id: productId,
          user_id: user.id,
          color_name: colorName.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, colors: [...(p.colors || []), data] }
          : p
      ));

      setNewColorName('');
      toast.success('Color added successfully');

    } catch (error: any) {
      console.error('Error adding color:', error);
      toast.error(error.message || 'Failed to add color');
    }
  };

  const editColor = async (productId: string, colorId: string, newColorName: string) => {
    if (!newColorName.trim()) {
      toast.error('Please enter a color name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('product_color_options')
        .update({ color_name: newColorName.trim() })
        .eq('id', colorId)
        .eq('user_id', user.id);

      if (error) throw error;

      setProducts(prev => prev.map(p =>
        p.id === productId
          ? {
              ...p,
              colors: (p.colors || []).map(c =>
                c.id === colorId ? { ...c, color_name: newColorName.trim() } : c
              )
            }
          : p
      ));

      setEditingColor(null);
      setEditColorName('');
      toast.success('Color updated successfully');

    } catch (error: any) {
      console.error('Error editing color:', error);
      toast.error(error.message || 'Failed to edit color');
    }
  };

  const deleteColor = async (productId: string, colorId: string, colorName: string) => {
    if (!confirm(`Are you sure you want to delete the color "${colorName}"?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('product_color_options')
        .delete()
        .eq('id', colorId)
        .eq('user_id', user.id);

      if (error) throw error;

      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, colors: (p.colors || []).filter(c => c.id !== colorId) }
          : p
      ));

      toast.success('Color deleted successfully');

    } catch (error: any) {
      console.error('Error deleting color:', error);
      toast.error(error.message || 'Failed to delete color');
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'products': return products;
      case 'suppliers': return suppliers;
      case 'delivery_guys': return deliveryGuys;
      case 'staff': return staff;
      default: return [];
    }
  };

  const getTabInfo = (tab: 'products' | 'suppliers' | 'delivery_guys' | 'staff') => {
    switch (tab) {
      case 'products':
        return {
          label: 'Products',
          icon: <Package className="w-5 h-5" />,
          color: 'bg-blue-600',
          description: 'Manage your product catalog'
        };
      case 'suppliers':
        return {
          label: 'Suppliers',
          icon: <Users className="w-5 h-5" />,
          color: 'bg-green-600',
          description: 'Manage your supplier list'
        };
      case 'delivery_guys':
        return {
          label: 'Delivery Guys',
          icon: <Truck className="w-5 h-5" />,
          color: 'bg-orange-600',
          description: 'Manage delivery personnel'
        };
      case 'staff':
        return {
          label: 'Staff/Providers',
          icon: <UserCog className="w-5 h-5" />,
          color: 'bg-purple-600',
          description: 'People who perform services for your customers'
        };
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-indigo-100">
            <Settings className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>
              Dropdown Management
            </h2>
            <p className="text-gray-600">Manage your products, suppliers, and delivery personnel lists</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex flex-wrap gap-2 mb-6">
          {(['products', 'suppliers', 'delivery_guys', 'staff'] as const).map((tab) => {
            const tabInfo = getTabInfo(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? `${tabInfo.color} text-white shadow-md`
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tabInfo.icon}
                {tabInfo.label}
              </button>
            );
          })}
        </div>

        {/* Current Tab Content */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800" style={{ color: '#374151' }}>
                {getTabInfo(activeTab).label}
              </h3>
              <p className="text-sm text-gray-600">{getTabInfo(activeTab).description}</p>
            </div>
            <div className="text-sm text-gray-500">
              {getCurrentData().length} items
            </div>
          </div>

          {/* Add New Item */}
          <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <h4 className="text-md font-bold text-gray-800 mb-3" style={{ color: '#374151' }}>
              Add New {getTabInfo(activeTab).label.slice(0, -1)}
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`Enter ${getTabInfo(activeTab).label.toLowerCase().slice(0, -1)} name`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addItem(activeTab, newItemName);
                  }
                }}
              />
              <button
                onClick={() => addItem(activeTab, newItemName)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  {activeTab === 'products' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Colors</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentData().length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'products' ? 4 : 3} className="px-4 py-12 text-center text-gray-600">
                      No {getTabInfo(activeTab).label.toLowerCase()} found. Add one above to get started.
                    </td>
                  </tr>
                ) : (
                  getCurrentData().map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          {editingItem === item.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editItemName}
                                onChange={(e) => setEditItemName(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    editItem(activeTab, item.id, editItemName);
                                  } else if (e.key === 'Escape') {
                                    setEditingItem(null);
                                    setEditItemName('');
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => editItem(activeTab, item.id, editItemName)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(null);
                                  setEditItemName('');
                                }}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          )}
                        </td>
                        {activeTab === 'products' && (
                          <td className="px-4 py-4">
                            <button
                              onClick={() => setExpandedProduct(expandedProduct === item.id ? null : item.id)}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                            >
                              <Palette className="w-4 h-4" />
                              {item.colors?.length || 0} colors
                              {expandedProduct === item.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          {editingItem !== item.id && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item.id);
                                  setEditItemName(item.name);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit item"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteItem(activeTab, item.id, item.name)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {activeTab === 'products' && expandedProduct === item.id && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 bg-gray-50">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Palette className="w-5 h-5 text-gray-700" />
                                <h4 className="font-semibold text-gray-800">Color Options for {item.name}</h4>
                              </div>

                              {/* Add New Color */}
                              <div className="flex gap-2 mb-4">
                                <input
                                  type="text"
                                  value={newColorName}
                                  onChange={(e) => setNewColorName(e.target.value)}
                                  placeholder="Enter color name"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      addColor(item.id, newColorName);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => addColor(item.id, newColorName)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Color
                                </button>
                              </div>

                              {/* Color List */}
                              {item.colors && item.colors.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {item.colors.map((color) => (
                                    <div
                                      key={color.id}
                                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                                    >
                                      {editingColor === color.id ? (
                                        <>
                                          <input
                                            type="text"
                                            value={editColorName}
                                            onChange={(e) => setEditColorName(e.target.value)}
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded mr-2"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                editColor(item.id, color.id, editColorName);
                                              } else if (e.key === 'Escape') {
                                                setEditingColor(null);
                                                setEditColorName('');
                                              }
                                            }}
                                            autoFocus
                                          />
                                          <div className="flex gap-1">
                                            <button
                                              onClick={() => editColor(item.id, color.id, editColorName)}
                                              className="text-green-600 hover:text-green-800"
                                            >
                                              <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setEditingColor(null);
                                                setEditColorName('');
                                              }}
                                              className="text-gray-500 hover:text-gray-700"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-sm font-medium text-gray-800">{color.color_name}</span>
                                          <div className="flex gap-1">
                                            <button
                                              onClick={() => {
                                                setEditingColor(color.id);
                                                setEditColorName(color.color_name);
                                              }}
                                              className="text-blue-600 hover:text-blue-900"
                                              title="Edit color"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => deleteColor(item.id, color.id, color.color_name)}
                                              className="text-red-600 hover:text-red-900"
                                              title="Delete color"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600 italic">No colors added yet. Add one above to get started.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropdownManagement;