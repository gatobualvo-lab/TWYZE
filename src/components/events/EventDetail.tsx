import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, PartyPopper, Users, FileText, Receipt, Check, X, Trash2, Archive, CheckCircle2, Ticket,
  ListChecks, Clock, Landmark, Megaphone, Wallet, Plus, TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';
import { EVENT_TYPE_LABELS, updateProjectStatus, deleteProject } from '../../services/projects/projectService';
import type { ProjectSummary } from '../../services/projects/projectRollupService';
import { fetchProjectContents, type ProjectContents } from '../../services/projects/projectContentsService';
import { eventCountdownLabel } from './EventsPage';
import EventTickets from './EventTickets';
import EventGuests from './EventGuests';
import EventChecklist from './EventChecklist';
import EventVendors from './EventVendors';
import EventSponsors from './EventSponsors';
import EventExpenses from './EventExpenses';
import EventPnL from './EventPnL';
import DocumentForm from '../documents/DocumentForm';

type Tab = 'overview' | 'pnl' | 'tickets' | 'guests' | 'checklist' | 'runofshow' | 'vendors' | 'expenses' | 'sponsors' | 'documents';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: PartyPopper },
  { id: 'pnl', label: 'P&L', icon: TrendingUp },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'checklist', label: 'Checklist', icon: ListChecks },
  { id: 'runofshow', label: 'Run of Show', icon: Clock },
  { id: 'vendors', label: 'Vendors', icon: Landmark },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'sponsors', label: 'Sponsors', icon: Megaphone },
  { id: 'documents', label: 'Documents', icon: FileText },
];

interface EventDetailProps {
  event: ProjectSummary;
  onBack: () => void;
  onChanged: () => void;
}

const EventDetail: React.FC<EventDetailProps> = ({ event, onBack, onChanged }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [contents, setContents] = useState<ProjectContents | null>(null);
  const [creatingDocType, setCreatingDocType] = useState<'invoice' | 'quotation' | null>(null);

  const refreshContents = () => {
    fetchProjectContents(event.id).then(setContents).catch(() => toast.error('Could not load this event'));
  };
  useEffect(refreshContents, [event.id]);

  const handleToggleStatus = async () => {
    const nextStatus = event.status === 'completed' ? 'active' : 'completed';
    try {
      await updateProjectStatus(event.id, nextStatus);
      onChanged();
    } catch {
      toast.error('Failed to update event');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(event.id);
      toast.success('Event deleted');
      onChanged();
      onBack();
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setPendingDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 truncate">{event.name}</h2>
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
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {event.guestCount} expected</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleToggleStatus}
              className="text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-90"
              aria-label={event.status === 'completed' ? 'Mark active' : 'Mark completed'}
              title={event.status === 'completed' ? 'Mark active' : 'Mark completed'}
            >
              {event.status === 'completed' ? <Archive className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </button>
            {pendingDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete} className="text-red-500 hover:text-red-700" aria-label="Confirm delete">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setPendingDelete(false)} className="text-gray-300 hover:text-gray-500" aria-label="Cancel">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => setPendingDelete(true)} className="text-gray-300 hover:text-red-500" aria-label="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
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
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              tab === t.id ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">
            Use the tabs above to manage this event's tickets, guest list, checklist, run-of-show schedule, vendor
            payments, sponsors and documents.
          </p>
          {event.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'pnl' && <EventPnL event={event} contents={contents} />}
      {tab === 'tickets' && <EventTickets projectId={event.id} />}
      {tab === 'guests' && <EventGuests projectId={event.id} />}
      {(tab === 'checklist' || tab === 'runofshow') && (
        <EventChecklist projectId={event.id} eventDate={event.eventDate} mode={tab === 'checklist' ? 'checklist' : 'runOfShow'} />
      )}
      {tab === 'vendors' && <EventVendors projectId={event.id} />}
      {tab === 'expenses' && <EventExpenses projectId={event.id} />}
      {tab === 'sponsors' && <EventSponsors projectId={event.id} />}

      {tab === 'documents' && (
        creatingDocType ? (
          <DocumentForm
            documentType={creatingDocType}
            lockProjectId={event.id}
            onSave={() => { setCreatingDocType(null); refreshContents(); }}
            onCancel={() => setCreatingDocType(null)}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Documents ({contents?.documents.length ?? 0})
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setCreatingDocType('quotation')} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
                  <Plus className="w-4 h-4" /> New quotation
                </button>
                <button onClick={() => setCreatingDocType('invoice')} className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800">
                  <Plus className="w-4 h-4" /> New invoice
                </button>
              </div>
            </div>
            {!contents ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : contents.documents.length === 0 ? (
              <p className="text-sm text-gray-400">No invoices or quotations yet. Create one above (e.g. a sponsor invoice).</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {contents.documents.map(d => (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <Receipt className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate"><span className="font-medium">{d.number}</span> <span className="text-gray-400 capitalize">{d.type}{d.customer ? ` · ${d.customer}` : ''}</span></span>
                    </span>
                    <span className="text-right flex-shrink-0">
                      <span className="block font-medium tabular-nums">{formatCurrency(d.total)}</span>
                      <span className="block text-xs text-gray-400">{formatDate(d.date)}{d.status ? ` · ${d.status}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default EventDetail;
