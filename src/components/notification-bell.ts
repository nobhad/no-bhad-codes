/**
 * ===============================================
 * NOTIFICATION BELL COMPONENT
 * ===============================================
 * @file src/components/notification-bell.ts
 *
 * Client portal notification bell with dropdown.
 * Shows unread count badge and recent notifications.
 */

import { ICONS } from '../constants/icons';
import { formatDate } from '../utils/format-utils';
import { SanitizationUtils } from '../utils/sanitization-utils';

// ============================================
// Types
// ============================================

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

interface NotificationBellOptions {
  container: HTMLElement;
  onNotificationClick?: (notification: Notification) => void;
  pollInterval?: number; // ms, default 60000
}

// ============================================
// Constants
// ============================================

const DEFAULT_POLL_INTERVAL = 60000; // 1 minute
const NOTIFICATION_LIMIT = 10;

// ============================================
// NotificationBell Class
// ============================================

export class NotificationBell {
  private container: HTMLElement;
  private bellButton: HTMLButtonElement | null = null;
  private badge: HTMLSpanElement | null = null;
  private dropdown: HTMLElement | null = null;
  private notificationList: HTMLElement | null = null;
  private notifications: Notification[] = [];
  private unreadCount = 0;
  private isOpen = false;
  private pollTimer: number | null = null;
  private pollInterval: number;
  private onNotificationClick?: (notification: Notification) => void;

  constructor(options: NotificationBellOptions) {
    this.container = options.container;
    this.onNotificationClick = options.onNotificationClick;
    this.pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;
  }

  /**
   * Initialize the notification bell
   */
  async init(): Promise<void> {
    this.render();
    this.bindEvents();
    await this.fetchNotifications();
    this.startPolling();
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopPolling();
    this.container.innerHTML = '';
  }

  /**
   * Render the notification bell HTML
   */
  private render(): void {
    this.container.innerHTML = `
      <button type="button" class="notification-bell-btn icon-btn" id="notification-bell" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
        ${ICONS.BELL}
        <span class="notification-badge hidden" id="notification-badge">0</span>
      </button>
      <div class="notification-dropdown hidden" id="notification-dropdown" role="menu" aria-label="Notifications">
        <div class="notification-header">
          <h3 class="notification-dropdown-title">Notifications</h3>
          <button type="button" class="btn-text" id="mark-all-read">Mark all read</button>
        </div>
        <div class="notification-list" id="notification-list">
          <div class="notification-empty">No notifications</div>
        </div>
      </div>
    `;

    this.bellButton = document.getElementById('notification-bell') as HTMLButtonElement;
    this.badge = document.getElementById('notification-badge') as HTMLSpanElement;
    this.dropdown = document.getElementById('notification-dropdown') as HTMLElement;
    this.notificationList = document.getElementById('notification-list') as HTMLElement;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Toggle dropdown on bell click
    this.bellButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Mark all read button
    const markAllBtn = document.getElementById('mark-all-read');
    markAllBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.markAllAsRead();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeDropdown();
        this.bellButton?.focus();
      }
    });

    // Delegate click on notification items
    this.notificationList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const notificationItem = target.closest('.notification-item') as HTMLElement;

      if (notificationItem) {
        const notificationId = parseInt(notificationItem.dataset.id || '0', 10);
        const notification = this.notifications.find(n => n.id === notificationId);

        if (notification) {
          // Mark as read
          if (!notification.is_read) {
            this.markAsRead(notification.id);
          }

          // Fire callback
          if (this.onNotificationClick) {
            this.onNotificationClick(notification);
          }
        }
      }
    });
  }

  /**
   * Toggle dropdown open/closed
   */
  private toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  private openDropdown(): void {
    this.dropdown?.classList.remove('hidden');
    this.bellButton?.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
  }

  /**
   * Close dropdown
   */
  private closeDropdown(): void {
    this.dropdown?.classList.add('hidden');
    this.bellButton?.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  /**
   * Fetch notifications from API
   */
  private async fetchNotifications(): Promise<void> {
    try {
      const response = await fetch(`/api/clients/me/notifications/history?limit=${NOTIFICATION_LIMIT}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[NotificationBell] Failed to fetch notifications');
        return;
      }

      const data = await response.json();
      this.notifications = data.notifications || [];
      this.unreadCount = this.notifications.filter(n => !n.is_read).length;

      this.updateBadge();
      this.renderNotifications();
    } catch (error) {
      console.error('[NotificationBell] Fetch error:', error);
    }
  }

  /**
   * Update badge with unread count
   */
  private updateBadge(): void {
    if (!this.badge) return;

    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
      this.badge.classList.remove('hidden');
    } else {
      this.badge.classList.add('hidden');
    }
  }

  /**
   * Render notification list
   */
  private renderNotifications(): void {
    if (!this.notificationList) return;

    if (this.notifications.length === 0) {
      this.notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }

    this.notificationList.innerHTML = this.notifications.map(notification => `
      <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}" role="menuitem" tabindex="0">
        <div class="notification-item-content">
          <p class="notification-item-title">${SanitizationUtils.escapeHtml(notification.title)}</p>
          <p class="notification-item-message">${SanitizationUtils.escapeHtml(notification.message)}</p>
          <span class="notification-item-time">${formatDate(notification.created_at)}</span>
        </div>
        ${!notification.is_read ? '<span class="notification-unread-dot"></span>' : ''}
      </div>
    `).join('');
  }

  /**
   * Mark a single notification as read
   */
  private async markAsRead(notificationId: number): Promise<void> {
    try {
      const response = await fetch(`/api/clients/me/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.ok) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.is_read) {
          notification.is_read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.updateBadge();
          this.renderNotifications();
        }
      }
    } catch (error) {
      console.error('[NotificationBell] Mark read error:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  private async markAllAsRead(): Promise<void> {
    try {
      const response = await fetch('/api/clients/me/notifications/mark-all-read', {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.ok) {
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
        this.updateBadge();
        this.renderNotifications();
      }
    } catch (error) {
      console.error('[NotificationBell] Mark all read error:', error);
    }
  }

  /**
   * Start polling for new notifications
   */
  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = window.setInterval(() => {
      this.fetchNotifications();
    }, this.pollInterval);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Manually refresh notifications
   */
  async refresh(): Promise<void> {
    await this.fetchNotifications();
  }
}

/**
 * Initialize notification bell in a container
 */
export async function initNotificationBell(
  container: HTMLElement,
  options?: Partial<Omit<NotificationBellOptions, 'container'>>
): Promise<NotificationBell> {
  const bell = new NotificationBell({
    container,
    ...options
  });

  await bell.init();
  return bell;
}
