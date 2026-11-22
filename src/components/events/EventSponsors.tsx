import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Plus, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { toNum } from '../../utils/number';
import { listSponsors, addSponsor, setSponsorFulfilled, deleteSponsor, type EventSponsor } from '../../services/events/eventSponsorService';

const EventSponsors: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [sponsors, setSponsors] = useState<EventSponsor[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [packageLabel, setPackageLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listSponsors(projectId).then(setSponsors).catch(() => setSponsors([])); };
  useEffect(refresh, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim()) { toast.error('Enter the sponsor\'s name'); return; }
    setSubmitting(true);
    try {
      await addSponsor({
        projectId,
        sponsorName: sponsorName.trim(),
        packageLabel: packageLabel.trim() || undefined,
        amount: amount ? toNum(amount) : undefined,
        deliverables: deliverables.trim() || undefined,
      });
      setSponsorName(''); setPackageLabel(''); setAmount(''); setDeliverables(''); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that sponsor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFulfilled = async (sponsor: EventSponsor) => {
    setSponsors(prev => prev && prev.map(s => (s.id === sponsor.id ? { ...s, fulfilled: !s.fulfilled } : s)));
    try {
      await setSponsorFulfilled(sponsor.id, !sponsor.fulfilled);
    } catch {
      toast.error('Could not update that sponsor');
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSponsor(id);
      refresh();
    } catch {
      toast.error('Could not remove that sponsor');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5" /> Sponsors ({sponsors?.length ?? 0})
        </p>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add sponsor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3 border-b border-gray-100">
          <input type="text" placeholder="Sponsor name" value={sponsorName} onChange={e => setSponsorName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="Package (e.g. Gold)" value={packageLabel} onChange={e => setPackageLabel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" min="0" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="Deliverables owed (e.g. logo on stage, 10 tickets)" value={deliverables} onChange={e => setDeliverables(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={submitting}
            className="sm:col-span-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save sponsor'}
          </button>
        </form>
      )}

      {!sponsors ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : sponsors.length === 0 ? (
        <p className="text-sm text-gray-400">No sponsors yet. Invoice a sponsor's payment as a Document and pick this event, so it counts in Invoiced above.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sponsors.map(s => (
            <li key={s.id} className="py-2 flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate">
                  <span className="font-medium">{s.sponsorName}</span>
                  {s.packageLabel && <span className="text-gray-400"> · {s.packageLabel}</span>}
                </span>
                {s.deliverables && <span className="block text-xs text-gray-500 mt-0.5">{s.deliverables}</span>}
              </span>
              <span className="flex items-center gap-3 flex-shrink-0">
                {s.amount != null && <span className="font-medium tabular-nums">{formatCurrency(s.amount)}</span>}
                <button
                  onClick={() => handleToggleFulfilled(s)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${s.fulfilled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {s.fulfilled && <Check className="w-3 h-3" />} {s.fulfilled ? 'Fulfilled' : 'Pending'}
                </button>
                <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-500 text-xs">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventSponsors;
