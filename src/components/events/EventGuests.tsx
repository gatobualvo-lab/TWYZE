import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Plus } from 'lucide-react';
import { listGuests, addGuest, updateRsvp, deleteGuest, RSVP_LABELS, type EventGuest, type RsvpStatus } from '../../services/events/eventGuestService';

const STATUS_STYLE: Record<RsvpStatus, string> = {
  invited: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-600',
  attended: 'bg-green-100 text-green-700',
};

const EventGuests: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [guests, setGuests] = useState<EventGuest[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listGuests(projectId).then(setGuests).catch(() => setGuests([])); };
  useEffect(refresh, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Enter the guest\'s name'); return; }
    setSubmitting(true);
    try {
      await addGuest({ projectId, name: name.trim(), phone: phone.trim() || undefined, partySize: Number(partySize) || 1 });
      setName(''); setPhone(''); setPartySize('1'); setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that guest');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (guest: EventGuest, status: RsvpStatus) => {
    setGuests(prev => prev && prev.map(g => (g.id === guest.id ? { ...g, rsvpStatus: status } : g)));
    try {
      await updateRsvp(guest.id, status);
    } catch {
      toast.error('Could not update RSVP');
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGuest(id);
      refresh();
    } catch {
      toast.error('Could not remove that guest');
    }
  };

  const totalGuests = (guests ?? []).reduce((sum, g) => sum + g.partySize, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Guests ({guests?.length ?? 0}{guests && guests.length > 0 ? ` · ${totalGuests} total` : ''})
        </p>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add guest'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pb-3 border-b border-gray-100">
          <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="tel" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" min="1" placeholder="Party size" value={partySize} onChange={e => setPartySize(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={submitting}
            className="sm:col-span-4 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Saving…' : 'Save guest'}
          </button>
        </form>
      )}

      {!guests ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : guests.length === 0 ? (
        <p className="text-sm text-gray-400">No guests yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {guests.map(g => (
            <li key={g.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span className="truncate">
                  <span className="font-medium">{g.name}</span>
                  {g.partySize > 1 && <span className="text-gray-400"> · party of {g.partySize}</span>}
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={g.rsvpStatus}
                  onChange={e => handleStatusChange(g, e.target.value as RsvpStatus)}
                  className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${STATUS_STYLE[g.rsvpStatus]}`}
                >
                  {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map(s => (
                    <option key={s} value={s}>{RSVP_LABELS[s]}</option>
                  ))}
                </select>
                <button onClick={() => handleDelete(g.id)} className="text-gray-300 hover:text-red-500 text-xs">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventGuests;
