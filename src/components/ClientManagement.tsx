import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, MapPin, ShoppingCart, DollarSign, ChevronDown, ChevronUp, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../utils/supabase';
import LoadingScreen from './LoadingScreen';
import toast from 'react-hot-toast';

interface ClientSummary {
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  totalOwed: number;
  lastOrderDate: string;
  locations: string[];
}

interface ClientSale {
  id: string;
  date: string;
  product_name: string;
  selling_price: number;
  payment_status: string;
  delivery_status: string;
  location: string;
  amount_owed_to_vendor: number;
}

const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const [clientSales, setClientSales] = useState<ClientSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'orders' | 'spent' | 'recent'>('recent');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    let filtered = clients;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = clients.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.locations.some(l => l.toLowerCase().includes(term))
      );
    }
    switch (sortBy) {
      case 'name':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'orders':
        filtered = [...filtered].sort((a, b) => b.totalOrders - a.totalOrders);
        break;
      case 'spent':
        filtered = [...filtered].sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case 'recent':
        filtered = [...filtered].sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
        break;
    }
    setFilteredClients(filtered);
  }, [clients, searchTerm, sortBy]);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sales, error } = await supabase
        .from('sales')
        .select('id, client_name, customer_phone, selling_price, payment_status, date, location, amount_owed_to_vendor')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .not('client_name', 'is', null)
        .neq('client_name', '');

      if (error) throw error;

      const clientMap: Record<string, ClientSummary> = {};
      for (const sale of sales || []) {
        const name = sale.client_name?.trim() || '';
        if (!name) continue;
        const key = name.toLowerCase();
        if (!clientMap[key]) {
          clientMap[key] = {
            name,
            phone: sale.customer_phone || '',
            totalOrders: 0,
            totalSpent: 0,
            totalOwed: 0,
            lastOrderDate: sale.date || '',
            locations: []
          };
        }
        clientMap[key].totalOrders += 1;
        clientMap[key].totalSpent += Number(sale.selling_price || 0);
        if (sale.payment_status === 'Unpaid') {
          clientMap[key].totalOwed += Number(sale.selling_price || 0);
        }
        if (sale.date && sale.date > clientMap[key].lastOrderDate) {
          clientMap[key].lastOrderDate = sale.date;
        }
        if (sale.customer_phone && !clientMap[key].phone) {
          clientMap[key].phone = sale.customer_phone;
        }
        if (sale.location && !clientMap[key].locations.includes(sale.location)) {
          clientMap[key].locations.push(sale.location);
        }
      }

      setClients(Object.values(clientMap));
    } catch (err: any) {
      toast.error('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClientSales = async (client: ClientSummary) => {
    setSelectedClient(client);
    setSalesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sales')
        .select('id, date, product_name, selling_price, payment_status, delivery_status, location, amount_owed_to_vendor')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .ilike('client_name', client.name)
        .order('date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setClientSales(data || []);
    } catch (err: any) {
      toast.error('Failed to load client history');
    } finally {
      setSalesLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  if (loading) return <LoadingScreen />;

  if (selectedClient) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <button
            onClick={() => { setSelectedClient(null); setClientSales([]); }}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{selectedClient.name}</h2>
              {selectedClient.phone && (
                <p className="text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-4 h-4" /> {selectedClient.phone}
                </p>
              )}
              {selectedClient.locations.length > 0 && (
                <p className="text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" /> {selectedClient.locations.join(', ')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{selectedClient.totalOrders}</p>
                <p className="text-xs text-gray-600">Orders</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-600">{formatCurrency(selectedClient.totalSpent)}</p>
                <p className="text-xs text-gray-600">Total Spent</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-600">{formatCurrency(selectedClient.totalOwed)}</p>
                <p className="text-xs text-gray-600">Owed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Purchase History</h3>
          {salesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : clientSales.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No purchase history found.</p>
          ) : (
            <div className="space-y-3">
              {clientSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{sale.product_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(sale.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {sale.location && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {sale.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{formatCurrency(sale.selling_price)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sale.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {sale.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Client Management</h2>
            <p className="text-gray-600">{clients.length} clients with purchase history</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone, or location..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="name">Name A-Z</option>
            <option value="orders">Most Orders</option>
            <option value="spent">Highest Spend</option>
          </select>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No clients found. Record sales with client names to build your client list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div
              key={client.name}
              onClick={() => loadClientSales(client)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{client.name}</h3>
                  {client.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {client.phone}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {client.totalOrders} orders
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Total Spent</p>
                  <p className="font-semibold text-green-600 text-sm">{formatCurrency(client.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Owed</p>
                  <p className={`font-semibold text-sm ${client.totalOwed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {client.totalOwed > 0 ? formatCurrency(client.totalOwed) : '-'}
                  </p>
                </div>
              </div>

              {client.lastOrderDate && (
                <p className="text-xs text-gray-400 mt-3">
                  Last order: {new Date(client.lastOrderDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientManagement;
