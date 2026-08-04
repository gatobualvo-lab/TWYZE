import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Check, X, ChevronDown, Search } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

interface ClientDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}

interface Client {
  id: string;
  name: string;
}

const ClientDropdown: React.FC<ClientDropdownProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select client',
  required = false,
  icon
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const editListRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClients();
    
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

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_clients')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNewClient = async () => {
    if (!newClientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const { data, error } = await supabase
        .from('user_clients')
        .insert({ 
          id: crypto.randomUUID(),
          user_id: user.id, 
          name: newClientName.trim() 
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This client already exists');
        } else {
          throw error;
        }
        return;
      }

      setClients(prev => [...prev, data]);
      onChange(newClientName.trim());
      setNewClientName('');
      setIsAddModalOpen(false);
      toast.success('Client added successfully');
    } catch (error: any) {
      console.error('Error adding client:', error);
      toast.error(error.message || 'Failed to add client');
    }
  };

  const updateClient = async () => {
    if (!editingClient || !editValue.trim()) {
      toast.error('Please enter a client name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_clients')
        .update({ name: editValue.trim() })
        .eq('id', editingClient.id)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('This client already exists');
        } else {
          throw error;
        }
        return;
      }

      // Update local state
      setClients(prev => prev.map(client => 
        client.id === editingClient.id ? { ...client, name: editValue.trim() } : client
      ));
      
      // If the edited client was the selected value, update it
      if (value === editingClient.name) {
        onChange(editValue.trim());
      }
      
      setEditingClient(null);
      setEditValue('');
      toast.success('Client updated successfully');
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error(error.message || 'Failed to update client');
    }
  };

  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_clients')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setClients(prev => prev.filter(client => client.id !== id));
      
      // If the deleted client was the selected value, clear it
      if (value === name) {
        onChange('');
      }
      
      toast.success('Client deleted successfully');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error(error.message || 'Failed to delete client');
    }
  };

  const filteredClients = searchTerm 
    ? clients.filter(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : clients;

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
                    placeholder="Search clients..."
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-1">
                {filteredClients.length === 0 ? (
                  <div className="p-2 text-gray-500 text-center">No clients found</div>
                ) : (
                  filteredClients.map(client => (
                    <div 
                      key={client.id} 
                      className="p-2 cursor-pointer rounded hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(client.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {client.name}
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
          title="Add Client"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
        
        {/* Edit List Button */}
        <button
          type="button"
          onClick={() => setIsEditListOpen(true)}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-1"
          title="Edit Client List"
        >
          <Edit className="w-4 h-4" />
          <span className="hidden sm:inline">Edit List</span>
        </button>
      </div>
      
      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div ref={modalRef} className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Client</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter client name"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewClientName('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addNewClient}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Add Client
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
            <h3 className="text-lg font-bold mb-4">Manage Client List</h3>
            {clients.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No clients found</p>
            ) : (
              <ul className="space-y-2">
                {clients.map(client => (
                  <li key={client.id} className="border border-gray-200 rounded-lg p-2">
                    {editingClient?.id === client.id ? (
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
                          onClick={updateClient}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingClient(null)}
                          className="p-1 text-gray-600 hover:text-gray-800"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800">{client.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(client);
                              setEditValue(client.name);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClient(client.id, client.name)}
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

export default ClientDropdown;