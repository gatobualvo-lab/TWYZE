import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Lightbulb, Trophy, Check, Archive, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listNotifications, markRead, markAllRead, archiveNotification,
} from '../../services/notifications/notificationService';
import type { AppNotification, NotificationPriority } from '../../services/notifications/notificationService';
import { getPreferences, updatePreferences } from '../../services/notifications/notificationPreferencesService';
import type { NotificationPreferences } from '../../services/notifications/notificationPreferencesService';
import { formatDate } from '../../utils/format';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

interface NotificationCenterProps {
  onNavigate: (tab: string) => void;
}

type FilterTab = 'unread' | 'all' | 'archived';

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  opportunity: { icon: Lightbulb, label: 'Opportunities' },
  goal_at_risk: { icon: Trophy, label: 'Goal Progress' },
};

const PRIORITY_STYLE: Record<NotificationPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const PRIORITY_RANK: Record<NotificationPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const KNOWN_TYPES = Object.keys(TYPE_META);

const NotificationRow: React.FC<{
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onArchive: (id: string) => void;
  showArchive: boolean;
}> = ({ notification, onOpen, onArchive, showArchive }) => {
  const meta = TYPE_META[notification.type] ?? { icon: Bell, label: notification.type };
  const Icon = meta.icon;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:shadow-sm animate-slide-up ${notification.isRead ? 'border-gray-100' : 'border-blue-100 bg-blue-50/40'}`}>
      <span className="mt-0.5 h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </span>
      <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(notification)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${notification.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{notification.title}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_STYLE[notification.priority]}`}>
            {notification.priority}
          </span>
        </div>
        {notification.body && <p className="text-xs text-gray-500 mt-0.5">{notification.body}</p>}
        <p className="text-xs text-gray-400 mt-1">{formatDate(notification.createdAt, { month: 'short', day: 'numeric' })} · {meta.label}</p>
      </button>
      {showArchive && (
        <button onClick={() => onArchive(notification.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors active:scale-90" aria-label="Archive">
          <Archive className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const PreferencesPanel: React.FC<{ prefs: NotificationPreferences; onChange: (p: NotificationPreferences) => void; onClose: () => void }> = ({
  prefs, onChange, onClose,
}) => {
  const toggleType = (type: string) => {
    const muted = prefs.mutedTypes.includes(type) ? prefs.mutedTypes.filter(t => t !== type) : [...prefs.mutedTypes, type];
    onChange({ ...prefs, mutedTypes: muted });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">Notification Settings</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors" aria-label="Close settings"><X className="w-4 h-4" /></button>
      </div>

      <p className="text-xs text-gray-500 mb-2">Minimum priority to notify about</p>
      <select
        value={prefs.minPriority}
        onChange={e => onChange({ ...prefs, minPriority: e.target.value as NotificationPriority })}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4"
      >
        <option value="low">Low and above (everything)</option>
        <option value="medium">Medium and above</option>
        <option value="high">High and above</option>
        <option value="critical">Critical only</option>
      </select>

      <label className="flex items-center justify-between gap-2 cursor-pointer mb-4">
        <span className="text-sm text-gray-700">Email me about important alerts</span>
        <input
          type="checkbox"
          checked={prefs.emailEnabled}
          onChange={() => onChange({ ...prefs, emailEnabled: !prefs.emailEnabled })}
          className="w-4 h-4"
        />
      </label>

      <p className="text-xs text-gray-500 mb-2">Notification types</p>
      <div className="space-y-2">
        {KNOWN_TYPES.map(type => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const muted = prefs.mutedTypes.includes(type);
          return (
            <label key={type} className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-gray-700">
                <Icon className="w-4 h-4 text-gray-400" /> {meta.label}
              </span>
              <input type="checkbox" checked={!muted} onChange={() => toggleType(type)} className="w-4 h-4" />
            </label>
          );
        })}
      </div>
    </div>
  );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [tab, setTab] = useState<FilterTab>('unread');
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const refresh = () => {
    listNotifications({ includeArchived: true }).then(setNotifications).catch(() => setNotifications([]));
  };
  useEffect(refresh, []);
  useEffect(() => { getPreferences().then(setPrefs).catch(() => setPrefs({ mutedTypes: [], minPriority: 'low', emailEnabled: true })); }, []);

  const filtered = useMemo(() => {
    if (!notifications) return [];
    const base =
      tab === 'archived' ? notifications.filter(n => n.isArchived)
      : tab === 'unread' ? notifications.filter(n => !n.isArchived && !n.isRead)
      : notifications.filter(n => !n.isArchived);
    return [...base].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [notifications, tab]);

  const unreadCount = notifications?.filter(n => !n.isArchived && !n.isRead).length ?? 0;

  const handleOpen = async (n: AppNotification) => {
    if (!n.isRead) {
      await markRead(n.id).catch(() => {});
      setNotifications(prev => prev?.map(x => x.id === n.id ? { ...x, isRead: true } : x) ?? null);
    }
    if (n.actionTab) onNavigate(n.actionTab);
  };

  const handleArchive = async (id: string) => {
    await archiveNotification(id).catch(() => {});
    setNotifications(prev => prev?.map(x => x.id === id ? { ...x, isArchived: true } : x) ?? null);
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setNotifications(prev => prev?.map(x => ({ ...x, isRead: true })) ?? null);
  };

  const handlePrefsChange = async (next: NotificationPreferences) => {
    setPrefs(next);
    try {
      await updatePreferences(next);
    } catch {
      toast.error('Failed to save notification settings');
    }
  };

  if (notifications === null || prefs === null) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-56 skeleton-shimmer rounded-md" />
          <div className="h-4 w-72 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notification Center"
        description="Everything that needs your attention, in one prioritized list."
        actions={
          <>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all duration-150">
                <Check className="w-4 h-4" /> Mark all read
              </button>
            )}
            <button onClick={() => setShowSettings(s => !s)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all duration-150" aria-label="Notification settings">
              <Settings className="w-4 h-4" />
            </button>
          </>
        }
      >
        <div className="flex gap-1 mt-4 border-b border-gray-100">
          {(['unread', 'all', 'archived'] as FilterTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : t === 'all' ? 'All' : 'Archived'}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className={`grid grid-cols-1 ${showSettings ? 'lg:grid-cols-3' : ''} gap-6`}>
        <div className={showSettings ? 'lg:col-span-2 space-y-2' : 'space-y-2'}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              tone={tab === 'unread' ? 'positive' : 'neutral'}
              title={tab === 'unread' ? "You're all caught up." : tab === 'archived' ? 'Nothing archived yet.' : 'No notifications yet.'}
            />
          ) : (
            filtered.map(n => (
              <NotificationRow key={n.id} notification={n} onOpen={handleOpen} onArchive={handleArchive} showArchive={!n.isArchived} />
            ))
          )}
        </div>

        {showSettings && <PreferencesPanel prefs={prefs} onChange={handlePrefsChange} onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
};

export default NotificationCenter;
