import React, { useEffect, useState } from 'react';
import { useFormErrors } from '../../hooks/useFormErrors';
import FieldError from '../ui/FieldError';
import { PartyPopper, Plus, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchEventSummaries, type ProjectSummary } from '../../services/projects/projectRollupService';
import { createProject, EVENT_TYPE_LABELS, type EventType } from '../../services/projects/projectService';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import { PageHeader, EmptyState, SkeletonList } from '../ui';
import EventDetail from './EventDetail';

/** Whole days from today to `dateStr` (negative if in the past), or null if unparseable. */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function eventCountdownLabel(dateStr: string | null): string | null {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  if (days === -1) return 'Yesterday';
  return `${Math.abs(days)} days ago`;
}

const EMPTY_FORM = { name: '', clientName: '', budget: '', eventType: '' as EventType | '', eventDate: '', guestCount: '', notes: '' };

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<ProjectSummary[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { errors, fail, field, formRef } = useFormErrors<'name'>();
  const [submitting, setSubmitting] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const refresh = () => { fetchEventSummaries().then(setEvents).catch(() => setEvents([])); };
  useEffect(refresh, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Give the event a name');
      return fail({ name: 'Give the event a name' });
    }
    try {
      setSubmitting(true);
      const created = await createProject({
        name: form.name.trim(),
        clientName: form.clientName.trim() || undefined,
        budget: form.budget ? toNum(form.budget) : undefined,
        notes: form.notes.trim() || undefined,
        kind: 'event',
        eventType: form.eventType || undefined,
        eventDate: form.eventDate || undefined,
        guestCount: form.guestCount ? Math.round(toNum(form.guestCount)) : undefined,
      });
      toast.success('Event added');
      setShowForm(false);
      setForm(EMPTY_FORM);
      refresh();
      setOpenEventId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add event');
    } finally {
      setSubmitting(false);
    }
  };

  if (events === null) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-52 skeleton-shimmer rounded-md" />
          <div className="h-4 w-80 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  const openEvent = openEventId ? events.find(e => e.id === openEventId) ?? null : null;
  if (openEvent) {
    return <EventDetail event={openEvent} onBack={() => setOpenEventId(null)} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PartyPopper}
        title="Events"
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Event'}
          </button>
        }
      >
        {showForm && (
          <form ref={formRef} noValidate onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input {...field('name')}
              type="text" placeholder="Event name (e.g. Amina & Peter's Wedding, Solfest 2027)" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <FieldError name="name" message={errors.name} />
            <input
              type="text" placeholder="Client name (optional)" value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="number" placeholder="Budget (optional)" value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={form.eventType}
              onChange={e => setForm(f => ({ ...f, eventType: e.target.value as EventType }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Event type (optional)</option>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(key => (
                <option key={key} value={key}>{EVENT_TYPE_LABELS[key]}</option>
              ))}
            </select>
            <input
              type="number" min="0" placeholder="Expected guests (optional)" value={form.guestCount}
              onChange={e => setForm(f => ({ ...f, guestCount: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <label className="sm:col-span-2 block text-xs font-medium text-gray-500 -mb-2">Event date</label>
            <input
              type="date" value={form.eventDate}
              onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <textarea
              placeholder="Notes (optional)" value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="submit" disabled={submitting}
              className="sm:col-span-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Saving…' : 'Save Event'}
            </button>
          </form>
        )}
      </PageHeader>

      {events.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No events yet."
          description="Add a wedding, festival, conference or function to plan its budget, tickets, guests, vendors, sponsors and checklist all in one place."
        />
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <button
              key={event.id}
              onClick={() => setOpenEventId(event.id)}
              className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-200 hover:shadow-md animate-slide-up"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{event.name}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium flex-shrink-0">
                      <PartyPopper className="w-3 h-3" />
                      {event.eventType ? EVENT_TYPE_LABELS[event.eventType] : 'Event'}
                    </span>
                  </div>
                  {event.clientName && <p className="text-xs text-gray-400 mt-0.5">{event.clientName}</p>}
                  {(event.eventDate || event.guestCount != null) && (
                    <p className="text-xs text-violet-600 mt-0.5 flex items-center gap-2 flex-wrap">
                      {event.eventDate && <span>{eventCountdownLabel(event.eventDate)} · {formatDate(event.eventDate)}</span>}
                      {event.guestCount != null && (
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {event.guestCount} guests</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-gray-100 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Budget</p>
                  <p className="font-medium tabular-nums">{event.budget != null ? formatCurrency(event.budget) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Sales</p>
                  <p className="font-medium tabular-nums text-green-600">{formatCurrency(event.salesTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Invoiced</p>
                  <p className="font-medium tabular-nums text-blue-600">{formatCurrency(event.invoicedTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Spent</p>
                  <p className="font-medium tabular-nums text-red-600">{formatCurrency(event.spentTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Remaining</p>
                  <p className={`font-medium tabular-nums ${event.remainingBudget != null && event.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {event.remainingBudget != null ? formatCurrency(event.remainingBudget) : '—'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
