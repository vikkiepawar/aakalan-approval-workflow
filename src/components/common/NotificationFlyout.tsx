import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, AlertTriangle, ShieldAlert, FileText, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../types';

interface NotificationFlyoutProps {
  onSelectApplication?: (appId: string) => void;
}

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({ onSelectApplication }) => {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!token || !user) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silently handle transient polling disruptions during server reloads
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000); // 25s poll
    return () => clearInterval(interval);
  }, [token, user?.id]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore transient network errors
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // Ignore transient network errors
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'DEADLINE_WARNING':
        return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'CORRECTION_REQUIRED':
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'OVERDUE_ESCALATION':
        return <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />;
      case 'STAGE_ADVANCED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notifications recorded yet.
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) markAsRead(notif.id);
                    if (notif.reference_id && onSelectApplication) {
                      onSelectApplication(notif.reference_id);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                    notif.is_read ? 'opacity-70' : 'bg-blue-50/20'
                  }`}
                >
                  <div className="mt-0.5">{getIcon(notif.notification_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                        {new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {notif.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Channel: {notif.channel}</span>
                      {!notif.is_read && (
                        <button
                          onClick={(e) => markAsRead(notif.id, e)}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
