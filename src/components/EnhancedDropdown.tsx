import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Check, X, ChevronDown, Search } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

interface EnhancedDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: 'product' | 'supplier' | 'delivery_guy' | 'staff';
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}

interface ListItem {
  id: string;
  name: string;
}

const typeToTable = {
  product: 'user_products',
  supplier: 'user_sellers',
  delivery_guy: 'user_delivery_guys',
  staff: 'user_staff'
};

const typeToLabel = {
  product: 'Product',
  supplier: 'Supplier',
  delivery_guy: 'Delivery Guy',
  staff: 'Staff/Provider'
};

const EnhancedDropdown: React.FC<EnhancedDropdownProps> = ({
  label,
  value,
  onChange,
  type,
  placeholder = 'Select...',
  required = false,
  icon
}) => {
  const [items, setItems] = useState<ListItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const editListRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchItems();
    
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
  }, [type]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from(typeToTable[type])
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(`Error fetching ${type}s:`, error);
    } finally {
      setLoading(false);
    }
  };

  const addNewItem = async () => {
    if (!newItemName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const { data, error } = await supabase
        .from(typeToTable[type])
        .insert({ 
          id: crypto.randomUUID(),
          user_id: user.id, 
          name: newItemName.trim() 
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error(`This ${typeToLabel[type].toLowerCase()} already exists`);
        } else {
          throw error;
        }
        return;
      }

      setItems(prev => [...prev, data]);
      onChange(newItemName.trim());
      setNewItemName('');
      setIsAddModalOpen(false);
      toast.success(`${typeToLabel[type]} added successfully`);
    } catch (error: any) {
      console.error(`Error adding ${type}:`, error);
      toast.error(error.message || `Failed to add ${typeToLabel[type].toLowerCase()}`);
    }
  };

  const updateItem = async () => {
    if (!editingItem || !editValue.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from(typeToTable[type])
        .update({ name: editValue.trim() })
        .eq('id', editingItem.id)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error(`This ${typeToLabel[type].toLowerCase()} already exists`);
        } else {
          throw error;
        }
        return;
      }

      // Update local state
      setItems(prev => prev.map(item => 
        item.id === editingItem.id ? { ...item, name: editValue.trim() } : item
      ));
      
      // If the edited item was the selected value, update it
      if (value === editingItem.name) {
        onChange(editValue.trim());
      }
      
      setEditingItem(null);
      setEditValue('');
      toast.success(`${typeToLabel[type]} updated successfully`);
    } catch (error: any) {
      console.error(`Error updating ${type}:`, error);
      toast.error(error.message || `Failed to update ${typeToLabel[type].toLowerCase()}`);
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from(typeToTable[type])
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      
      // If the deleted item was the selected value, clear it
      if (value === name) {
        onChange('');
      }
      
      toast.success(`${typeToLabel[type]} deleted successfully`);
    } catch (error: any) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(error.message || `Failed to delete ${typeToLabel[type].toLowerCase()}`);
    }
  };

  const filteredItems = searchTerm 
    ? items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : items;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {icon} {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="flex gap-2">
        {/* Main Dropdown */}
        <div className="relative flex-1" ref={dropdownRef}>
          <div 
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer flex items-center"
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
              placeholder={placeholder}
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
                    placeholder={`Search ${typeToLabel[type].toLowerCase()}s...`}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-1">
                {filteredItems.length === 0 ? (
                  <div className="p-2 text-gray-500 text-center">No items found</div>
                ) : (
                  filteredItems.map(item => (
                    <div 
                      key={item.id} 
                      className="p-2 cursor-pointer rounded hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(item.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {item.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Add Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
          title={`Add ${typeToLabel[type]}`}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
        
        {/* Edit List Button */}
        <button
          type="button"
          onClick={() => setIsEditListOpen(true)}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-1"
          title={`Edit ${typeToLabel[type]} List`}
        >
          <Edit className="w-4 h-4" />
          <span className="hidden sm:inline">Edit List</span>
        </button>
      </div>
      
      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div ref={modalRef} className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New {typeToLabel[type]}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Enter ${typeToLabel[type].toLowerCase()} name`}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewItemName('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addNewItem}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Add {typeToLabel[type]}
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
            <h3 className="text-lg font-bold mb-4">Manage {typeToLabel[type]} List</h3>
            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No {typeToLabel[type].toLowerCase()}s found</p>
            ) : (
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item.id} className="border border-gray-200 rounded-lg p-2">
                    {editingItem?.id === item.id ? (
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
                          onClick={updateItem}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItem(null)}
                          className="p-1 text-gray-600 hover:text-gray-800"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800">{item.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setEditValue(item.name);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id, item.name)}
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

export default EnhancedDropdown;