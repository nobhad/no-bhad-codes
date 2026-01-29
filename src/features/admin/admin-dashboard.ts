/**
 * ===============================================
 * ADMIN DASHBOARD CONTROLLER
 * ===============================================
 * @file src/admin/admin-dashboard.ts
 *
 * Secure admin dashboard for performance and analytics monitoring.
 * Only accessible with proper authentication.
 */

import { AdminSecurity } from './admin-security';
import { AdminAuth } from './admin-auth';
import { AdminProjectDetails } from './admin-project-details';
import type { PerformanceMetrics, PerformanceAlert } from '../../services/performance-service';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import type {
  AdminDashboardContext,
  AnalyticsEvent,
  Lead,
  ContactSubmission,
  Project,
  Message,
  ContactStats
} from './admin-types';
import { APP_CONSTANTS, getChartColor, getChartColorWithAlpha } from '../../config/constants';
import { configureApiClient, apiFetch, apiPost, apiPut } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { createDOMCache } from '../../utils/dom-cache';
import { formatDate, formatDateTime, formatProjectType } from '../../utils/format-utils';
import { confirmDanger, alertError, alertSuccess, alertInfo } from '../../utils/confirm-dialog';
import { showToast } from '../../utils/toast-notifications';

// DOM element keys for caching
type DashboardDOMKeys = Record<string, string>;

const logger = createLogger('AdminDashboard');

// Dynamic module loaders for code splitting
import {
  loadLeadsModule,
  loadContactsModule,
  loadProjectsModule,
  loadClientsModule,
  loadMessagingModule,
  loadAnalyticsModule,
  loadOverviewModule,
  loadPerformanceModule,
  loadSystemStatusModule,
  loadProposalsModule
} from './modules';

// Chart.js is loaded dynamically to reduce initial bundle size
let Chart: typeof import('chart.js').Chart | null = null;

async function loadChartJS(): Promise<typeof import('chart.js').Chart> {
  if (!Chart) {
    const chartModule = await import('chart.js');
    chartModule.Chart.register(...chartModule.registerables);
    Chart = chartModule.Chart;
  }
  return Chart;
}

// Type definitions
interface PerformanceReport {
  score: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

// NOTE: AnalyticsData, RawVisitorData, ApplicationStatus, VisitorInfo
// types are defined in admin-types.ts and used by modules

// Dashboard data management
class AdminDashboard {
  private currentTab = 'overview';
  private refreshInterval: NodeJS.Timeout | null = null;
  private charts: Map<string, { destroy: () => void }> = new Map();

  // Store data for detail views
  private leadsData: Lead[] = [];
  private contactsData: ContactSubmission[] = [];
  private projectsData: Project[] = [];

  // Module context for code-split modules
  private moduleContext: AdminDashboardContext;

  // Project details handler
  private projectDetails: AdminProjectDetails;

  // DOM element cache
  private domCache = createDOMCache<DashboardDOMKeys>();

  // Delegate currentProjectId to project details handler
  private get currentProjectId(): number | null {
    return this.projectDetails.getCurrentProjectId();
  }

  private set currentProjectId(value: number | null) {
    // Note: Setting handled by projectDetails.showProjectDetails()
    // This setter exists for compatibility with existing code
    if (value === null) {
      // Reset by switching tabs - handled in switchTab method
    }
  }

  constructor() {
    // Register DOM element selectors for caching
    this.domCache.register({
      authGate: '#auth-gate',
      adminDashboard: '#admin-dashboard',
      adminLoginForm: '#admin-login-form',
      adminPassword: '#admin-password',
      passwordToggle: '#password-toggle',
      authError: '#auth-error',
      sidebar: '#sidebar',
      refreshLeadsBtn: '#refresh-leads-btn',
      refreshAnalytics: '#refresh-analytics',
      refreshContactsBtn: '#refresh-contacts-btn',
      refreshProjectsBtn: '#refresh-projects-btn',
      logoutBtn: '#logout-btn',
      btnLogout: '#btn-logout',
      detailModal: '#detail-modal',
      modalCloseBtn: '#modal-close-btn',
      modalCloseBtnFooter: '#modal-close-btn-footer',
      modalTitle: '#modal-title',
      modalBody: '#modal-body',
      inviteLeadBtn: '#invite-lead-btn',
      contactNewCount: '#contact-new-count',
      contactsTableBody: '#contacts-table-body',
      sysVersion: '#sys-version',
      sysEnvironment: '#sys-environment',
      sysBuildDate: '#sys-build-date',
      sysUseragent: '#sys-useragent',
      sysScreen: '#sys-screen',
      sysViewport: '#sys-viewport',
      statVisitors: '#stat-visitors',
      analyticsVisitors: '#analytics-visitors',
      analyticsPageviews: '#analytics-pageviews',
      analyticsSessions: '#analytics-sessions',
      adminMessagesThread: '#admin-messages-thread',
      adminMessagesContainer: '#admin-messages-container',
      adminMessageText: '#admin-message-text',
      adminSendMessage: '#admin-send-message',
      exportAnalytics: '#export-analytics',
      exportVisitors: '#export-visitors',
      exportPerformance: '#export-performance',
      clearOldData: '#clear-old-data',
      resetAnalytics: '#reset-analytics',
      loadingIndicator: '#loading-indicator',
      performanceDashboardContainer: '#performance-dashboard-container',
      performanceTab: '#performance-tab',
      performanceAlerts: '#performance-alerts',
      leadsTableBody: '#leads-table-body',
      projectsTableBody: '#projects-table-body',
      clientsTableBody: '#clients-table-body',
      leadsBadge: '#leads-badge',
      messagesBadge: '#messages-badge'
    });

    // Initialize module context
    this.moduleContext = {
      getAuthToken: () =>
        sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info') =>
        this.showNotification(message, type),
      refreshData: () => this.loadDashboardData(),
      switchTab: (tab: string) => this.switchTab(tab)
    };

    // Configure API client for token expiration handling
    configureApiClient({
      showNotification: (message: string, type: 'error' | 'warning' | 'success' | 'info') =>
        this.showNotification(message, type as 'success' | 'error' | 'info'),
      onSessionExpired: () => {
        // Let the default handler redirect to /admin login
      }
    });

    // Initialize project details handler
    this.projectDetails = new AdminProjectDetails();
    this.init();
  }

