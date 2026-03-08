/**
 * ===============================================
 * NOTIFICATION BELL
 * ===============================================
 * @file src/react/components/portal/NotificationBell.tsx
 *
 * Header notification bell with dropdown.
 * Fetches notifications based on user role (admin vs client).
 */

import * as React from 'react';
import { Bell } from 'lucide-react';
import { usePortalAuth } from '../../hooks/usePortalAuth';
import { apiGet, apiPut } from '../../../utils/api-client';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { KEYS } from '../../../constants/keyboard';
import { formatTimeAgo } from '../../../utils/time-utils';

// ============================================
// TYPES
// ============================================

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  data?: string;
}

// ============================================
// CONSTANTS
// ============================================

const POLL_INTERVAL_MS = 60_000;
const MAX_BADGE_DISPLAY = 99;

// ============================================
// COMPONENT
// ============================================

export function NotificationBell() {
  const { isAuthenticated, isAdmin: isAdminAuth } = usePortalAuth();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = isAdminAuth;

  const endpoint = isAdmin
    ? `${API_ENDPOINTS.ADMIN.NOTIFICATIONS}/history`
    : `${API_ENDPOINTS.CLIENT_NOTIFICATIONS}/history`;

  const markReadEndpoint = isAdmin
    ? API_ENDPOINTS.ADMIN.NOTIFICATIONS
    : API_ENDPOINTS.CLIENT_NOTIFICATIONS;

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiGet(endpoint);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data?.notifications) {
        setNotifications(json.data.notifications);
      }
    } catch {
      // Silently fail - notifications are non-critical
    }
  }, [endpoint, isAuthenticated]);

  // Initial fetch + polling
  React.useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications, isAuthenticated]);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === KEYS.ESCAPE) setOpen(false);
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = React.useCallback(
    async (id: number) => {
      try {
        await apiPut(`${markReadEndpoint}/${id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
        );
      } catch {
        // Silently fail
      }
    },
    [markReadEndpoint]
  );

  const handleMarkAllRead = React.useCallback(async () => {
    try {
      await apiPut(`${markReadEndpoint}/mark-all-read`);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // Silently fail
    }
  }, [markReadEndpoint]);

  const badgeText =
    unreadCount > MAX_BADGE_DISPLAY ? `${MAX_BADGE_DISPLAY}+` : `${unreadCount}`;

  // Don't render the bell when not authenticated
  if (!isAuthenticated) return null;

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        className="notification-bell-btn"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge">{badgeText}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3 className="notification-dropdown-title">Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="btn-link"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notification-item${!n.is_read ? ' unread' : ''}`}
                  onClick={() => {
                    if (!n.is_read) handleMarkRead(n.id);
                  }}
                >
                  {!n.is_read && <span className="notification-unread-dot" />}
                  <div className="notification-item-content">
                    <p className="notification-item-title">{n.title}</p>
                    <p className="notification-item-message">{n.message}</p>
                    <span className="notification-item-time">
                      {formatTimeAgo(n.created_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
