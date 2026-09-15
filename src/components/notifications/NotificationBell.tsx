import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { formatDate } from '../../utils/format';
import type { AppNotification, NotificationPriority } from '../../services/notifications/notificationService';

interface NotificationBellProps {
  /** Navigate the dashboard to a tab, used when a notification names an actionTab. */
  onNavigate?: (tab: string) => void;
}

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  critical: 'bg-red-500',
};

const NotificationItem: React.FC<{
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onArchive: (id: string) => void;
}> = ({ notification, onOpen, onArchive }) => (
  <div
    className={`flex gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
      notification.isRead ? '' : 'bg-blue-50/50'
    }`}
    onClick={() => onOpen(notification)}
  >
    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[notification.priority]}`} />
    <div className="flex-1 min-w-0">
      <p className={`text-sm ${notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
        {notification.title}
      </p>
      {notification.body && (
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.body}</p>
      )}
      <p className="text-xs text-gray-400 mt-1">{formatDate(notification.createdAt, { month: 'short', day: 'numeric' })}</p>
    </div>
    <button
      onClick={e => { e.stopPropagation(); onArchive(notification.id); }}
      className="text-gray-300 hover:text-gray-500 flex-shrink-0"
      aria-label="Dismiss"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { notifications, unreadCount, markRead, markAllRead, archive } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = (n: AppNotification) => {
    if (!n.isRead) markRead(n.id);
    if (n.actionTab && onNavigate) {
      onNavigate(n.actionTab);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <Bell className="w-5 h-5 text-blue-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-200 z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                You're all caught up.
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onOpen={handleOpen} onArchive={archive} />
              ))
            )}
          </div>
          {onNavigate && (
            <button
              onClick={() => { onNavigate('notifications'); setOpen(false); }}
              className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800 px-4 py-2.5 border-t border-gray-100"
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
