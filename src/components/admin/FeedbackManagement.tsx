import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Bug, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';
import { listFeedback, updateFeedbackStatus } from '../../services/admin/adminService';
import type { AdminFeedbackEntry, FeedbackCategory, FeedbackStatus } from '../../services/admin/adminService';

const CATEGORY_META: Record<FeedbackCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  feature: { label: 'Feature idea', icon: Lightbulb },
  bug: { label: 'Bug report', icon: Bug },
  general: { label: 'General', icon: MessageSquare },
};

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'reviewing', 'planned', 'done', 'declined'];

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-gray-100 text-gray-700 border-gray-200',
  reviewing: 'bg-blue-100 text-blue-700 border-blue-200',
  planned: 'bg-amber-100 text-amber-700 border-amber-200',
  done: 'bg-green-100 text-green-700 border-green-200',
  declined: 'bg-red-100 text-red-600 border-red-200',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Received',
  reviewing: 'Being reviewed',
  planned: 'Planned',
  done: 'Done',
  declined: "Won't do",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const FeedbackManagement: React.FC = () => {
  const [entries, setEntries] = useState<AdminFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setEntries(await listFeedback());
    } catch (error: any) {
      console.error('Error loading feedback:', error);
      toast.error(error.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    const previous = entries;
    setSavingId(id);
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, status } : e)));
    try {
      await updateFeedbackStatus(id, status);
    } catch (error: any) {
      console.error('Error updating feedback status:', error);
      toast.error(error.message || 'Failed to update status');
      setEntries(previous);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(
    () => entries.filter(e =>
      (categoryFilter === 'all' || e.category === categoryFilter) &&
      (statusFilter === 'all' || e.status === statusFilter)
    ),
    [entries, categoryFilter, statusFilter]
  );

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Feature Feedback</h2>
        <p className="text-sm text-slate-600">{entries.length} submission{entries.length === 1 ? '' : 's'} from the "Suggest a Feature" page.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | FeedbackCategory)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All types</option>
          {(Object.keys(CATEGORY_META) as FeedbackCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORY_META[c].label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | FeedbackStatus)}
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
          No feedback matches these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const { icon: Icon, label } = CATEGORY_META[entry.category];
            return (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                        <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{entry.message}</p>
                      <p className="text-xs text-slate-400 mt-1.5">
                        {entry.userName || 'Unknown'}{entry.userEmail ? ` · ${entry.userEmail}` : ''}
                      </p>
                    </div>
                  </div>
                  <select
                    value={entry.status}
                    disabled={savingId === entry.id}
                    onChange={(e) => handleStatusChange(entry.id, e.target.value as FeedbackStatus)}
                    className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full border disabled:opacity-50 ${STATUS_STYLE[entry.status]}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;
