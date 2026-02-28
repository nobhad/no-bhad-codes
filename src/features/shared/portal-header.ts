/**
 * ===============================================
 * SHARED PORTAL HEADER MODULE
 * ===============================================
 * @file src/features/shared/portal-header.ts
 *
 * Shared header functionality for both admin and client portals.
 * Handles notification bell, theme toggle, and other header features.
 */

import type { NotificationBell } from '../../components/notification-bell';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalHeader');

// ============================================
// Types
// ============================================

export type PortalRole = 'admin' | 'client';

export interface PortalHeaderConfig {
  role: PortalRole;
  notificationBellContainer?: string;
  themeToggleId?: string;
}

// ============================================
// PortalHeader Class
// ============================================

export class PortalHeader {
  private config: PortalHeaderConfig;
  private notificationBellInstance: NotificationBell | null = null;
  private initialized = false;

  constructor(config: PortalHeaderConfig) {
    this.config = {
      notificationBellContainer: 'notification-bell-container',
      themeToggleId: 'portal-theme-toggle',
      ...config
    };
  }

  /**
   * Initialize all header features
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.initNotificationBell();
    this.initThemeToggle();

    this.initialized = true;
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.notificationBellInstance) {
      this.notificationBellInstance.destroy();
      this.notificationBellInstance = null;
    }
    this.initialized = false;
  }

  /**
   * Initialize the notification bell component
   * Both admin and client have notification support
   */
  private async initNotificationBell(): Promise<void> {
    const containerId = this.config.notificationBellContainer;
    if (!containerId) return;

    const container = document.getElementById(containerId);
    if (!container || this.notificationBellInstance) return;

    try {
      const { initNotificationBell } = await import('../../components/notification-bell');
      this.notificationBellInstance = await initNotificationBell(container, {
        // Pass role for role-aware API calls
        ...(this.config.role === 'admin' ? { isAdmin: true } : {})
      });
    } catch (error) {
      logger.warn('Failed to initialize notification bell:', error);
    }
  }

  /**
   * Initialize theme toggle button
   */
  private initThemeToggle(): void {
    const toggleId = this.config.themeToggleId;
    if (!toggleId) return;

    const toggle = document.getElementById(toggleId);
    if (!toggle) return;

    // Theme toggle uses appState to toggle theme
    // This avoids needing ThemeModule instance
    toggle.addEventListener('click', () => {
      import('../../core/state').then(({ appState }) => {
        const currentTheme = appState.getState().theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        appState.setState({ theme: newTheme });
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });
    });
  }

  /**
   * Refresh notification bell (e.g., after new notification)
   */
  async refreshNotifications(): Promise<void> {
    if (this.notificationBellInstance) {
      await this.notificationBellInstance.refresh();
    }
  }
}

/**
 * Create and initialize portal header
 */
export async function initPortalHeader(config: PortalHeaderConfig): Promise<PortalHeader> {
  const header = new PortalHeader(config);
  await header.init();
  return header;
}
