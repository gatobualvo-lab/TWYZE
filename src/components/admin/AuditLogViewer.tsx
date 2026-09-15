import React, { useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ScrollText, User } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';
import { listAuditLog } from '../../services/admin/adminService';
import type { AuditLogEntry } from '../../services/admin/adminService';

const TABLE_OPTIONS = ['all', 'sales', 'payment_submissions', 'profiles', 'feature_flags'];
const PAGE_SIZE = 20;

const formatDateTime = (value: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const actionBadgeClass = (action: string) => {
  if (action.startsWith('delete')) return 'bg-red-100 text-red-800';
  if (action.startsWith('approve') || action.startsWith('activate')) return 'bg-green-100 text-green-800';
  if (action.startsWith('reject') || action.startsWith('suspend')) return 'bg-orange-100 text-orange-800';
  return 'bg-blue-100 text-blue-800';
};

const AuditLogViewer: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [tableFilter, page]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const result = await listAuditLog({ tableName: tableFilter, page, pageSize: PAGE_SIZE });
      setEntries(result.entries);
      setTotal(result.total);
    } catch (error: any) {
      console.error('Error fetching audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const displayedEntries = search
    ? entries.filter(e =>
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        (e.userName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.userEmail ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading && entries.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Filter by action, user name, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="w-full md:w-56">
          <select
            value={tableFilter}
            onChange={e => { setTableFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TABLE_OPTIONS.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All tables' : t}</option>
            ))}
          </select>
        </div>
      </div>

      {displayedEntries.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No audit log entries found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {displayedEntries.map(entry => {
            const expanded = expandedId === entry.id;
            const hasDetail = entry.oldData != null || entry.newData != null;
            return (
              <div key={entry.id}>
                <button
                  onClick={() => hasDetail && setExpandedId(expanded ? null : entry.id)}
                  className={`w-full flex items-center justify-between gap-4 px-4 py-3 text-left ${hasDetail ? 'hover:bg-gray-50' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${actionBadgeClass(entry.action)}`}>
                          {entry.action}
                        </span>
                        {entry.tableName && (
                          <span className="text-xs text-gray-400">{entry.tableName}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {entry.userName || entry.userEmail || 'System'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</span>
                    {hasDetail && (expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
                  </div>
                </button>
                {expanded && hasDetail && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {entry.oldData != null && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Before</p>
                        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-40">
                          {JSON.stringify(entry.oldData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.newData != null && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">After</p>
                        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-40">
                          {JSON.stringify(entry.newData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>{' '}
            ({total} entries)
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
