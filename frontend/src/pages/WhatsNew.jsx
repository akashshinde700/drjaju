import { useState, useEffect, useMemo } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';

export default function WhatsNew() {
  const api = useApiClient();
  const [announcements, setAnnouncements] = useState([]);
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');

  // Stable sample announcements for fallback (memoized to avoid changing effect deps)
  const sampleAnnouncements = useMemo(() => ([
    {
      id: 1,
      title: 'New Feature: Enhanced Patient Search',
      message: "We've improved the patient search functionality with advanced filters and quick actions.",
      type: 'feature',
      date: '2024-01-15',
      isRead: false,
      priority: 'high'
    },
    {
      id: 2,
      title: 'System Maintenance Scheduled',
      message: 'Scheduled maintenance on January 20, 2024 from 2:00 AM to 4:00 AM IST. Some features may be temporarily unavailable.',
      type: 'maintenance',
      date: '2024-01-18',
      isRead: false,
      priority: 'medium'
    },
    {
      id: 3,
      title: 'ABHA Integration Update',
      message: 'New ABHA features are now available! Link patient records and earn incentives.',
      type: 'update',
      date: '2024-01-10',
      isRead: true,
      priority: 'high'
    },
    {
      id: 4,
      title: 'New Prescription Templates',
      message: 'Check out our new prescription templates in the Rx Template section.',
      type: 'feature',
      date: '2024-01-05',
      isRead: true,
      priority: 'low'
    }
  ]), []);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        try {
          const res = await api.get('/api/notify');
          if (res.data && res.data.notifications && res.data.notifications.length > 0) {
            // Transform backend notifications to frontend format
            const transformed = res.data.notifications.map((notif) => ({
              id: notif.id,
              title: notif.title || 'Notification',
              message: notif.message || '',
              type: notif.type || 'info',
              date: notif.created_at || new Date().toISOString(),
              isRead: notif.is_read === 1,
              priority: notif.type === 'error' ? 'high' : notif.type === 'warning' ? 'medium' : 'low'
            }));
            setAllAnnouncements(transformed);
            setAnnouncements(transformed);
          } else {
            setAllAnnouncements(sampleAnnouncements);
            setAnnouncements(sampleAnnouncements);
          }
        } catch {
          // If API fails, use sample data
          setAllAnnouncements(sampleAnnouncements);
          setAnnouncements(sampleAnnouncements);
        }
      } catch {
        setAnnouncements(sampleAnnouncements);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [api, sampleAnnouncements]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notify/${id}/read`);
      setAnnouncements((prev) => prev.map((ann) => (ann.id === id ? { ...ann, isRead: true } : ann)));
    } catch {
      // Update locally even if API fails
      setAnnouncements((prev) => prev.map((ann) => (ann.id === id ? { ...ann, isRead: true } : ann)));
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notify/read-all');
      setAnnouncements((prev) => prev.map((ann) => ({ ...ann, isRead: true })));
    } catch {
      setAnnouncements((prev) => prev.map((ann) => ({ ...ann, isRead: true })));
    }
  };

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature':
        return '✨';
      case 'update':
        return '🆕';
      case 'maintenance':
        return '🔧';
      case 'important':
        return '⚠️';
      default:
        return '📢';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-blue-500';
      default:
        return 'border-l-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <HeaderBar title="What's New" />

      {/* Header with Unread Count */}
      <div className="bg-white border rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Announcements & Updates</h2>
            <p className="text-sm text-slate-600 mt-1">Stay updated with the latest features and important notices</p>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">
                {unreadCount} unread {unreadCount === 1 ? 'item' : 'items'}
              </span>
              <button onClick={markAllAsRead} className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90">
                Mark All as Read
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border rounded-lg shadow-sm p-8 text-center">
            <p className="text-slate-500">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white border rounded-lg shadow-sm p-8 text-center">
            <p className="text-slate-500">No announcements at this time.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white border-l-4 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${getPriorityColor(
                announcement.priority
              )} ${!announcement.isRead ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{getTypeIcon(announcement.type)}</span>
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    {!announcement.isRead && <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">New</span>}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{announcement.message}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      {new Date(announcement.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="capitalize">{announcement.type}</span>
                    <span className="capitalize">Priority: {announcement.priority}</span>
                  </div>
                </div>
                {!announcement.isRead && (
                  <button onClick={() => markAsRead(announcement.id)} className="px-3 py-1 text-xs border rounded hover:bg-slate-50 whitespace-nowrap">
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Section */}
      <div className="bg-white border rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilterType('all');
              setAnnouncements(allAnnouncements);
            }}
            className={`px-3 py-2 text-sm border rounded hover:bg-slate-50 ${filterType === 'all' ? 'bg-primary text-white border-primary' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilterType('feature');
              setAnnouncements(allAnnouncements.filter((a) => a.type === 'feature'));
            }}
            className={`px-3 py-2 text-sm border rounded hover:bg-slate-50 ${filterType === 'feature' ? 'bg-primary text-white border-primary' : ''}`}
          >
            Features
          </button>
          <button
            onClick={() => {
              setFilterType('update');
              setAnnouncements(allAnnouncements.filter((a) => a.type === 'update'));
            }}
            className={`px-3 py-2 text-sm border rounded hover:bg-slate-50 ${filterType === 'update' ? 'bg-primary text-white border-primary' : ''}`}
          >
            Updates
          </button>
          <button
            onClick={() => {
              setFilterType('maintenance');
              setAnnouncements(allAnnouncements.filter((a) => a.type === 'maintenance'));
            }}
            className={`px-3 py-2 text-sm border rounded hover:bg-slate-50 ${filterType === 'maintenance' ? 'bg-primary text-white border-primary' : ''}`}
          >
            Maintenance
          </button>
          <button
            onClick={() => {
              setFilterType('unread');
              setAnnouncements(allAnnouncements.filter((a) => !a.isRead));
            }}
            className={`px-3 py-2 text-sm border rounded hover:bg-slate-50 ${filterType === 'unread' ? 'bg-primary text-white border-primary' : ''}`}
          >
            Unread Only
          </button>
        </div>
      </div>
    </div>
  );
}
