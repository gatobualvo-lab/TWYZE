import React, { useState, useEffect } from 'react';
import { Truck, AlertTriangle, CheckCircle, CheckCircle2, Calendar, MapPin, Package } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import LoadingScreen from '../LoadingScreen';
import toast from 'react-hot-toast';

interface DeliveryGuyPayment {
  name: string;
  totalOwed: number;
  totalPaid: number;
  balanceDue: number;
  transactionCount: number;
  transactions: DeliveryTransaction[];
}

interface DeliveryTransaction {
  id: string;
  date: string;
  product_name: string;
  location: string;
  delivery_fee: number;
  delivery_fee_paid: boolean;
}

const DeliveryPayments: React.FC = () => {
  const [deliveryPayments, setDeliveryPayments] = useState<DeliveryGuyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeliveryGuy, setExpandedDeliveryGuy] = useState<string | null>(null);
  // Replaces window.confirm() — confirm()/alert() weren't reliably showing
  // anything in the packaged Electron shell, so a click would silently
  // no-op with no dialog and no error. An in-app arm-then-confirm step
  // needs no native API at all (same fix as VendorTransactions.tsx).
  const [pendingMarkAllPaidGuy, setPendingMarkAllPaidGuy] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliveryData();
  }, []);

  const fetchDeliveryData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to view payment management');
        return;
      }

      // Fetch sales data for delivery guy payments
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, delivery_guy, delivery_fee, delivery_fee_paid, date, product_name, location')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false);
      
      // Process delivery guy payments
      const deliveryMap: { [key: string]: DeliveryGuyPayment } = {};
      salesData?.forEach(sale => {
        if (sale.delivery_guy) {
          if (!deliveryMap[sale.delivery_guy]) {
            deliveryMap[sale.delivery_guy] = {
              name: sale.delivery_guy,
              totalOwed: 0,
              totalPaid: 0,
              balanceDue: 0,
              transactionCount: 0,
              transactions: []
            };
          }
          
          deliveryMap[sale.delivery_guy].transactionCount++;
          deliveryMap[sale.delivery_guy].transactions.push({
            id: sale.id,
            date: sale.date,
            product_name: sale.product_name,
            location: sale.location,
            delivery_fee: sale.delivery_fee,
            delivery_fee_paid: sale.delivery_fee_paid
          });
          
          if (sale.delivery_fee_paid) {
            deliveryMap[sale.delivery_guy].totalPaid += sale.delivery_fee;
          } else {
            deliveryMap[sale.delivery_guy].totalOwed += sale.delivery_fee;
          }
          deliveryMap[sale.delivery_guy].balanceDue = 
            deliveryMap[sale.delivery_guy].totalOwed - deliveryMap[sale.delivery_guy].totalPaid;
        }
      });

      setDeliveryPayments(Object.values(deliveryMap).sort((a, b) => b.balanceDue - a.balanceDue));

    } catch (error: any) {
      console.error('Error fetching delivery payment data:', error);
      toast.error(error.message || 'Failed to load delivery payment data');
    } finally {
      setLoading(false);
    }
  };

  const markAllDeliveryPaid = async (deliveryGuy: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('sales')
        .update({ delivery_fee_paid: true })
        .eq('user_id', user.id)
        .eq('delivery_guy', deliveryGuy)
        .eq('delivery_fee_paid', false);

      if (error) throw error;

      toast.success(`All delivery fees for ${deliveryGuy} marked as paid`);
      fetchDeliveryData();
    } catch (error: any) {
      console.error('Error updating delivery payments:', error);
      toast.error('Failed to update delivery payments');
    } finally {
      setPendingMarkAllPaidGuy(null);
    }
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
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-blue-100">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>
              Delivery Guy Payments
            </h2>
            <p className="text-gray-600">Track and manage delivery fee payments</p>
          </div>
        </div>
      </div>

      {/* Delivery Guy Payments */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        {deliveryPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No delivery payment data found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryPayments.map((delivery) => (
              <div key={delivery.name} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800" style={{ color: '#374151' }}>{delivery.name}</h4>
                  <div className="flex items-center gap-2">
                    {delivery.balanceDue > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    <button
                      onClick={() => setExpandedDeliveryGuy(expandedDeliveryGuy === delivery.name ? null : delivery.name)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {expandedDeliveryGuy === delivery.name ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Owed:</span>
                    <span className="font-medium text-red-600">{formatCurrency(delivery.totalOwed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium text-green-600">{formatCurrency(delivery.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Balance Due:</span>
                    <span className={`font-bold ${delivery.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(delivery.balanceDue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transactions:</span>
                    <span className="font-medium">{delivery.transactionCount}</span>
                  </div>
                </div>

                {delivery.balanceDue > 0 && (
                  pendingMarkAllPaidGuy === delivery.name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 flex-1">Mark all paid?</span>
                      <button
                        onClick={() => markAllDeliveryPaid(delivery.name)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Yes, confirm
                      </button>
                      <button
                        onClick={() => setPendingMarkAllPaidGuy(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingMarkAllPaidGuy(delivery.name)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark All Paid
                    </button>
                  )
                )}

                {/* Expanded Transaction Details */}
                {expandedDeliveryGuy === delivery.name && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="font-medium text-gray-800 mb-2">Transaction Details</h5>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {delivery.transactions.map(transaction => (
                        <div 
                          key={transaction.id} 
                          className={`p-3 rounded-lg text-sm ${
                            transaction.delivery_fee_paid ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-700">{formatDate(transaction.date)}</span>
                            </div>
                            <span className={`font-medium ${
                              transaction.delivery_fee_paid ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(transaction.delivery_fee)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <Package className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700">{transaction.product_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700">{transaction.location}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryPayments;