import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Ticket, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { toNum } from '../../utils/number';
import { listTicketTiers, addTicketTier, type TicketTier } from '../../services/events/eventTicketService';

const EventTickets: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [tiers, setTiers] = useState<TicketTier[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listTicketTiers(projectId).then(setTiers).catch(() => setTiers([])); };
  useEffect(refresh, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || toNum(price) <= 0 || toNum(capacity) <= 0) {
      toast.error('Enter a name, a price above 0, and a capacity above 0');
      return;
    }
    setSubmitting(true);
    try {
      await addTicketTier({ projectId, name: name.trim(), price: toNum(price), capacity: Math.round(toNum(capacity)) });
      toast.success('Ticket tier added');
      setName(''); setPrice(''); setCapacity(''); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that ticket tier');
    } finally {
      setSubmitting(false);
    }
  };

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
          <input type="number" min="0" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" min="1" placeholder="Capacity" value={capacity} onChange={e => setCapacity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={submitting}
            className="sm:col-span-4 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save tier'}
          </button>
        </form>
      )}

      {!tiers ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : tiers.length === 0 ? (
        <p className="text-sm text-gray-400">No ticket tiers yet. Each tier is a product — sell it through the normal Sales flow, picking this event, to decrement its remaining capacity.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tiers.map(t => (
            <li key={t.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Ticket className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span className="truncate font-medium">{t.name}</span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className="block font-medium tabular-nums">{formatCurrency(t.price)}</span>
                <span className={`block text-xs ${t.remaining <= 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {t.remaining <= 0 ? 'Sold out' : `${t.remaining} left`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventTickets;
