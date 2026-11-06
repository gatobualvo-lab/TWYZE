import React, { useEffect, useMemo, useState } from 'react';
import { LifeBuoy, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';
import { listSupportRequests, updateSupportRequestStatus } from '../../services/admin/adminService';
import type { AdminSupportRequestEntry, SupportRequestStatus } from '../../services/admin/adminService';

const STATUS_OPTIONS: SupportRequestStatus[] = ['new', 'in_progress', 'resolved'];

const STATUS_STYLE: Record<SupportRequestStatus, string> = {
  new: 'bg-gray-100 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const SupportRequests: React.FC = () => {
  const [entries, setEntries] = useState<AdminSupportRequestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | SupportRequestStatus>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setEntries(await listSupportRequests());
    } catch (error: any) {
      console.error('Error loading support requests:', error);
      toast.error(error.message || 'Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: SupportRequestStatus) => {
    const previous = entries;
    setSavingId(id);
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, status } : e)));
    try {
      await updateSupportRequestStatus(id, status);
    } catch (error: any) {
      console.error('Error updating support request status:', error);
      toast.error(error.message || 'Failed to update status');
      setEntries(previous);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(
    () => entries.filter(e => statusFilter === 'all' || e.status === statusFilter),
    [entries, statusFilter]
  );

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Support Requests</h2>
        <p className="text-sm text-slate-600">{entries.length} report{entries.length === 1 ? '' : 's'} from the Guide's "Report a problem" form.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | SupportRequestStatus)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          No support requests match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <LifeBuoy className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
                      {entry.page && <span className="text-xs text-slate-400">· {entry.page}</span>}
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{entry.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="text-xs text-slate-400">
                        {entry.userName || 'Unknown'}{entry.userEmail ? ` · ${entry.userEmail}` : ''}
                      </p>
                      {entry.userEmail && (
                        <a
                          href={`mailto:${entry.userEmail}?subject=${encodeURIComponent('Re: your TrackWyze support request')}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                        >
                          <Mail className="w-3 h-3" /> Reply by email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <select
                  value={entry.status}
                  disabled={savingId === entry.id}
                  onChange={(e) => handleStatusChange(entry.id, e.target.value as SupportRequestStatus)}
                  className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full border disabled:opacity-50 ${STATUS_STYLE[entry.status]}`}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportRequests;
