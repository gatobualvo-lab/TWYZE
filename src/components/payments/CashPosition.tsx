import React, { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Truck, User } from 'lucide-react';
import { PageHeader, Card, StatCard, EmptyState, SkeletonPage } from '../ui';
import { formatCurrency } from '../../utils/format';
import { fetchCashPosition, type CashPositionData } from '../../services/cashPosition/cashPositionService';

const CashPosition: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<CashPositionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCashPosition()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <SkeletonPage />;

  const totalPayables = data.vendorBalances.reduce((s, v) => s + v.balance, 0) + data.deliveryBalances.reduce((s, d) => s + d.balance, 0);
  const netPosition = data.outstandingReceivables - totalPayables;
  const hasAnyBalances = data.vendorBalances.length > 0 || data.deliveryBalances.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        iconColor="text-orange-600"
        title="Cash Position"
        description="Who owes you, who you owe, and where you stand — pulled together from customers, vendors, and delivery balances in one place."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Owed to you"
          value={formatCurrency(data.outstandingReceivables)}
          sublabel="From customers"
        />
        <StatCard
          icon={TrendingDown}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          label="You owe vendors"
          value={formatCurrency(data.vendorBalances.reduce((s, v) => s + v.balance, 0))}
          sublabel={`${data.vendorBalances.length} vendor${data.vendorBalances.length === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Truck}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          label="You owe delivery"
          value={formatCurrency(data.deliveryBalances.reduce((s, d) => s + d.balance, 0))}
          sublabel={`${data.deliveryBalances.length} deliverer${data.deliveryBalances.length === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Wallet}
          iconBg={netPosition >= 0 ? 'bg-green-100' : 'bg-red-100'}
          iconColor={netPosition >= 0 ? 'text-green-600' : 'text-red-600'}
          label="Net position"
          value={formatCurrency(netPosition)}
          sublabel={netPosition >= 0 ? "You're net owed" : 'You owe more than owed'}
        />
      </div>

      {data.unpaidInvoiceCount > 0 && (
        <Card className="bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-800">
            You also have <span className="font-semibold">{data.unpaidInvoiceCount} unpaid invoice{data.unpaidInvoiceCount === 1 ? '' : 's'}</span> totaling{' '}
            <span className="font-semibold">{formatCurrency(data.unpaidInvoiceTotal)}</span> — not yet counted in "Owed to you" above (that figure covers sales, not invoiced documents).{' '}
            {onNavigate && (
              <button onClick={() => onNavigate('documents-invoices')} className="underline font-medium hover:text-blue-900">
                View invoices
              </button>
            )}
          </p>
        </Card>
      )}

      {!hasAnyBalances ? (
        <EmptyState icon={Wallet} title="No outstanding vendor or delivery balances" description="You're all caught up on what you owe." tone="positive" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.vendorBalances.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <User className="w-4 h-4 text-red-500" />
                Vendors you owe
              </h3>
              <div className="space-y-2">
                {data.vendorBalances.map(v => (
                  <div key={v.vendorName} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{v.vendorName}</span>
                    <span className="font-semibold text-red-600 tabular-nums">{formatCurrency(v.balance)}</span>
                  </div>
                ))}
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate('vendor-transactions')} className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800">
                  Go to Vendor Transactions →
                </button>
              )}
            </Card>
          )}

          {data.deliveryBalances.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-500" />
                Delivery guys you owe
              </h3>
              <div className="space-y-2">
                {data.deliveryBalances.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{d.name}</span>
                    <span className="font-semibold text-amber-600 tabular-nums">{formatCurrency(d.balance)}</span>
                  </div>
                ))}
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate('delivery-payments')} className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800">
                  Go to Delivery Payments →
                </button>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CashPosition;
