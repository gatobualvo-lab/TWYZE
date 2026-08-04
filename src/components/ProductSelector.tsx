import React, { useState, useEffect, useRef } from 'react';
import { Plus, CreditCard as Edit, Trash2, Check, X, ChevronDown, Package, Search } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

interface ProductSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect?: (product: { name: string; price: number; buying_price: number; colors: string[] }) => void;
  required?: boolean;
  error?: string;
}

interface Product {
  id: string;
  name: string;
  price?: number;
  buying_price?: number;
  colors?: string[] | null;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  value,
  onChange,
  onProductSelect,
  required = false,
  error
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductColors, setNewProductColors] = useState<string[]>([]);
  const [newColorInput, setNewColorInput] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editColors, setEditColors] = useState<string[]>([]);
  const [editColorInput, setEditColorInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const editListRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
    
    // Close modals when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsAddModalOpen(false);
      }
      if (editListRef.current && !editListRef.current.contains(event.target as Node)) {
        setIsEditListOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value || !onProductSelect) return;
    const match = products.find(p => p.name.toLowerCase() === value.toLowerCase());
    if (match && (match.colors?.length ?? 0) > 0) {
      onProductSelect({
        name: match.name,
        price: Number(match.price) || 0,
        buying_price: Number(match.buying_price) || 0,
        colors: match.colors ?? [],
      });
    }
  }, [products, value]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_products')
        .select('id, name, price, buying_price, colors')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('product_name, colors')
        .eq('user_id', user.id)
        .eq('is_deleted', false);

      const inventoryColorMap = new Map<string, string[]>();
      (inventoryData || []).forEach((row: any) => {
        const name = (row.product_name || '').toLowerCase().trim();
        if (!name) return;
        const colors = Array.isArray(row.colors) ? row.colors : [];
        if (colors.length === 0) return;
        const existing = inventoryColorMap.get(name) ?? [];
        const merged = [...existing];
        colors.forEach((c: string) => {
          if (!merged.some(m => m.toLowerCase() === c.toLowerCase())) merged.push(c);
        });
        inventoryColorMap.set(name, merged);
      });

      const merged = (data || []).map((p: any) => {
        const nameKey = (p.name || '').toLowerCase().trim();
        const existing = Array.isArray(p.colors) ? p.colors : [];
        const fromInventory = inventoryColorMap.get(nameKey) ?? [];
        const combined = [...existing];
        fromInventory.forEach(c => {
          if (!combined.some(m => m.toLowerCase() === c.toLowerCase())) combined.push(c);
        });
        return { ...p, colors: combined };
      });

      setProducts(merged);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNewProduct = async () => {
    if (!newProductName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const { data, error } = await supabase
        .from('user_products')
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          name: newProductName.trim(),
          colors: newProductColors,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This product already exists');
        } else {
          throw error;
        }
        return;
      }

      setProducts(prev => [...prev, data]);
      onChange(newProductName.trim());
      if (onProductSelect) {
        onProductSelect({
          name: data.name,
          price: Number(data.price) || 0,
          buying_price: Number(data.buying_price) || 0,
          colors: data.colors ?? [],
        });
      }
      setNewProductName('');
      setNewProductColors([]);
      setNewColorInput('');
      setIsAddModalOpen(false);
      toast.success('Product added successfully');
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(error.message || 'Failed to add product');
    }
  };

  const updateProduct = async () => {
    if (!editingProduct || !editValue.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_products')
        .update({ name: editValue.trim(), colors: editColors })
        .eq('id', editingProduct.id)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('This product already exists');
        } else {
          throw error;
        }
        return;
      }

      setProducts(prev => prev.map(product =>
        product.id === editingProduct.id
          ? { ...product, name: editValue.trim(), colors: editColors }
          : product
      ));

      if (value === editingProduct.name) {
        onChange(editValue.trim());
      }

      setEditingProduct(null);
      setEditValue('');
      setEditColors([]);
      setEditColorInput('');
      toast.success('Product updated successfully');
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(error.message || 'Failed to update product');
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_products')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setProducts(prev => prev.filter(product => product.id !== id));
      
      // If the deleted product was the selected value, clear it
      if (value === name) {
        onChange('');
      }
      
      toast.success('Product deleted successfully');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const addColorChip = (list: string[], setList: (c: string[]) => void, input: string, setInput: (v: string) => void) => {
    const value = input.trim();
    if (!value) return;
    if (list.some(c => c.toLowerCase() === value.toLowerCase())) {
      toast.error('Color already added');
      return;
    }
    setList([...list, value]);
    setInput('');
  };

  const filteredProducts = searchTerm
    ? products.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : products;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <Package className="w-4 h-4 inline mr-1" /> Product Name {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="flex gap-2">
        {/* Main Dropdown */}
        <div className="relative flex-1" ref={dropdownRef}>
          <div 
            className={`w-full px-3 py-2 border ${
                error ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer flex items-center`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <input
              type="text"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setSearchTerm(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
              }}
              className="w-full border-none focus:outline-none bg-transparent"
              placeholder="Select or enter product name"
              required={required}
              onClick={(e) => e.stopPropagation()}
            />
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
          
          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search products..."
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-1">
                {filteredProducts.length === 0 ? (
                  <div className="p-2 text-gray-500 text-center">No products found</div>
                ) : (
                  filteredProducts.map(product => (
                    <div 
                      key={product.id} 
                      className="p-2 cursor-pointer rounded hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(product.name);
                        if (onProductSelect) {
                          onProductSelect({
                            name: product.name,
                            price: Number(product.price) || 0,
                            buying_price: Number(product.buying_price) || 0,
                            colors: product.colors ?? [],
                          });
                        }
                        setIsDropdownOpen(false);
                      }}
                    >
                      {product.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        
        {/* Add Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
          title="Add Product"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
        
        {/* Edit List Button */}
        <button
          type="button"
          onClick={() => setIsEditListOpen(true)}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-1"
          title="Edit Product List"
        >
          <Edit className="w-4 h-4" />
          <span className="hidden sm:inline">Edit List</span>
        </button>
      </div>
      
      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div ref={modalRef} className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter product name"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color Options (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addColorChip(newProductColors, setNewProductColors, newColorInput, setNewColorInput);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Red, Blue, Black"
                  />
                  <button
                    type="button"
                    onClick={() => addColorChip(newProductColors, setNewProductColors, newColorInput, setNewColorInput)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Add
                  </button>
                </div>
                {newProductColors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newProductColors.map(color => (
                      <span key={color} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-700">
                        {color}
                        <button
                          type="button"
                          onClick={() => setNewProductColors(prev => prev.filter(c => c !== color))}
                          className="text-gray-500 hover:text-red-600"
                          aria-label={`Remove ${color}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Press Enter or click Add to include each color.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewProductName('');
                    setNewProductColors([]);
                    setNewColorInput('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addNewProduct}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit List Modal */}
      {isEditListOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div ref={editListRef} className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-bold mb-4">Manage Product List</h3>
            {products.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No products found</p>
            ) : (
              <ul className="space-y-2">
                {products.map(product => (
                  <li key={product.id} className="border border-gray-200 rounded-lg p-2">
                    {editingProduct?.id === product.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={updateProduct}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(null);
                              setEditColors([]);
                              setEditColorInput('');
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editColorInput}
                              onChange={(e) => setEditColorInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addColorChip(editColors, setEditColors, editColorInput, setEditColorInput);
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                              placeholder="Add color option"
                            />
                            <button
                              type="button"
                              onClick={() => addColorChip(editColors, setEditColors, editColorInput, setEditColorInput)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                            >
                              Add
                            </button>
                          </div>
                          {editColors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {editColors.map(color => (
                                <span key={color} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700">
                                  {color}
                                  <button
                                    type="button"
                                    onClick={() => setEditColors(prev => prev.filter(c => c !== color))}
                                    className="text-gray-500 hover:text-red-600"
                                    aria-label={`Remove ${color}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-gray-800">{product.name}</span>
                          {product.colors && product.colors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.colors.map(color => (
                                <span key={color} className="inline-block px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">
                                  {color}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setEditValue(product.name);
                              setEditColors(product.colors ?? []);
                              setEditColorInput('');
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id, product.name)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditListOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSelector;