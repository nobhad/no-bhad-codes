/**
 * ===============================================
 * PORTAL SETTINGS MODULE
 * ===============================================
 * @file src/features/shared/PortalSettings.ts
 *
 * Role-adaptive settings module for both admin and client portals.
 * Admin sees system settings, user management, integrations.
 * Client sees profile, notifications, and security settings.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, apiPut, unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalSettings');

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  avatar?: string;
  timezone?: string;
  createdAt: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  projectUpdates: boolean;
  invoiceReminders: boolean;
  messageAlerts: boolean;
  weeklyDigest: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange?: string;
  activeSessions: number;
}

// ============================================
// PORTAL SETTINGS MODULE
// ============================================

/**
 * Portal Settings Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: system settings, user management, integrations
 * - Client: profile, notifications, security
 */
export default class PortalSettings extends PortalFeatureModule {
  /** User profile data */
  private profile: UserProfile | null = null;

  /** Notification preferences */
  private notifications: NotificationPreferences = {
    emailNotifications: true,
    projectUpdates: true,
    invoiceReminders: true,
    messageAlerts: true,
    weeklyDigest: false
  };

  /** Security settings */
  private security: SecuritySettings = {
    twoFactorEnabled: false,
    activeSessions: 1
  };

  /** Current settings tab */
  private currentTab: string = 'profile';

