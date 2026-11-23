import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Ticket, Plus, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import {
  listTicketTiers, addTicketTier, listTicketSalesByTier, recordTicketSale,
  TICKET_TYPE_OPTIONS, type TicketTier, type TicketSaleBatch,
} from '../../services/events/eventTicketService';

const EventTickets: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [tiers, setTiers] = useState<TicketTier[] | null>(null);
  const [salesByTier, setSalesByTier] = useState<Record<string, TicketSaleBatch[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [tierType, setTierType] = useState<string>('Regular');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [saleFormTierId, setSaleFormTierId] = useState<string | null>(null);
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [recordingSale, setRecordingSale] = useState(false);
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);

  const refresh = () => {
    listTicketTiers(projectId).then(setTiers).catch(() => setTiers([]));
    listTicketSalesByTier(projectId).then(setSalesByTier).catch(() => setSalesByTier({}));
  };
  useEffect(refresh, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || toNum(price) <= 0 || toNum(capacity) <= 0) {
      toast.error('Enter a name, a price above 0, and a capacity above 0');
      return;
    }
    setSubmitting(true);
    try {
      await addTicketTier({ projectId, name: name.trim(), price: toNum(price), capacity: Math.round(toNum(capacity)), tierType });
      toast.success('Ticket tier added');
      setName(''); setTierType('Regular'); setPrice(''); setCapacity(''); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that ticket tier');
    } finally {
      setSubmitting(false);
    }
  };

  const openSaleForm = (tier: TicketTier) => {
    setSaleFormTierId(tier.id);
    setSaleQty('');
    setSalePrice(String(tier.price));
  };

  const handleRecordSale = async (e: React.FormEvent, tier: TicketTier) => {
    e.preventDefault();
    const qty = Math.round(toNum(saleQty));
    const unitPrice = toNum(salePrice);
    if (qty <= 0) { toast.error('Enter how many tickets sold'); return; }
    if (unitPrice < 0) { toast.error('Price cannot be negative'); return; }
    setRecordingSale(true);
    try {
      await recordTicketSale({ projectId, itemId: tier.id, quantity: qty, unitPrice });
      toast.success(`Logged ${qty} ${tier.name} ticket${qty === 1 ? '' : 's'} sold`);
      setSaleFormTierId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record that sale');
    } finally {
      setRecordingSale(false);
    }
  };

  const soldCount = (tierName: string) => (salesByTier[tierName] ?? []).reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ticket tiers ({tiers?.length ?? 0})</p>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800"
        >
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add tier'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pb-3 border-b border-gray-100">
          <input type="text" placeholder="Tier name (e.g. VIP)" value={name} onChange={e => setName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={tierType} onChange={e => setTierType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {TICKET_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" min="0" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" min="1" placeholder="Capacity" value={capacity} onChange={e => setCapacity(e.target.value)}
            className="sm:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={submitting}
            className="sm:col-span-4 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save tier'}
          </button>
        </form>
      )}

      {!tiers ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : tiers.length === 0 ? (
        <p className="text-sm text-gray-400">No ticket tiers yet. Add one, then log sold batches here as they come in (Eventbrite, M-Pesa till, door cash, agents — whatever you actually used).</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tiers.map(t => {
            const sold = soldCount(t.name);
            const batches = salesByTier[t.name] ?? [];
            return (
              <li key={t.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <Ticket className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <span className="truncate font-medium">{t.name}</span>
                    {t.tierType && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[11px] font-semibold">{t.tierType}</span>
                    )}
                  </span>
                  <span className="text-right flex-shrink-0">
                    <span className="block font-medium tabular-nums">{formatCurrency(t.price)}</span>
                    <span className={`block text-xs ${t.remaining <= 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {sold} sold · {t.remaining <= 0 ? 'sold out' : `${t.remaining} left`}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-3 pl-6">
                  <button
                    onClick={() => (saleFormTierId === t.id ? setSaleFormTierId(null) : openSaleForm(t))}
                    className="text-xs font-medium text-violet-600 hover:text-violet-800"
                  >
                    {saleFormTierId === t.id ? 'Cancel' : 'Record sale'}
                  </button>
                  {batches.length > 0 && (
                    <button
                      onClick={() => setExpandedTierId(id => (id === t.id ? null : t.id))}
                      className="flex items-center gap-0.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      <Receipt className="w-3.5 h-3.5" /> {batches.length} batch{batches.length === 1 ? '' : 'es'}
                      {expandedTierId === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {saleFormTierId === t.id && (
                  <form onSubmit={e => handleRecordSale(e, t)} className="flex flex-wrap items-center gap-2 pl-6">
                    <input type="number" min="1" placeholder="Qty sold" value={saleQty} onChange={e => setSaleQty(e.target.value)}
                      className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" aria-label="Quantity sold" autoFocus />
                    <span className="text-xs text-gray-400">at</span>
                    <input type="number" min="0" placeholder="Price each" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                      className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" aria-label="Price per ticket" />
                    <button type="submit" disabled={recordingSale}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-medium rounded-lg">
                      {recordingSale ? 'Saving…' : 'Log it'}
                    </button>
                  </form>
                )}

                {expandedTierId === t.id && batches.length > 0 && (
                  <ul className="pl-6 space-y-1">
                    {batches.map(b => (
                      <li key={b.id} className="flex items-center justify-between text-xs text-gray-500">
                        <span>{b.quantity} tickets · {formatCurrency(b.unitPrice)} each</span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">{formatCurrency(b.subtotal)}</span>
                          <span>{formatDate(b.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default EventTickets;
