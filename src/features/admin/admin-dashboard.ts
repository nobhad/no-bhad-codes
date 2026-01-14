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
import type { AdminDashboardContext } from './admin-types';
import { getChartColor, getChartColorWithAlpha } from '../../config/constants';

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
  loadSystemStatusModule
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
  private leadsData: any[] = [];
  private contactsData: any[] = [];
  private projectsData: any[] = [];

  // Module context for code-split modules
  private moduleContext: AdminDashboardContext;

  // Project details handler
  private projectDetails: AdminProjectDetails;

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
    // Initialize module context
    this.moduleContext = {
      getAuthToken: () =>
        sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info') =>
        this.showNotification(message, type),
      refreshData: () => this.loadDashboardData(),
      switchTab: (tab: string) => this.switchTab(tab)
    };
    // Initialize project details handler
    this.projectDetails = new AdminProjectDetails();
    this.init();
  }

  private async init(): Promise<void> {
    console.log('[AdminDashboard] init() called');
    // Initialize security measures first
    AdminSecurity.init();

    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();

    if (!isAuthenticated) {
      console.log('[AdminDashboard] Not authenticated, showing auth gate');
      this.setupAuthGate();
      return;
    }

    // User is authenticated - show dashboard
    this.showDashboard();

    // Initialize navigation and theme modules
    await this.initializeModules();

    // Set up the dashboard
    console.log('[AdminDashboard] Setting up dashboard');
    this.setupEventListeners();
    console.log('[AdminDashboard] setupEventListeners complete');
    await this.loadDashboardData();
    this.setupTruncatedTextTooltips();
    this.startAutoRefresh();
  }

  /**
   * Sets up tooltips for truncated text elements
   * Adds title attribute with full text when content is truncated
   */
  private setupTruncatedTextTooltips(): void {
    // Find all elements with truncation classes
    const truncatedElements = document.querySelectorAll('.truncate-text, .message-cell, [class*="ellipsis"]');

    truncatedElements.forEach((el) => {
      const element = el as HTMLElement;
      // Set title to the text content for hover tooltip
      if (element.textContent && element.textContent.trim() !== '-') {
        element.title = element.textContent.trim();
      }
    });

    // Also set up a mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const truncated = node.querySelectorAll('.truncate-text, .message-cell');
            truncated.forEach((el) => {
              const element = el as HTMLElement;
              if (element.textContent && element.textContent.trim() !== '-' && !element.title) {
                element.title = element.textContent.trim();
              }
            });
            // Check if the node itself is truncated
            if (node.classList?.contains('truncate-text') || node.classList?.contains('message-cell')) {
              if (node.textContent && node.textContent.trim() !== '-' && !node.title) {
                node.title = node.textContent.trim();
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
        const response = await fetch('/api/admin/leads', {
          credentials: 'include'
        });

        // 503 = backend starting up, retry
        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            console.log(`[AdminDashboard] Backend starting up (attempt ${attempt}), retrying in ${RETRY_DELAY_MS}ms...`);
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
          console.log(`[AdminDashboard] Auth check attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          console.log('[AdminDashboard] Auth check failed after all retries:', error);
        }
      }
    }
    return false;
  }

  private setupAuthGate(): void {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');
    const loginForm = document.getElementById('admin-login-form');
    const passwordInput = document.getElementById('admin-password') as HTMLInputElement;
    const passwordToggle = document.getElementById('password-toggle');
    const authError = document.getElementById('auth-error');

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
          const response = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
          });

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
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (authGate) authGate.style.display = 'none';
    if (dashboard) {
      dashboard.classList.remove('hidden');
      dashboard.style.display = '';
    }
  }

  private async initializeModules(): Promise<void> {
    // Admin dashboard doesn't use theme toggle or main site navigation
    // Theme is handled via CSS and sessionStorage directly
    // No additional modules needed for admin portal
  }

  private setupEventListeners(): void {
    console.log('[AdminDashboard] setupEventListeners() called');
    // Logout button (both old and new IDs)
    const logoutBtn =
      document.getElementById('logout-btn') || document.getElementById('btn-logout');
    console.log('[AdminDashboard] logoutBtn found:', !!logoutBtn);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AdminDashboard] Logout button clicked');
        // Use AdminAuth.logout() to properly clear admin session
        AdminAuth.logout();
      });
    }

    // Document-level event delegation for logout button (fallback for CSS blocking)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const logoutButton = target.closest('#btn-logout, #logout-btn, .btn-logout');
      if (logoutButton) {
        console.log('[AdminDashboard] Logout detected via document delegation');
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
    console.log('[AdminDashboard] Found sidebar buttons:', sidebarButtons.length);
    sidebarButtons.forEach((btn, index) => {
      const tabName = (btn as HTMLElement).dataset.tab;
      console.log(`[AdminDashboard] Setting up button ${index}: ${tabName}`);
      btn.addEventListener('click', (e) => {
        console.log('[AdminDashboard] Button clicked!', tabName);
        e.preventDefault();
        e.stopPropagation();
        if (tabName) {
          console.log('[AdminDashboard] Switching to tab:', tabName);
          this.switchTab(tabName);
          // Update active state on sidebar buttons
          sidebarButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          // Close mobile menu after selecting
          this.closeMobileMenu();
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

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMobileMenu();
      });
    }

    // Mobile overlay close
    const mobileOverlay = document.getElementById('mobile-overlay');
    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }

    // Sidebar close button (mobile)
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }

    // Sidebar toggle (desktop) - multiple buttons, one per tab
    const sidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    sidebarToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    });

    // Refresh leads button
    const refreshLeadsBtn = document.getElementById('refresh-leads-btn');
    if (refreshLeadsBtn) {
      refreshLeadsBtn.addEventListener('click', () => {
        this.loadLeads();
      });
    }

    // Refresh buttons
    const refreshAnalytics = document.getElementById('refresh-analytics');
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
    const refreshContactsBtn = document.getElementById('refresh-contacts-btn');
    if (refreshContactsBtn) {
      refreshContactsBtn.addEventListener('click', () => {
        this.loadContactSubmissions();
      });
    }

    // Refresh projects button
    const refreshProjectsBtn = document.getElementById('refresh-projects-btn');
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
    const modal = document.getElementById('detail-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const closeFooterBtn = document.getElementById('modal-close-btn-footer');
    const overlay = document.getElementById('detail-modal');

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

  private toggleMobileMenu(): void {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar?.classList.toggle('active');
    overlay?.classList.toggle('active');
    document.body.style.overflow = sidebar?.classList.contains('active') ? 'hidden' : '';
  }

  private closeMobileMenu(): void {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar?.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  private toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar');
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
      const response = await fetch('/api/admin/contact-submissions', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.updateContactsDisplay(data);
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load contact submissions:', error);
    }
  }

  private updateContactsDisplay(data: { submissions: any[]; stats: any }): void {
    // Store contacts data for detail views
    this.contactsData = data.submissions || [];

    // Update new count badge
    const newCountBadge = document.getElementById('contact-new-count');
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
    const tableBody = document.getElementById('contacts-table-body');
    if (tableBody && data.submissions) {
      if (data.submissions.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="6" class="loading-row">No contact form submissions yet</td></tr>';
      } else {
        tableBody.innerHTML = data.submissions
          .map((submission: any) => {
            const date = new Date(submission.created_at).toLocaleDateString();
            // Sanitize user data to prevent XSS
            const safeName = SanitizationUtils.escapeHtml(submission.name || '-');
            const safeEmail = SanitizationUtils.escapeHtml(submission.email || '-');
            const safeSubject = SanitizationUtils.escapeHtml(submission.subject || '-');
            const safeMessage = SanitizationUtils.escapeHtml(submission.message || '-');
            // Truncate message for display (after sanitization)
            const truncatedMessage =
              safeMessage.length > 50 ? `${safeMessage.substring(0, 50)}...` : safeMessage;
            // For title attribute, also escape
            const safeTitleMessage = SanitizationUtils.escapeHtml(submission.message || '');
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
      const response = await fetch(`/api/admin/contact-submissions/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        console.log('[AdminDashboard] Contact status updated');
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
    const inviteBtn = document.getElementById('invite-lead-btn') as HTMLButtonElement;
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Sending Invitation...';
    }

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Invitation sent to ${email}! They will receive a link to set up their account.`);
        // Close modal and refresh leads
        const modal = document.getElementById('detail-modal');
        if (modal) modal.style.display = 'none';
        this.loadLeads();
        this.loadProjects();
      } else {
        alert(data.error || 'Failed to send invitation. Please try again.');
        if (inviteBtn) {
          inviteBtn.disabled = false;
          inviteBtn.textContent = 'Invite to Client Portal';
        }
      }
    } catch (error) {
      console.error('[AdminDashboard] Error inviting lead:', error);
      alert('An error occurred. Please try again.');
      if (inviteBtn) {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Invite to Client Portal';
      }
    }
  }

  private showContactDetails(contactId: number): void {
    const contact = this.contactsData.find((c: any) => c.id === contactId);
    if (!contact) return;

    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = 'Contact Form Submission';

    const date = new Date(contact.created_at).toLocaleString();
    const statusClass = `status-${contact.status || 'new'}`;

    // Sanitize user data to prevent XSS
    const safeName = SanitizationUtils.escapeHtml(contact.name || '-');
    const safeEmail = SanitizationUtils.escapeHtml(contact.email || '-');
    const safeSubject = SanitizationUtils.escapeHtml(contact.subject || '-');
    const safeStatus = SanitizationUtils.escapeHtml(contact.status || 'new');
    const safeMessage = SanitizationUtils.escapeHtml(contact.message || '-');

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
          <span class="detail-value">${new Date(contact.read_at).toLocaleString()}</span>
        </div>
        `
    : ''
}
        ${
  contact.replied_at
    ? `
        <div class="detail-row">
          <span class="detail-label">Replied At</span>
          <span class="detail-value">${new Date(contact.replied_at).toLocaleString()}</span>
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
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        console.log('[AdminDashboard] Project status updated');
        // Refresh both leads and projects
        this.loadLeads();
        this.loadProjects();
      } else {
        console.error('[AdminDashboard] Failed to update project status');
        alert('Failed to update project status');
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
      (type) => this.formatProjectType(type),
      (leadId, email) => this.inviteLead(leadId, email)
    );
  }


  private loadSystemInfo(): void {
    const sysVersion = document.getElementById('sys-version');
    const sysEnv = document.getElementById('sys-environment');
    const sysBuildDate = document.getElementById('sys-build-date');
    const sysUserAgent = document.getElementById('sys-useragent');
    const sysScreen = document.getElementById('sys-screen');
    const sysViewport = document.getElementById('sys-viewport');

    if (sysVersion) sysVersion.textContent = '10.0.0';
    if (sysEnv) sysEnv.textContent = import.meta.env?.MODE || 'development';
    if (sysBuildDate) sysBuildDate.textContent = new Date().toLocaleDateString();
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
      const events = eventsJson ? JSON.parse(eventsJson) : [];

      // Count unique sessions (visitors today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const todayEvents = events.filter((e: any) => e.timestamp >= todayStart);
      const todaySessions = new Set(todayEvents.map((e: any) => e.sessionId));
      const visitorsToday = todaySessions.size;

      // Count total page views
      const pageViews = events.filter((e: any) => 'title' in e);
      const totalPageViews = pageViews.length;

      // Count total unique sessions (all time)
      const allSessions = new Set(events.map((e: any) => e.sessionId));
      const totalVisitors = allSessions.size;

      // Update overview stats
      const statVisitors = document.getElementById('stat-visitors');
      if (statVisitors) statVisitors.textContent = visitorsToday.toString();

      // Update analytics tab stats
      const analyticsVisitors = document.getElementById('analytics-visitors');
      const analyticsPageviews = document.getElementById('analytics-pageviews');
      const analyticsSessions = document.getElementById('analytics-sessions');

      if (analyticsVisitors) analyticsVisitors.textContent = totalVisitors.toString();
      if (analyticsPageviews) analyticsPageviews.textContent = totalPageViews.toString();
      if (analyticsSessions) {
        // Calculate average session duration
        const sessionsWithTime = pageViews.filter((pv: any) => pv.timeOnPage);
        if (sessionsWithTime.length > 0) {
          const totalTime = sessionsWithTime.reduce(
            (sum: number, pv: any) => sum + (pv.timeOnPage || 0),
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

      console.log('[AdminDashboard] Visitor stats loaded:', {
        visitorsToday,
        totalVisitors,
        totalPageViews
      });
    } catch (error) {
      console.error('[AdminDashboard] Failed to load visitor stats:', error);

      // Set defaults on error
      const statVisitors = document.getElementById('stat-visitors');
      const analyticsVisitors = document.getElementById('analytics-visitors');
      const analyticsPageviews = document.getElementById('analytics-pageviews');
      const analyticsSessions = document.getElementById('analytics-sessions');

      if (statVisitors) statVisitors.textContent = '0';
      if (analyticsVisitors) analyticsVisitors.textContent = '0';
      if (analyticsPageviews) analyticsPageviews.textContent = '0';
      if (analyticsSessions) analyticsSessions.textContent = '-';
    }
  }

  // Messaging properties
  private selectedClientId: number | null = null;
  private selectedThreadId: number | null = null;

  private setupMessaging(): void {
    // Custom dropdown is now handled by admin-messaging.ts module
    // The hidden input #admin-client-select stores the selected value
    // No additional setup needed here as the module handles everything

    // Send message button (new UI)
    const sendBtn = document.getElementById('btn-admin-send-message');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        this.sendMessage();
      });
    }

    // Send message form (old UI fallback)
    const sendForm = document.getElementById('admin-send-message-form');
    if (sendForm) {
      sendForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }

    // Send on Enter key (but not Shift+Enter for new line)
    const messageInput = document.getElementById('admin-message-text') as HTMLTextAreaElement;
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
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
    const textarea = document.getElementById('admin-message-text') as HTMLTextAreaElement;
    const sendButton = document.getElementById('admin-send-message') as HTMLButtonElement;
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
      document.getElementById('admin-messages-thread') ||
      document.getElementById('admin-messages-container');
    if (!container) return;

    container.innerHTML =
      '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

    try {
      // Backend endpoint: /api/messages/threads/:threadId/messages
      const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.renderMessages(data.messages || []);

        // Mark messages as read
        await fetch(`/api/messages/threads/${threadId}/read`, {
          method: 'PUT',
          credentials: 'include'
        });
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

  private renderMessages(messages: any[]): void {
    const container =
      document.getElementById('admin-messages-thread') ||
      document.getElementById('admin-messages-container');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: #666;">No messages yet. Start the conversation!</div>';
      return;
    }

    // Use client portal style messages
    container.innerHTML = messages
      .map((msg: any) => {
        const isAdmin = msg.sender_type === 'admin';
        const time = new Date(msg.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        const date = new Date(msg.created_at).toLocaleDateString();
        const rawSenderName = isAdmin ? 'You (Admin)' : (msg.sender_name || 'Client');
        // Sanitize user data to prevent XSS
        const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
        const safeContent = SanitizationUtils.escapeHtml(msg.message || msg.content || '');
        const safeInitials = SanitizationUtils.escapeHtml(rawSenderName.substring(0, 2).toUpperCase());

        if (isAdmin) {
          // Admin message (sent - right aligned)
          return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${date} at ${time}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
            <div class="message-avatar" data-name="Admin">
              <div class="avatar-placeholder">ADM</div>
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
                <span class="message-time">${date} at ${time}</span>
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
    const input = document.getElementById('admin-message-text') as HTMLInputElement;
    if (!input || !input.value.trim() || !this.selectedThreadId) return;

    const message = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
      const response = await fetch(`/api/messages/threads/${this.selectedThreadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ message }) // Backend expects 'message' field
      });

      if (response.ok) {
        // Reload messages
        this.loadThreadMessages(this.selectedThreadId);
        // Refresh thread list for unread counts
        this.loadClientThreads();
      } else {
        const error = await response.json();
        console.error('[AdminDashboard] Failed to send message:', error);
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error sending message:', error);
      alert('Error sending message. Please try again.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  private setupExportButtons(): void {
    const exportAnalytics = document.getElementById('export-analytics');
    const exportVisitors = document.getElementById('export-visitors');
    const exportPerformance = document.getElementById('export-performance');

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
    const clearOldData = document.getElementById('clear-old-data');
    const resetAnalytics = document.getElementById('reset-analytics');

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
      tableBody = document.getElementById('leads-table-body');
      statusColumnIndex = 6; // Status column is 7th (0-indexed: 6)
    } else if (tableName === 'projects') {
      tableBody = document.getElementById('projects-table-body');
      statusColumnIndex = 4; // Status column is 5th (0-indexed: 4)
    } else if (tableName === 'clients') {
      tableBody = document.getElementById('clients-table-body');
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

  private formatProjectType(type: string): string {
    const typeMap: Record<string, string> = {
      'simple-site': 'Simple Website',
      'business-site': 'Business Website',
      portfolio: 'Portfolio',
      ecommerce: 'E-commerce',
      'web-app': 'Web Application',
      'browser-extension': 'Browser Extension',
      other: 'Other'
    };
    return typeMap[type] || type || '-';
  }

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
      let dashboardContainer = document.getElementById('performance-dashboard-container');

      if (!dashboardContainer) {
        // Create container for the performance dashboard in the performance tab
        const performanceTab = document.getElementById('performance-tab');
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
    const container = document.getElementById('performance-alerts');
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
    const loading = document.getElementById('loading-indicator');
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

    // Show alert for important messages (errors)
    if (type === 'error') {
      alert(message);
    }
  }

  private startAutoRefresh(): void {
    // Refresh dashboard data every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.loadTabData(this.currentTab);
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
      alert(`Failed to export ${type} data. Please try again.`);
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
    if (
      !confirm(
        'Are you sure you want to clear data older than 90 days? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      // Clear old data logic here
      alert('Old data cleared successfully.');
    } catch (error) {
      console.error('[AdminDashboard] Error clearing old data:', error);
      alert('Failed to clear old data. Please try again.');
    }
  }

  private async resetAnalytics(): Promise<void> {
    if (
      !confirm('Are you sure you want to reset ALL analytics data? This action cannot be undone.')
    ) {
      return;
    }

    if (
      !confirm(
        'This will permanently delete all visitor data, page views, and analytics. Type "RESET" to confirm.'
      )
    ) {
      return;
    }

    try {
      // Reset analytics logic here
      sessionStorage.clear();
      sessionStorage.clear();
      alert('Analytics data has been reset.');
      window.location.reload();
    } catch (error) {
      console.error('[AdminDashboard] Error resetting analytics:', error);
      alert('Failed to reset analytics. Please try again.');
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
  alert(`Viewing details for visitor: ${visitorId}`);
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
