import { useState, useEffect, useRef, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useAuth } from './useAuth';

export function useNotifications() {
  const api = useApiClient();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef(null);
  const lastFetchTimeRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const res = await api.get('/api/notify');
      const fetchedNotifications = res.data.notifications || [];

      // Check if there are new notifications
      if (lastFetchTimeRef.current) {
        const newNotifications = fetchedNotifications.filter(notif => {
          const notifTime = new Date(notif.created_at).getTime();
          return notifTime > lastFetchTimeRef.current;
        });

        // Update state
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.filter(n => !n.is_read).length);

        // Return new notifications for potential toast notifications
        return newNotifications;
      } else {
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.filter(n => !n.is_read).length);
      }

      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      // Silently handle notification errors - don't break the app if notifications aren't available
      // Suppress 502 errors to avoid console spam
      if (err.response?.status !== 502) {
        console.error('Error fetching notifications:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notify/${id}/read`);
      setNotifications(prev =>
        prev.map(notif => notif.id === id ? { ...notif, is_read: 1 } : notif)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      // Silently handle notification errors
      // console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notify/read-all');
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: 1 }))
      );
      setUnreadCount(0);
    } catch (err) {
      // Silently handle notification errors
      // console.error('Error marking all as read:', err);
    }
  };

  // Start polling for notifications
  useEffect(() => {
    if (!token) return;

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds for new notifications
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000); // 30 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [token, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}