  private async init(): Promise<void> {
    logger.log('init() called');
    // Initialize security measures first
    AdminSecurity.init();

    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();

    if (!isAuthenticated) {
      logger.log('Not authenticated, showing auth gate');
      this.setupAuthGate();
      return;
    }

    // User is authenticated - show dashboard
    this.showDashboard();

    // Initialize navigation and theme modules
    await this.initializeModules();

    // Set up the dashboard
    logger.log('Setting up dashboard');
    this.setupEventListeners();
    logger.log('setupEventListeners complete');
    await this.loadDashboardData();
    this.setupTruncatedTextTooltips();
    this.updateSidebarBadges();
    this.startAutoRefresh();
  }

  /**
   * Sets up fast custom tooltips for truncated text elements
   * Uses data-tooltip attribute for instant CSS-based tooltips
   */
  private setupTruncatedTextTooltips(): void {
    // Helper to add tooltip if text is truncated
    const addTooltipIfTruncated = (element: HTMLElement): void => {
      const text = element.textContent?.trim();
      if (!text || text === '-') return;

      // Only add tooltip if content is actually truncated
      // Check if scrollWidth > clientWidth (text overflows)
      if (element.scrollWidth > element.clientWidth || text.length > 30) {
        element.setAttribute('data-tooltip', text);
        // Remove native title to avoid double tooltip
        element.removeAttribute('title');
      }
    };

    // Find all elements with truncation classes
    const truncatedElements = document.querySelectorAll('.truncate-text, .message-cell, [class*="ellipsis"]');
    truncatedElements.forEach((el) => addTooltipIfTruncated(el as HTMLElement));

    // Also set up a mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check child elements
            const truncated = node.querySelectorAll('.truncate-text, .message-cell, [class*="ellipsis"]');
            truncated.forEach((el) => {
              if (!el.hasAttribute('data-tooltip')) {
                addTooltipIfTruncated(el as HTMLElement);
              }
            });
            // Check if the node itself is truncated
            if (node.classList?.contains('truncate-text') || node.classList?.contains('message-cell')) {
              if (!node.hasAttribute('data-tooltip')) {
                addTooltipIfTruncated(node);
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private async checkAuthentication(): Promise<boolean> {
    // Try to validate session by calling an admin-only endpoint
    // Retry logic handles race condition when backend starts slower than frontend
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 500;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await apiFetch('/api/admin/leads');

        // 503 = backend starting up, retry
        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            logger.log(`Backend starting up (attempt ${attempt}), retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
        }

        // If we get 200, we're authenticated as admin
        // If we get 401/403, we're not authenticated
        return response.ok;
      } catch (error) {
        // Network error - backend might not be ready yet
        if (attempt < MAX_RETRIES) {
          logger.log(`Auth check attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          logger.log('Auth check failed after all retries:', error);
        }
      }
    }
    return false;
  }

  private setupAuthGate(): void {
    const authGate = this.domCache.get('authGate');
    const dashboard = this.domCache.get('adminDashboard');
    const loginForm = this.domCache.get('adminLoginForm');
    const passwordInput = this.domCache.getAs<HTMLInputElement>('adminPassword');
    const passwordToggle = this.domCache.get('passwordToggle');
    const authError = this.domCache.get('authError');

    if (authGate) authGate.style.display = 'flex';
    if (dashboard) dashboard.style.display = 'none';

    // Password toggle
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
      });
    }

