import { useCallback, useEffect, useState } from 'react';
import {
  listNotifications,
  markRead,
  markAllRead,
  archiveNotification,
  type AppNotification,
} from '../services/notifications/notificationService';

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listNotifications();
      setNotifications(data);
    } catch {
      // Silently keep the last-known list rather than blank the bell on a
      // transient network error — this is a secondary UI, not a page.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    await markRead(id).catch(() => refresh());
  }, [refresh]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await markAllRead().catch(() => refresh());
  }, [refresh]);

  const handleArchive = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await archiveNotification(id).catch(() => refresh());
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    archive: handleArchive,
  };
}