  constructor() {
    super('PortalSettings');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadSettings();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.profile = null;
    this.currentTab = 'profile';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return '/api/users/me';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadSettings(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);
      this.profile = (data.user as UserProfile) || (data as unknown as UserProfile);

      // Load notification preferences
      const notifResponse = await apiFetch('/api/users/me/notifications');
      const notifRaw = await notifResponse.json();
      const notifData = unwrapApiData<Record<string, unknown>>(notifRaw);
      this.notifications = (notifData as unknown as NotificationPreferences) || this.notifications;
    } catch (error) {
      this.notify('Failed to load settings', 'error');
      logger.error('Error loading settings:', error);
    }
  }

  // ============================================
  // VIEW RENDERING - Role-adaptive
  // ============================================

  protected renderView(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="settings-layout">
        <div class="settings-sidebar">
          ${this.renderSettingsTabs()}
        </div>
        <div class="settings-content">
          ${this.renderSettingsContent()}
        </div>
      </div>
    `;
  }

  private renderSettingsTabs(): string {
    const tabs = [
      { id: 'profile', label: 'Profile', icon: this.getUserIcon() },
      { id: 'notifications', label: 'Notifications', icon: this.getBellIcon() },
      { id: 'security', label: 'Security', icon: this.getShieldIcon() }
    ];

    // Admin-only tabs
    if (this.isAdmin) {
      tabs.push(
        { id: 'system', label: 'System', icon: this.getSettingsIcon() },
        { id: 'integrations', label: 'Integrations', icon: this.getLinkIcon() }
      );
    }

    return `
      <nav class="settings-nav">
        ${tabs.map((tab) => `
          <button class="settings-nav-item ${this.currentTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            ${tab.icon}
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  }

  private renderSettingsContent(): string {
    switch (this.currentTab) {
    case 'profile':
      return this.renderProfileSettings();
    case 'notifications':
      return this.renderNotificationSettings();
    case 'security':
      return this.renderSecuritySettings();
    case 'system':
      return this.isAdmin ? this.renderSystemSettings() : '';
    case 'integrations':
      return this.isAdmin ? this.renderIntegrationSettings() : '';
    default:
      return this.renderProfileSettings();
    }
  }

  private renderProfileSettings(): string {
    if (!this.profile) {
      return '<div class="loading-state"><p>Loading profile...</p></div>';
    }

    return `
      <div class="settings-section">
        <h3>Profile Settings</h3>
        <form id="profile-form" class="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="firstName">First Name</label>
              <input type="text" id="firstName" class="form-input" value="${this.escapeHtml(this.profile.firstName)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="lastName">Last Name</label>
              <input type="text" id="lastName" class="form-input" value="${this.escapeHtml(this.profile.lastName)}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input type="email" id="email" class="form-input" value="${this.escapeHtml(this.profile.email)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="phone">Phone</label>
            <input type="tel" id="phone" class="form-input" value="${this.escapeHtml(this.profile.phone || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="company">Company</label>
            <input type="text" id="company" class="form-input" value="${this.escapeHtml(this.profile.company || '')}" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  }

  private renderNotificationSettings(): string {
    return `
      <div class="settings-section">
        <h3>Notification Preferences</h3>
        <form id="notifications-form" class="settings-form">
          <div class="settings-toggle-group">
            ${this.renderToggle('emailNotifications', 'Email Notifications', 'Receive notifications via email', this.notifications.emailNotifications)}
            ${this.renderToggle('projectUpdates', 'Project Updates', 'Get notified about project changes', this.notifications.projectUpdates)}
            ${this.renderToggle('invoiceReminders', 'Invoice Reminders', 'Receive payment reminders', this.notifications.invoiceReminders)}
            ${this.renderToggle('messageAlerts', 'Message Alerts', 'Get notified about new messages', this.notifications.messageAlerts)}
            ${this.renderToggle('weeklyDigest', 'Weekly Digest', 'Receive a weekly summary email', this.notifications.weeklyDigest)}
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Preferences</button>
          </div>
        </form>
      </div>
    `;
  }

  private renderSecuritySettings(): string {
    return `
      <div class="settings-section">
        <h3>Security Settings</h3>
        <div class="security-overview">
          <div class="security-item">
            <div class="security-info">
              <h4>Two-Factor Authentication</h4>
              <p>${this.security.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</p>
            </div>
            <button class="btn btn-secondary" data-action="toggle-2fa">
              ${this.security.twoFactorEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          <div class="security-item">
            <div class="security-info">
              <h4>Password</h4>
              <p>${this.security.lastPasswordChange ? `Last changed ${this.formatRelativeTime(this.security.lastPasswordChange)}` : 'Never changed'}</p>
            </div>
            <button class="btn btn-secondary" data-action="change-password">Change Password</button>
          </div>
          <div class="security-item">
            <div class="security-info">
              <h4>Active Sessions</h4>
              <p>${this.security.activeSessions} active session(s)</p>
            </div>
            <button class="btn btn-secondary" data-action="view-sessions">View Sessions</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderSystemSettings(): string {
    return `
      <div class="settings-section">
        <h3>System Settings</h3>
        <p>System configuration options for administrators.</p>
        <div class="coming-soon">
          <p>System settings panel coming soon.</p>
        </div>
      </div>
    `;
  }

  private renderIntegrationSettings(): string {
    return `
      <div class="settings-section">
        <h3>Integrations</h3>
        <p>Connect external services and APIs.</p>
        <div class="coming-soon">
          <p>Integration settings coming soon.</p>
        </div>
      </div>
    `;
  }

  private renderToggle(id: string, label: string, description: string, checked: boolean): string {
    return `
      <div class="settings-toggle-item">
        <div class="toggle-info">
          <label for="${id}" class="toggle-label">${label}</label>
          <p class="toggle-description">${description}</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="${id}" name="${id}" ${checked ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    // Tab navigation
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabBtn = target.closest('[data-tab]') as HTMLElement;

      if (tabBtn) {
        this.currentTab = tabBtn.dataset.tab || 'profile';
        this.renderView();
        this.attachEventListeners();
        return;
      }

      // Action buttons
      const actionBtn = target.closest('[data-action]') as HTMLElement;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        switch (action) {
        case 'toggle-2fa':
          this.notify('2FA settings coming soon', 'info');
          break;
        case 'change-password':
          this.notify('Password change coming soon', 'info');
          break;
        case 'view-sessions':
          this.notify('Session management coming soon', 'info');
          break;
        }
      }
    });

    // Profile form submission
    const profileForm = this.container.querySelector('#profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProfileSettings();
      });
    }

    // Notifications form submission
    const notificationsForm = this.container.querySelector('#notifications-form');
    if (notificationsForm) {
      notificationsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveNotificationSettings();
      });
    }
  }

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  private async saveProfileSettings(): Promise<void> {
    const form = this.container?.querySelector('#profile-form') as HTMLFormElement;
    if (!form) return;

    const formData = {
      firstName: (form.querySelector('#firstName') as HTMLInputElement)?.value,
      lastName: (form.querySelector('#lastName') as HTMLInputElement)?.value,
      email: (form.querySelector('#email') as HTMLInputElement)?.value,
      phone: (form.querySelector('#phone') as HTMLInputElement)?.value,
      company: (form.querySelector('#company') as HTMLInputElement)?.value
    };

    try {
      await apiPut('/api/users/me', formData);
      this.notify('Profile saved successfully', 'success');
    } catch (error) {
      this.notify('Failed to save profile', 'error');
      logger.error('Error saving profile:', error);
    }
  }

  private async saveNotificationSettings(): Promise<void> {
    const form = this.container?.querySelector('#notifications-form') as HTMLFormElement;
    if (!form) return;

    const formData = {
      emailNotifications: (form.querySelector('#emailNotifications') as HTMLInputElement)?.checked,
      projectUpdates: (form.querySelector('#projectUpdates') as HTMLInputElement)?.checked,
      invoiceReminders: (form.querySelector('#invoiceReminders') as HTMLInputElement)?.checked,
      messageAlerts: (form.querySelector('#messageAlerts') as HTMLInputElement)?.checked,
      weeklyDigest: (form.querySelector('#weeklyDigest') as HTMLInputElement)?.checked
    };

    try {
      await apiPut('/api/users/me/notifications', formData);
      this.notify('Notification preferences saved', 'success');
    } catch (error) {
      this.notify('Failed to save preferences', 'error');
      logger.error('Error saving notifications:', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const days = Math.floor(diff / 86400000);

    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }

  // Icons
  private getUserIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }

  private getBellIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  }

  private getShieldIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  }

  private getSettingsIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  }

  private getLinkIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  }
}