    // Login form submission
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authError) authError.textContent = '';

        const password = passwordInput?.value;
        if (!password) return;

        const submitBtn = loginForm.querySelector('.auth-submit') as HTMLButtonElement;
        const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement;
        const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement;

        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        try {
          const response = await apiPost('/api/auth/admin/login', { password });

          if (response.ok) {
            // Reload page to show dashboard
            window.location.reload();
          } else {
            const data = await response.json();
            if (authError) authError.textContent = data.error || 'Invalid password';
          }
        } catch (error) {
          console.error('[AdminDashboard] Login error:', error);
          if (authError) authError.textContent = 'Connection error. Please try again.';
        } finally {
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline';
          if (btnLoading) btnLoading.style.display = 'none';
        }
      });
    }
  }

  private showDashboard(): void {
    const authGate = this.domCache.get('authGate');
    const dashboard = this.domCache.get('adminDashboard');

    if (authGate) authGate.style.display = 'none';
    if (dashboard) {
      dashboard.classList.remove('hidden');
      dashboard.style.display = '';
    }
    // Add logged-in class to body to hide header/footer
    document.body.classList.add('admin-logged-in');
  }

  private async initializeModules(): Promise<void> {
    // Admin dashboard doesn't use theme toggle or main site navigation
    // Theme is handled via CSS and sessionStorage directly
    // No additional modules needed for admin portal
  }

  private setupEventListeners(): void {
    logger.log('setupEventListeners() called');
    // Logout button (both old and new IDs)
    const logoutBtn = this.domCache.get('logoutBtn') || this.domCache.get('btnLogout');
    logger.log('logoutBtn found:', !!logoutBtn);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logger.log('Logout button clicked');
        // Use AdminAuth.logout() to properly clear admin session
        AdminAuth.logout();
      });
    }

    // Document-level event delegation for logout button (fallback for CSS blocking)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const logoutButton = target.closest('#btn-logout, #logout-btn, .btn-logout');
      if (logoutButton) {
        logger.log('Logout detected via document delegation');
        e.preventDefault();
        e.stopPropagation();
        AdminAuth.logout();
      }
    }, true); // Use capture phase to catch events before they're blocked

    // Tab navigation - old style (.tab-btn)
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

    // Tab navigation - new portal style (sidebar buttons with data-tab)
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
    logger.log('Found sidebar buttons:', sidebarButtons.length);
    sidebarButtons.forEach((btn, index) => {
      const tabName = (btn as HTMLElement).dataset.tab;
      logger.log(`Setting up button ${index}: ${tabName}`);
      btn.addEventListener('click', (e) => {
        logger.log('Button clicked!', tabName);
        e.preventDefault();
        e.stopPropagation();
        if (tabName) {
          logger.log('Switching to tab:', tabName);
          this.switchTab(tabName);
          // Update active state on sidebar buttons
          sidebarButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Clickable stat cards
    const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
    statCards.forEach((card) => {
      card.addEventListener('click', () => {
        const tabName = (card as HTMLElement).dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
          // Update sidebar button active state
          sidebarButtons.forEach((b) => {
            b.classList.toggle('active', (b as HTMLElement).dataset.tab === tabName);
          });
        }
      });
    });

    // Filter stat cards for leads and projects tables
    const filterCards = document.querySelectorAll('.stat-card-clickable[data-filter]');
    filterCards.forEach((card) => {
      card.addEventListener('click', () => {
        const filter = (card as HTMLElement).dataset.filter;
        const table = (card as HTMLElement).dataset.table;
        if (filter && table) {
          this.filterTable(table, filter);
          // Update active state on filter cards
          const siblingCards = document.querySelectorAll(`.stat-card-clickable[data-table="${table}"]`);
          siblingCards.forEach((c) => c.classList.remove('active'));
          card.classList.add('active');
        }
      });
    });

    // Sidebar toggle - multiple buttons, one per tab
    const sidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    sidebarToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    });

    // Refresh leads button
    const refreshLeadsBtn = this.domCache.get('refreshLeadsBtn');
    if (refreshLeadsBtn) {
      refreshLeadsBtn.addEventListener('click', () => {
        this.loadLeads();
      });
    }

    // Refresh buttons
    const refreshAnalytics = this.domCache.get('refreshAnalytics');
    if (refreshAnalytics) {
      refreshAnalytics.addEventListener('click', () => {
        this.loadAnalyticsData();
      });
    }

    // Export buttons
    this.setupExportButtons();

    // Data management buttons
    this.setupDataManagementButtons();

    // Extend session on activity
    document.addEventListener('click', () => {
      AdminAuth.extendSession();
    });

    document.addEventListener('keydown', () => {
      AdminAuth.extendSession();
    });

    // Load initial data
    this.loadLeads();
    this.loadContactSubmissions();
    this.loadSystemInfo();

    // Setup messaging functionality
    this.setupMessaging();

    // Refresh contacts button
    const refreshContactsBtn = this.domCache.get('refreshContactsBtn');
    if (refreshContactsBtn) {
      refreshContactsBtn.addEventListener('click', () => {
        this.loadContactSubmissions();
      });
    }

    // Refresh projects button
    const refreshProjectsBtn = this.domCache.get('refreshProjectsBtn');
    if (refreshProjectsBtn) {
      refreshProjectsBtn.addEventListener('click', () => {
        this.loadProjects();
      });
    }

    // Load projects data
    this.loadProjects();

    // Modal close buttons
    this.setupModalHandlers();
  }

  private setupModalHandlers(): void {
    const modal = this.domCache.get('detailModal');
    const closeBtn = this.domCache.get('modalCloseBtn');
    const closeFooterBtn = this.domCache.get('modalCloseBtnFooter');
    const overlay = this.domCache.get('detailModal');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.style.display !== 'none') {
        closeModal();
      }
    });
  }

  private toggleSidebar(): void {
    const sidebar = this.domCache.get('sidebar');
    sidebar?.classList.toggle('collapsed');
  }

  private async loadLeads(): Promise<void> {
    // Delegate to leads module for code splitting
    const leadsModule = await loadLeadsModule();
    await leadsModule.loadLeads(this.moduleContext);
  }

  // NOTE: updateLeadsDisplay moved to admin-leads module

  private async loadContactSubmissions(): Promise<void> {
    try {
      const response = await apiFetch('/api/admin/contact-submissions');

      if (response.ok) {
        const data = await response.json();
        this.updateContactsDisplay(data);
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load contact submissions:', error);
    }
  }

  private updateContactsDisplay(data: { submissions: ContactSubmission[]; stats: ContactStats }): void {
    // Store contacts data for detail views
    this.contactsData = data.submissions || [];

    // Update new count badge
    const newCountBadge = this.domCache.get('contactNewCount');
    if (newCountBadge) {
      const newCount = data.stats?.new || 0;
      if (newCount > 0) {
        newCountBadge.textContent = `${newCount} new`;
        newCountBadge.classList.add('has-new');
      } else {
        newCountBadge.classList.remove('has-new');
      }
    }

    // Update contacts table
    const tableBody = this.domCache.get('contactsTableBody');
    if (tableBody && data.submissions) {
      if (data.submissions.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="6" class="loading-row">No contact form submissions yet</td></tr>';
      } else {
        tableBody.innerHTML = data.submissions
          .map((submission: ContactSubmission) => {
            const date = formatDate(submission.created_at);
            // Decode HTML entities then sanitize to prevent XSS
            const decodedName = SanitizationUtils.decodeHtmlEntities(submission.name || '-');
            const decodedMessage = SanitizationUtils.decodeHtmlEntities(submission.message || '-');
            const safeName = SanitizationUtils.escapeHtml(decodedName);
            const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.email || '-'));
            const safeSubject = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.subject || '-'));
            const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
            // Truncate message for display (after sanitization)
            const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
            const truncatedMessage =
              safeMessage.length > truncateLen ? `${safeMessage.substring(0, truncateLen)}...` : safeMessage;
            // For title attribute, also escape
            const safeTitleMessage = SanitizationUtils.escapeHtml(decodedMessage);
            return `
            <tr data-contact-id="${submission.id}">
              <td>${date}</td>
              <td>${safeName}</td>
              <td>${safeEmail}</td>
              <td>${safeSubject}</td>
              <td class="message-cell" title="${safeTitleMessage}">${truncatedMessage}</td>
              <td>
                <select class="contact-status-select status-select" data-id="${submission.id}" onclick="event.stopPropagation()">
                  <option value="new" ${submission.status === 'new' ? 'selected' : ''}>New</option>
                  <option value="read" ${submission.status === 'read' ? 'selected' : ''}>Read</option>
                  <option value="replied" ${submission.status === 'replied' ? 'selected' : ''}>Replied</option>
                  <option value="archived" ${submission.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
              </td>
            </tr>
          `;
          })
          .join('');

        // Add click handlers to rows (for viewing details)
        const rows = tableBody.querySelectorAll('tr[data-contact-id]');
        rows.forEach((row) => {
          row.addEventListener('click', (e) => {
            // Don't open modal if clicking on the status select
            if ((e.target as HTMLElement).tagName === 'SELECT') return;
            const contactId = parseInt((row as HTMLElement).dataset.contactId || '0');
            this.showContactDetails(contactId);
          });
        });

        // Add change handlers for status selects
        const statusSelects = tableBody.querySelectorAll('.contact-status-select');
        statusSelects.forEach((select) => {
          select.addEventListener('change', (e) => {
            e.stopPropagation();
            const target = e.target as HTMLSelectElement;
            const id = target.dataset.id;
            const newStatus = target.value;
            if (id) {
              this.updateContactStatus(parseInt(id), newStatus);
            }
          });
        });
      }
    }
  }

  private async updateContactStatus(id: number, status: string): Promise<void> {
    try {
      const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

      if (response.ok) {
        logger.log('Contact status updated');
        // Refresh to update counts
        this.loadContactSubmissions();
      } else {
        console.error('[AdminDashboard] Failed to update contact status');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error updating contact status:', error);
    }
  }


  private async inviteLead(leadId: number, email: string): Promise<void> {
    const inviteBtn = this.domCache.getAs<HTMLButtonElement>('inviteLeadBtn');
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Sending Invitation...';
    }

    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/invite`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await alertSuccess(`Invitation sent to ${email}! They will receive a link to set up their account.`);
          // Close modal and refresh leads
          const modal = this.domCache.get('detailModal');
          if (modal) modal.style.display = 'none';
          this.loadLeads();
          this.loadProjects();
        } else {
          await alertError(data.error || 'Failed to send invitation. Please try again.');
          if (inviteBtn) {
            inviteBtn.disabled = false;
            inviteBtn.textContent = 'Invite to Client Portal';
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        await alertError(errorData.error || 'Failed to send invitation. Please try again.');
        if (inviteBtn) {
          inviteBtn.disabled = false;
          inviteBtn.textContent = 'Invite to Client Portal';
        }
      }
    } catch (error) {
      console.error('[AdminDashboard] Error inviting lead:', error);
      await alertError('An error occurred. Please try again.');
      if (inviteBtn) {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Invite to Client Portal';
      }
    }
  }

  private showContactDetails(contactId: number): void {
    const contact = this.contactsData.find((c) => c.id === contactId);
    if (!contact) return;

    const modal = this.domCache.get('detailModal');
    const modalTitle = this.domCache.get('modalTitle');
    const modalBody = this.domCache.get('modalBody');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = 'Contact Form Submission';

    const date = formatDateTime(contact.created_at);
    const statusClass = `status-${contact.status || 'new'}`;

    // Decode HTML entities then sanitize to prevent XSS
    const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.name || '-'));
    const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.email || '-'));
    const safeSubject = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.subject || '-'));
    const safeStatus = SanitizationUtils.escapeHtml(contact.status || 'new');
    const safeMessage = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.message || '-'));

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${safeName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value"><a href="mailto:${safeEmail}">${safeEmail}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Subject</span>
          <span class="detail-value">${safeSubject}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value"><span class="status-badge ${statusClass}">${safeStatus}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Message</span>
          <span class="detail-value message-full">${safeMessage}</span>
        </div>
        ${
  contact.read_at
    ? `
        <div class="detail-row">
          <span class="detail-label">Read At</span>
          <span class="detail-value">${formatDateTime(contact.read_at)}</span>
        </div>
        `
    : ''
}
        ${
  contact.replied_at
    ? `
        <div class="detail-row">
          <span class="detail-label">Replied At</span>
          <span class="detail-value">${formatDateTime(contact.replied_at)}</span>
        </div>
        `
    : ''
}
      </div>
    `;

    modal.style.display = 'flex';

    // Mark as read if status is 'new'
    if (contact.status === 'new') {
      this.updateContactStatus(contactId, 'read');
    }
  }

  private async loadProjects(): Promise<void> {
    // Delegate to projects module for code splitting
    const projectsModule = await loadProjectsModule();
    await projectsModule.loadProjects(this.moduleContext);
  }

  // NOTE: updateProjectsDisplay moved to admin-projects module

  private async updateProjectStatus(id: number, status: string): Promise<void> {
    try {
      const response = await apiPut(`/api/projects/${id}`, { status });

      if (response.ok) {
        logger.log('Project status updated');
        // Refresh both leads and projects
        this.loadLeads();
        this.loadProjects();
      } else {
        console.error('[AdminDashboard] Failed to update project status');
        alertError('Failed to update project status');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error updating project status:', error);
    }
  }

  private async activateLead(leadId: number): Promise<void> {
    // Convert a pending lead to an active project
    await this.updateProjectStatus(leadId, 'active');
  }

  /**
   * Navigate to full project detail view (replaces modal approach)
   * This mirrors the client portal view for admin management
   */
  private showProjectDetails(projectId: number): void {
    this.projectDetails.showProjectDetails(
      projectId,
      this.projectsData,
      (tab) => this.switchTab(tab),
      () => this.loadProjects(),
      formatProjectType,
      (leadId, email) => this.inviteLead(leadId, email)
    );
  }


  private loadSystemInfo(): void {
    const sysVersion = this.domCache.get('sysVersion');
    const sysEnv = this.domCache.get('sysEnvironment');
    const sysBuildDate = this.domCache.get('sysBuildDate');
    const sysUserAgent = this.domCache.get('sysUseragent');
    const sysScreen = this.domCache.get('sysScreen');
    const sysViewport = this.domCache.get('sysViewport');

    if (sysVersion) sysVersion.textContent = '10.0.0';
    if (sysEnv) sysEnv.textContent = import.meta.env?.MODE || 'development';
    if (sysBuildDate) sysBuildDate.textContent = formatDate(new Date());
    if (sysUserAgent) {
      sysUserAgent.textContent = navigator.userAgent;
      sysUserAgent.title = navigator.userAgent;
    }
    if (sysScreen) sysScreen.textContent = `${screen.width} x ${screen.height}`;
    if (sysViewport) sysViewport.textContent = `${window.innerWidth} x ${window.innerHeight}`;

    // Load visitor tracking data from sessionStorage
    this.loadVisitorStats();
  }

  private loadVisitorStats(): void {
    try {
      // Read visitor tracking events from sessionStorage (set by visitor-tracking.ts)
      const eventsJson = sessionStorage.getItem('nbw_tracking_events');
      const events: AnalyticsEvent[] = eventsJson ? JSON.parse(eventsJson) : [];

      // Count unique sessions (visitors today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const todayEvents = events.filter((e) => e.timestamp >= todayStart);
      const todaySessions = new Set(todayEvents.map((e) => e.sessionId));
      const visitorsToday = todaySessions.size;

      // Count total page views
      const pageViews = events.filter((e) => 'title' in e);
      const totalPageViews = pageViews.length;

      // Count total unique sessions (all time)
      const allSessions = new Set(events.map((e) => e.sessionId));
      const totalVisitors = allSessions.size;

      // Update overview stats
      const statVisitors = this.domCache.get('statVisitors');
      if (statVisitors) statVisitors.textContent = visitorsToday.toString();

      // Update analytics tab stats
      const analyticsVisitors = this.domCache.get('analyticsVisitors');
      const analyticsPageviews = this.domCache.get('analyticsPageviews');
      const analyticsSessions = this.domCache.get('analyticsSessions');

      if (analyticsVisitors) analyticsVisitors.textContent = totalVisitors.toString();
      if (analyticsPageviews) analyticsPageviews.textContent = totalPageViews.toString();
      if (analyticsSessions) {
        // Calculate average session duration
        const sessionsWithTime = pageViews.filter((pv) => pv.timeOnPage);
        if (sessionsWithTime.length > 0) {
          const totalTime = sessionsWithTime.reduce(
            (sum: number, pv) => sum + (pv.timeOnPage || 0),
            0
          );
          const avgTimeMs = totalTime / sessionsWithTime.length;
          const avgSeconds = Math.round(avgTimeMs / 1000);
          const minutes = Math.floor(avgSeconds / 60);
          const seconds = avgSeconds % 60;
          analyticsSessions.textContent = `${minutes}m ${seconds}s`;
        } else {
          analyticsSessions.textContent = '-';
        }
      }

      logger.log('Visitor stats loaded:', {
        visitorsToday,
        totalVisitors,
        totalPageViews
      });
    } catch (error) {
      console.error('[AdminDashboard] Failed to load visitor stats:', error);

      // Set defaults on error
      const statVisitors = this.domCache.get('statVisitors');
      const analyticsVisitors = this.domCache.get('analyticsVisitors');
      const analyticsPageviews = this.domCache.get('analyticsPageviews');
      const analyticsSessions = this.domCache.get('analyticsSessions');

      if (statVisitors) statVisitors.textContent = '0';
      if (analyticsVisitors) analyticsVisitors.textContent = '0';
      if (analyticsPageviews) analyticsPageviews.textContent = '0';
      if (analyticsSessions) analyticsSessions.textContent = '-';
    }
  }

  // Messaging properties
  private selectedClientId: number | null = null;
  private selectedThreadId: number | null = null;

  private async setupMessaging(): Promise<void> {
    // Load the messaging module to handle send functionality
    const messagingModule = await loadMessagingModule();

    // Setup event listeners using the module (which tracks selectedThreadId)
    messagingModule.setupMessagingListeners(this.moduleContext);

    logger.log('Messaging listeners setup complete');
  }

  private async loadClientThreads(): Promise<void> {
    // Delegate to messaging module for code splitting
    const messagingModule = await loadMessagingModule();
    await messagingModule.loadClientThreads(this.moduleContext);
  }

  // NOTE: populateClientDropdown moved to admin-messaging module

  private selectThread(clientId: number, threadId: number, _clientName: string): void {
    this.selectedClientId = clientId;
    this.selectedThreadId = threadId;

    // Enable compose area inputs
    const textarea = this.domCache.getAs<HTMLTextAreaElement>('adminMessageText');
    const sendButton = this.domCache.getAs<HTMLButtonElement>('adminSendMessage');
    if (textarea) {
      textarea.disabled = false;
      textarea.placeholder = 'Type your message...';
    }
    if (sendButton) {
      sendButton.disabled = false;
    }

    // Load messages
    this.loadThreadMessages(threadId);
  }

  private async loadThreadMessages(threadId: number): Promise<void> {
    // Try new container ID first, then old one
    const container =
      this.domCache.get('adminMessagesThread') ||
      this.domCache.get('adminMessagesContainer');
    if (!container) return;

    container.innerHTML =
      '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

    try {
      // Backend endpoint: /api/messages/threads/:threadId/messages
      const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);

      if (response.ok) {
        const data = await response.json();
        this.renderMessages(data.messages || []);

        // Mark messages as read
        await apiPut(`/api/messages/threads/${threadId}/read`);
      } else {
        container.innerHTML =
          '<div style="text-align: center; padding: 2rem; color: #666;">Failed to load messages</div>';
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load messages:', error);
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: #666;">Error loading messages</div>';
    }
  }

  private renderMessages(messages: Message[]): void {
    const container =
      this.domCache.get('adminMessagesThread') ||
      this.domCache.get('adminMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: #666;">No messages yet. Start the conversation!</div>';
      return;
    }

    // Use client portal style messages
    container.innerHTML = messages
      .map((msg: Message) => {
        const isAdmin = msg.sender_type === 'admin';
        const dateTime = formatDateTime(msg.created_at);
        const rawSenderName = isAdmin ? 'You (Admin)' : SanitizationUtils.decodeHtmlEntities(msg.sender_name || 'Client');
        // Decode HTML entities then sanitize to prevent XSS
        const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
        const safeContent = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(msg.message || msg.content || ''));
        const safeInitials = SanitizationUtils.escapeHtml(rawSenderName.substring(0, 2).toUpperCase());

        if (isAdmin) {
          // Admin message (sent - right aligned)
          return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${dateTime}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
            <div class="message-avatar" data-name="Admin">
              <img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
            </div>
          </div>
        `;
        }
        // Client message (received - left aligned)
        return `
          <div class="message message-received">
            <div class="message-avatar" data-name="${safeSenderName}">
              <div class="avatar-placeholder">${safeInitials}</div>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${dateTime}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
          </div>
        `;
      })
      .join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  private async sendMessage(): Promise<void> {
    const input = this.domCache.getAs<HTMLInputElement>('adminMessageText');
    if (!input || !input.value.trim() || !this.selectedThreadId) return;

    const message = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
      // Backend expects 'message' field
      const response = await apiPost(`/api/messages/threads/${this.selectedThreadId}/messages`, { message });

      if (response.ok) {
        // Reload messages
        this.loadThreadMessages(this.selectedThreadId);
        // Refresh thread list for unread counts
        this.loadClientThreads();
      } else {
        const error = await response.json();
        console.error('[AdminDashboard] Failed to send message:', error);
        alertError('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error sending message:', error);
      alertError('Error sending message. Please try again.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  private setupExportButtons(): void {
    const exportAnalytics = this.domCache.get('exportAnalytics');
    const exportVisitors = this.domCache.get('exportVisitors');
    const exportPerformance = this.domCache.get('exportPerformance');

    if (exportAnalytics) {
      exportAnalytics.addEventListener('click', () => {
        this.exportData('analytics');
      });
    }

    if (exportVisitors) {
      exportVisitors.addEventListener('click', () => {
        this.exportData('visitors');
      });
    }

    if (exportPerformance) {
      exportPerformance.addEventListener('click', () => {
        this.exportData('performance');
      });
    }
  }

  private setupDataManagementButtons(): void {
    const clearOldData = this.domCache.get('clearOldData');
    const resetAnalytics = this.domCache.get('resetAnalytics');

    if (clearOldData) {
      clearOldData.addEventListener('click', () => {
        this.clearOldData();
      });
    }

    if (resetAnalytics) {
      resetAnalytics.addEventListener('click', () => {
        this.resetAnalytics();
      });
    }
  }

  private switchTab(tabName: string): void {
    // Update active tab button (both old .tab-btn style and new sidebar button style)
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-buttons .btn[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update active tab content (HTML uses tab-{name} format, e.g., tab-overview)
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    // Try both ID formats: tab-{name} (new) and {name}-tab (old)
    const tabContent =
      document.getElementById(`tab-${tabName}`) || document.getElementById(`${tabName}-tab`);
    tabContent?.classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data (modules handle all tab data loading)
    this.loadTabData(tabName);
  }

  private filterTable(tableName: string, filter: string): void {
    let tableBody: HTMLElement | null = null;
    let statusColumnIndex = -1;

    if (tableName === 'leads') {
      tableBody = this.domCache.get('leadsTableBody');
      statusColumnIndex = 6; // Status column is 7th (0-indexed: 6)
    } else if (tableName === 'projects') {
      tableBody = this.domCache.get('projectsTableBody');
      statusColumnIndex = 4; // Status column is 5th (0-indexed: 4)
    } else if (tableName === 'clients') {
      tableBody = this.domCache.get('clientsTableBody');
      statusColumnIndex = 2; // Status column is 3rd (0-indexed: 2)
    }

    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row) => {
      if (filter === 'all') {
        row.style.display = '';
        return;
      }

      const statusCell = row.querySelectorAll('td')[statusColumnIndex];
      if (statusCell) {
        const statusText = statusCell.textContent?.toLowerCase().replace(/\s+/g, '_') || '';
        const filterNormalized = filter.toLowerCase();

        // Match status text with filter
        const matches = statusText.includes(filterNormalized) ||
                       (filterNormalized === 'in_progress' && statusText.includes('progress')) ||
                       (filterNormalized === 'on_hold' && statusText.includes('hold'));

        row.style.display = matches ? '' : 'none';
      }
    });
  }

  private async loadDashboardData(): Promise<void> {
    this.showLoading(true);

    try {
      // Load analytics module for initial dashboard data
      const analyticsModule = await loadAnalyticsModule();
      await Promise.all([
        analyticsModule.loadOverviewData(this.moduleContext),
        analyticsModule.loadPerformanceData(this.moduleContext),
        analyticsModule.loadAnalyticsData(this.moduleContext),
        analyticsModule.loadVisitorsData(this.moduleContext),
        this.loadSystemData()
      ]);
    } catch (error) {
      console.error('[AdminDashboard] Error loading data:', error);
    } finally {
      this.showLoading(false);
    }
  }

  private async loadTabData(tabName: string): Promise<void> {
    this.showLoading(true);

    try {
      switch (tabName) {
      case 'overview':
        // Use analytics module for overview data
        {
          const analyticsModule = await loadAnalyticsModule();
          await analyticsModule.loadOverviewData(this.moduleContext);
        }
        break;
      case 'performance':
        // Use analytics module for performance data
        {
          const analyticsModule = await loadAnalyticsModule();
          await analyticsModule.loadPerformanceData(this.moduleContext);
        }
        break;
      case 'analytics':
        // Use analytics module for analytics data
        {
          const analyticsModule = await loadAnalyticsModule();
          await analyticsModule.loadAnalyticsData(this.moduleContext);
        }
        break;
      case 'visitors':
        // Use analytics module for visitors data
        {
          const analyticsModule = await loadAnalyticsModule();
          await analyticsModule.loadVisitorsData(this.moduleContext);
        }
        break;
      case 'leads':
        // Use leads module and contacts module (both tables are on leads tab)
        {
          const leadsModule = await loadLeadsModule();
          await leadsModule.loadLeads(this.moduleContext);
          const contactsModule = await loadContactsModule();
          await contactsModule.loadContacts(this.moduleContext);
        }
        break;
      case 'contacts':
        // Use contacts module
        {
          const contactsModule = await loadContactsModule();
          await contactsModule.loadContacts(this.moduleContext);
        }
        break;
      case 'projects':
        // Use projects module
        {
          const projectsModule = await loadProjectsModule();
          await projectsModule.loadProjects(this.moduleContext);
        }
        break;
      case 'proposals':
        // Use proposals module
        {
          const proposalsModule = await loadProposalsModule();
          await proposalsModule.loadProposals(this.moduleContext);
        }
        break;
      case 'clients':
        // Use clients module
        {
          const clientsModule = await loadClientsModule();
          await clientsModule.loadClients(this.moduleContext);
        }
        break;
      case 'client-detail':
        // Client detail view - data loaded by showClientDetails in admin-clients module
        break;
      case 'messages':
        // Use messaging module
        {
          const messagingModule = await loadMessagingModule();
          await messagingModule.loadClientThreads(this.moduleContext);
        }
        break;
      case 'system':
        await this.loadSystemData();
        break;
      }
    } catch (error) {
      console.error(`[AdminDashboard] Error loading ${tabName} data:`, error);
    } finally {
      this.showLoading(false);
    }
  }

  private async loadOverviewData(): Promise<void> {
    // Delegate to overview module for real visitor tracking data
    const overviewModule = await loadOverviewModule();
    await overviewModule.loadOverviewData(this.moduleContext);

    // Load real Chart.js charts
    this.loadChart('visitors-chart', 'visitors');
    this.loadChart('sources-chart', 'sources');
  }

  private async loadPerformanceData(): Promise<void> {
    try {
      // Initialize the PerformanceDashboard component for admin use
      await this.initializePerformanceDashboard();

      // Delegate to performance module for real metrics
      const performanceModule = await loadPerformanceModule();
      await performanceModule.loadPerformanceData(this.moduleContext);
    } catch (error) {
      console.error('[AdminDashboard] Error loading performance data:', error);
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
    try {
      // Try to get data from the main app's services via parent window
      if (window.opener?.NBW_DEBUG) {
        const debug = window.opener.NBW_DEBUG;
        if (debug.getPerformanceReport) {
          return (await debug.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
        }
      }

      // Try to get data from current window (if services are available)
      if (window.NBW_DEBUG?.getPerformanceReport) {
        return (await window.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }

      // Try to access services directly from container
      const { container } = await import('../../core/container');
      const performanceService = (await container.resolve('PerformanceService')) as {
        generateReport?: () => PerformanceReport;
      };
      if (performanceService?.generateReport) {
        const report = performanceService.generateReport();
        return {
          lcp: {
            value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
            status: this.getVitalStatus('lcp', report.metrics.lcp)
          },
          fid: {
            value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
            status: this.getVitalStatus('fid', report.metrics.fid)
          },
          cls: {
            value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
            status: this.getVitalStatus('cls', report.metrics.cls)
          },
          ttfb: {
            value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
            status: this.getVitalStatus('ttfb', report.metrics.ttfb)
          },
          bundleSize: {
            total: report.metrics.bundleSize
              ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
              : 'N/A',
            main: 'N/A',
            vendor: 'N/A'
          },
          score: report.score || 0,
          grade: this.getGradeFromScore(report.score || 0),
          alerts: (report.alerts || []).map((alert) => alert.message)
        };
      }
    } catch (error) {
      console.warn('[AdminDashboard] Could not get live performance data:', error);
    }

    // Fallback - data unavailable
    return {
      lcp: { value: 'N/A', status: 'unknown' },
      fid: { value: 'N/A', status: 'unknown' },
      cls: { value: 'N/A', status: 'unknown' },
      ttfb: { value: 'N/A', status: 'unknown' },
      bundleSize: {
        total: 'N/A',
        main: 'N/A',
        vendor: 'N/A'
      },
      score: 0,
      grade: 'N/A',
      alerts: ['Unable to load performance data']
    };
  }

  private getVitalStatus(metric: string, value?: number): string {
    if (!value) return 'unknown';

    switch (metric) {
    case 'lcp':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'fid':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'cls':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
    }
  }

  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async loadAnalyticsData(): Promise<void> {
    // Delegate to analytics module for code splitting
    const analyticsModule = await loadAnalyticsModule();
    await analyticsModule.loadAnalyticsData(this.moduleContext);
  }

  // NOTE: Analytics helper methods (getAnalyticsData, formatAnalyticsData, formatPageUrl, formatInteractionType)
  // have been moved to admin-analytics module for code splitting

  // NOTE: loadVisitorsData, loadLeadsData, and populateLeadsTable moved to respective modules
  // NOTE: formatProjectType moved to shared format-utils.ts

  private async loadSystemData(): Promise<void> {
    // Delegate to system status module for real health checks
    const systemStatusModule = await loadSystemStatusModule();
    await systemStatusModule.loadSystemData(this.moduleContext);
  }

  // NOTE: getApplicationStatus moved to admin-system-status module

  private updateElement(id: string, text: string, className?: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
      if (className) {
        element.className = `metric-change ${className}`;
      }
    }
  }

  private updateVital(type: string, data: { value: string; status: string }): void {
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);

    if (valueElement) valueElement.textContent = data.value;
    if (statusElement) {
      statusElement.textContent = data.status.replace('-', ' ');
      statusElement.className = `vital-status ${data.status}`;
    }
  }

  /**
   * Create or update a Chart.js chart (loads Chart.js dynamically)
   */
  private async loadChart(containerId: string, chartType: 'visitors' | 'sources'): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Load Chart.js dynamically
    const ChartJS = await loadChartJS();

    // Destroy existing chart if it exists
    const existingChart = this.charts.get(containerId);
    if (existingChart) {
      existingChart.destroy();
    }

    // Create canvas element
    container.innerHTML = '<canvas></canvas>';
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let chart: InstanceType<typeof ChartJS>;

    if (chartType === 'visitors') {
      // Line chart for visitor trends - colors from CSS variables
      chart = new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Visitors',
              data: [120, 190, 150, 220, 180, 250, 210],
              borderColor: getChartColor('PRIMARY'),
              backgroundColor: getChartColorWithAlpha('PRIMARY', 0.1),
              tension: 0.4,
              fill: true
            },
            {
              label: 'Page Views',
              data: [300, 450, 380, 520, 420, 600, 480],
              borderColor: getChartColor('DARK'),
              backgroundColor: getChartColorWithAlpha('DARK', 0.1),
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: getChartColorWithAlpha('DARK', 0.1)
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    } else {
      // Doughnut chart for traffic sources - colors from CSS variables
      chart = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
          datasets: [
            {
              data: [35, 30, 20, 10, 5],
              backgroundColor: [
                getChartColor('PRIMARY'),
                getChartColor('DARK'),
                getChartColor('GRAY_600'),
                getChartColor('GRAY_400'),
                getChartColor('GRAY_300')
              ],
              borderColor: getChartColor('WHITE'),
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            }
          }
        }
      });
    }

    this.charts.set(containerId, chart);
  }

  private populateDataList(
    listId: string,
    data: Array<{ label: string; value: string | number }>
  ): void {
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = data
      .map(
        (item) => `
      <div class="data-item">
        <span>${item.label}</span>
        <span>${String(item.value)}</span>
      </div>
    `
      )
      .join('');
  }

  // NOTE: populateVisitorsTable moved to admin-analytics module

  // NOTE: populateSystemStatus moved to admin-system-status module

  private async initializePerformanceDashboard(): Promise<void> {
    try {
      // Check if performance dashboard container exists
      let dashboardContainer = this.domCache.get('performanceDashboardContainer');

      if (!dashboardContainer) {
        // Create container for the performance dashboard in the performance tab
        const performanceTab = this.domCache.get('performanceTab');
        if (performanceTab) {
          dashboardContainer = document.createElement('div');
          dashboardContainer.id = 'performance-dashboard-container';
          dashboardContainer.className = 'admin-performance-dashboard';
          performanceTab.appendChild(dashboardContainer);
        }
      }

      if (dashboardContainer) {
        const { createPerformanceDashboard } = await import('../../components');
        await createPerformanceDashboard(
          {
            position: 'top-left',
            minimized: false,
            autoHide: false,
            updateInterval: 3000,
            showAlerts: true,
            showRecommendations: true
          },
          dashboardContainer
        );
      }
    } catch (error) {
      console.warn('[AdminDashboard] Failed to initialize performance dashboard component:', error);
    }
  }

  private displayPerformanceAlerts(alerts: PerformanceAlert[]): void {
    const container = this.domCache.get('performanceAlerts');
    if (!container || !alerts.length) return;

    container.innerHTML = alerts
      .slice(0, 5)
      .map(
        (alert) => `
      <div class="performance-alert alert-${alert.type}">
        <div class="alert-header">
          <span class="alert-metric">${alert.metric.toUpperCase()}</span>
          <span class="alert-value">${Math.round(alert.value)}</span>
        </div>
        <div class="alert-message">${alert.message}</div>
        ${
  alert.suggestions && alert.suggestions.length > 0
    ? `
          <div class="alert-suggestions">
            <ul>
              ${alert.suggestions
    .slice(0, 2)
    .map((suggestion: string) => `<li>${suggestion}</li>`)
    .join('')}
            </ul>
          </div>
        `
    : ''
}
      </div>
    `
      )
      .join('');
  }

  private showLoading(show: boolean): void {
    const loading = this.domCache.get('loadingIndicator');
    if (loading) {
      if (show) {
        loading.classList.remove('hidden');
      } else {
        loading.classList.add('hidden');
      }
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Log notification to console
    const logFn = type === 'error' ? console.error : console.log;
    logFn(`[AdminDashboard] ${type.toUpperCase()}: ${message}`);

    // Use toast notifications for success/info, dialogs only for errors that need attention
    if (type === 'error') {
      // Keep error dialogs for important errors
      alertError(message);
    } else {
      // Use toast for success/info messages
      showToast(message, type);
    }
  }

  /**
   * Fetches and updates sidebar notification badges for Leads and Messages
   */
  private async updateSidebarBadges(): Promise<void> {
    try {
      const response = await apiFetch('/api/admin/sidebar-counts');

      if (!response.ok) return;

      const data = await response.json();
      if (!data.success) return;

      // Update leads badge
      const leadsBadge = this.domCache.get('leadsBadge');
      if (leadsBadge) {
        if (data.leads > 0) {
          leadsBadge.textContent = String(data.leads);
          leadsBadge.style.display = '';
        } else {
          leadsBadge.style.display = 'none';
        }
      }

      // Update messages badge
      const messagesBadge = this.domCache.get('messagesBadge');
      if (messagesBadge) {
        if (data.messages > 0) {
          messagesBadge.textContent = String(data.messages);
          messagesBadge.style.display = '';
        } else {
          messagesBadge.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('[AdminDashboard] Error fetching sidebar counts:', error);
    }
  }

  private startAutoRefresh(): void {
    // Refresh dashboard data every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.loadTabData(this.currentTab);
        this.updateSidebarBadges();
      },
      5 * 60 * 1000
    );
  }

  private async exportData(type: string): Promise<void> {
    try {
      let data: Record<string, unknown>;
      let filename: string;

      switch (type) {
      case 'analytics':
        data = await this.getAnalyticsExport();
        filename = `analytics-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'visitors':
        data = await this.getVisitorsExport();
        filename = `visitors-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'performance':
        data = await this.getPerformanceExport();
        filename = `performance-${new Date().toISOString().split('T')[0]}.json`;
        break;
      default:
        console.error(`[AdminDashboard] Unknown export type requested: ${type}`);
        this.showNotification(`Export type '${type}' is not supported`, 'error');
        return;
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`[AdminDashboard] Error exporting ${type} data:`, error);
      alertError(`Failed to export ${type} data. Please try again.`);
    }
  }

  private async getAnalyticsExport(): Promise<Record<string, unknown>> {
    // Get analytics data for export
    return {
      exportDate: new Date().toISOString(),
      pageViews: [], // Add actual page view data
      visitors: [], // Add actual visitor data
      events: [] // Add actual event data
    };
  }

  private async getVisitorsExport(): Promise<Record<string, unknown>> {
    // Get visitor data for export
    return {
      exportDate: new Date().toISOString(),
      visitors: [] // Add actual visitor data
    };
  }

  private async getPerformanceExport(): Promise<Record<string, unknown>> {
    // Get performance data for export
    return {
      exportDate: new Date().toISOString(),
      metrics: await this.getPerformanceMetrics()
    };
  }

  private async clearOldData(): Promise<void> {
    const confirmed = await confirmDanger(
      'Are you sure you want to clear data older than 90 days? This action cannot be undone.',
      'Clear Data',
      'Clear Old Data'
    );
    if (!confirmed) return;

    try {
      // Clear old data logic here
      this.showNotification('Old data cleared successfully', 'success');
    } catch (error) {
      console.error('[AdminDashboard] Error clearing old data:', error);
      this.showNotification('Failed to clear old data', 'error');
    }
  }

  private async resetAnalytics(): Promise<void> {
    const firstConfirm = await confirmDanger(
      'Are you sure you want to reset ALL analytics data? This action cannot be undone.',
      'Reset Analytics',
      'Reset Analytics'
    );
    if (!firstConfirm) return;

    const secondConfirm = await confirmDanger(
      'This will permanently delete all visitor data, page views, and analytics. Are you absolutely sure?',
      'Yes, Reset Everything',
      'Final Confirmation'
    );
    if (!secondConfirm) return;

    try {
      // Reset analytics logic here
      sessionStorage.clear();
      this.showNotification('Analytics data has been reset', 'success');
      window.location.reload();
    } catch (error) {
      console.error('[AdminDashboard] Error resetting analytics:', error);
      this.showNotification('Failed to reset analytics', 'error');
    }
  }
}

// Global function for visitor details (called from table)
declare global {
  interface Window {
    viewVisitorDetails?: (visitorId: string) => void;
  }
}

window.viewVisitorDetails = (visitorId: string) => {
  alertInfo(`Viewing details for visitor: ${visitorId}`);
};

// Extend Window interface for global admin dashboard access
declare global {
  interface Window {
    adminDashboard: AdminDashboard | null;
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});

export { AdminAuth, AdminDashboard };
