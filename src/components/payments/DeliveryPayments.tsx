import { formatCurrency as formatAccountCurrency } from '../../utils/format';
import React, { useState, useEffect, useMemo } from 'react';
import { Truck, AlertTriangle, CheckCircle, CheckCircle2, Calendar, MapPin, Package } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import LoadingScreen from '../LoadingScreen';
import PeriodPicker from '../ui/PeriodPicker';
import toast from 'react-hot-toast';
import { periodFor, describePeriod, type Period } from '../../utils/period';
import { summarizeDeliveries, type DeliverySaleRow } from '../../services/payments/deliverySummary';

const DeliveryPayments: React.FC = () => {
  const [rows, setRows] = useState<DeliverySaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(() => periodFor('all'));
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

      // Every delivery is loaded once; the period picker then filters in memory, so changing
      // the period is instant.
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('id, delivery_guy, delivery_fee, delivery_fee_paid, date, product_name, location')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .not('delivery_guy', 'is', null)
        .range(0, 49999);
      if (error) throw error;

      setRows((salesData || []) as DeliverySaleRow[]);
    } catch (error: any) {
      console.error('Error fetching delivery payment data:', error);
      toast.error(error.message || 'Failed to load delivery payment data');
    } finally {
      setLoading(false);
    }
  };

  const { guys: deliveryPayments, totals } = useMemo(() => summarizeDeliveries(rows, period), [rows, period]);

  // Marks only what is shown for the chosen period, so "Mark all paid" on October never
  // quietly settles September as well.
  const markAllDeliveryPaid = async (deliveryGuy: string) => {
    try {
      const guy = deliveryPayments.find(g => g.name === deliveryGuy);
      const ids = (guy?.transactions ?? []).filter(t => !t.delivery_fee_paid).map(t => t.id);
      if (ids.length === 0) return;

      const { error } = await supabase
        .from('sales')
        .update({ delivery_fee_paid: true })
        .in('id', ids);

      if (error) throw error;

      toast.success(`${ids.length} delivery fee${ids.length === 1 ? '' : 's'} for ${deliveryGuy} marked as paid`);
      fetchDeliveryData();
    } catch (error: any) {
      console.error('Error updating delivery payments:', error);
      toast.error('Failed to update delivery payments');
    } finally {
      setPendingMarkAllPaidGuy(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatAccountCurrency(amount);
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

  const periodText = describePeriod(period);
  const summary: Array<{ label: string; value: string; tone: string }> = [
    { label: 'Deliveries', value: String(totals.count), tone: 'text-gray-800' },
    { label: 'Total fees', value: formatCurrency(totals.fees), tone: 'text-gray-800' },
    { label: 'Paid', value: formatCurrency(totals.paid), tone: 'text-green-600' },
    { label: 'Still owed', value: formatCurrency(totals.owed), tone: totals.owed > 0 ? 'text-red-600' : 'text-green-600' },
  ];

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

      {/* Period and its totals */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5" aria-label={`Delivery totals for ${periodText}`}>
          {summary.map(item => (
            <div key={item.label} className="rounded-lg bg-gray-50 border border-gray-100 p-3 min-w-0">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className={`text-lg font-bold truncate ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Guy Payments */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        {deliveryPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {rows.length === 0 ? 'No delivery payment data found' : `No deliveries in this period (${periodText})`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryPayments.map((delivery) => (
              <div key={delivery.name} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800 truncate" style={{ color: '#374151' }}>{delivery.name}</h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {delivery.balanceDue > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Fees still owed" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" aria-label="All paid" />
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
                    <span className="text-gray-600">Total fees:</span>
                    <span className="font-medium">{formatCurrency(delivery.totalOwed + delivery.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paid:</span>
                    <span className="font-medium text-green-600">{formatCurrency(delivery.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Balance due:</span>
                    <span className={`font-bold ${delivery.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(delivery.balanceDue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deliveries:</span>
                    <span className="font-medium">{delivery.transactionCount}</span>
                  </div>
                </div>

                {delivery.balanceDue > 0 && (
                  pendingMarkAllPaidGuy === delivery.name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 flex-1">Mark {periodText.toLowerCase()} as paid?</span>
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
                      {period.start || period.end ? 'Mark Period Paid' : 'Mark All Paid'}
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
                              <span className="sr-only">{transaction.delivery_fee_paid ? ' (paid)' : ' (unpaid)'}</span>
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
