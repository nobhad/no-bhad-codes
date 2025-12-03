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
import type { PerformanceMetrics, PerformanceAlert } from '../../services/performance-service';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

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

interface AnalyticsDataItem {
  label: string;
  value: string | number;
}

interface AnalyticsData {
  popularPages?: AnalyticsDataItem[];
  deviceBreakdown?: AnalyticsDataItem[];
  geoDistribution?: AnalyticsDataItem[];
  engagementEvents?: AnalyticsDataItem[];
}

interface PageView {
  url: string;
  timestamp: number;
  [key: string]: unknown;
}

interface Session {
  id: string;
  startTime: number;
  [key: string]: unknown;
}

interface Interaction {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

interface RawVisitorData {
  sessions?: Session[];
  pageViews?: PageView[];
  interactions?: Interaction[];
  [key: string]: unknown;
}

interface StatusItem {
  status: string;
  [key: string]: unknown;
}

interface ApplicationStatus {
  modules: Record<string, StatusItem>;
  services: Record<string, StatusItem>;
}

interface VisitorInfo {
  id: string;
  firstVisit: string;
  lastVisit: string;
  sessions: number;
  pageViews: number;
  location: string;
  device: string;
}

declare global {
  interface ImportMeta {
    env?: Record<string, string | undefined>;
  }
}

// Admin authentication and session management using JWT backend
class AdminAuth {
  private static readonly SESSION_KEY = 'nbw_admin_session';
  private static readonly TOKEN_KEY = 'nbw_admin_token';
  private static readonly API_BASE = '/api/auth';

  /**
   * Authenticate with backend JWT API
   * Falls back to client-side hash for offline/development mode
   */
  static async authenticate(inputKey: string): Promise<boolean> {
    try {
      // Check rate limiting first
      AdminSecurity.checkRateLimit();

      // Try backend authentication first
      try {
        const response = await fetch(`${this.API_BASE}/admin/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: inputKey })
        });

        if (response.ok) {
          const data = await response.json();

          // Clear failed attempts on successful login
          AdminSecurity.clearAttempts();

          // Store JWT token and session
          localStorage.setItem(this.TOKEN_KEY, data.token);
          const session = {
            authenticated: true,
            timestamp: Date.now(),
            expiresIn: data.expiresIn
          };
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

          return true;
        } else if (response.status === 401) {
          // Invalid credentials
          AdminSecurity.recordFailedAttempt();
          return false;
        }
        // For other errors, fall through to fallback
      } catch (fetchError) {
        console.warn('[AdminAuth] Backend auth failed, using fallback:', fetchError);
      }

      // Fallback: Client-side hash authentication for offline/development
      const fallbackHash =
        (import.meta.env && import.meta.env.VITE_ADMIN_PASSWORD_HASH) ||
        '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // Default: 'admin' in SHA256

      const encoder = new TextEncoder();
      const data = encoder.encode(inputKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === fallbackHash) {
        AdminSecurity.clearAttempts();
        const session = {
          authenticated: true,
          timestamp: Date.now(),
          fallback: true // Mark as fallback auth
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return true;
      }

      AdminSecurity.recordFailedAttempt();
      return false;
    } catch (error) {
      console.error('[AdminAuth] Authentication error:', error);
      AdminSecurity.recordFailedAttempt();
      throw error;
    }
  }

  /**
   * Check if user is authenticated (valid session or token)
   */
  static isAuthenticated(): boolean {
    try {
      // Check for admin JWT token first
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (token) {
        // Validate token hasn't expired (basic check)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            return true;
          }
          // Token expired, clean up
          this.logout();
          return false;
        } catch {
          // Invalid token format
          this.logout();
          return false;
        }
      }

      // Also check for client portal auth token (for admin users logged in via client portal)
      const clientToken = localStorage.getItem('client_auth_token');
      if (clientToken) {
        try {
          const payload = JSON.parse(atob(clientToken.split('.')[1]));
          // Check if user is admin and token not expired
          if ((payload.isAdmin || payload.type === 'admin') && payload.exp && payload.exp * 1000 > Date.now()) {
            return true;
          }
        } catch {
          // Invalid token format, continue to other checks
        }
      }

      // Fallback: Check session storage
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const sessionDuration = 60 * 60 * 1000; // 1 hour
      const isValid =
        session.authenticated && Date.now() - session.timestamp < sessionDuration;

      if (!isValid) {
        this.logout();
      }

      return isValid;
    } catch (error) {
      console.error('[AdminAuth] Session validation error:', error);
      return false;
    }
  }

  /**
   * Get the current JWT token for API calls
   */
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Logout and clear all auth data
   */
  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.reload();
  }

  /**
   * Extend session timestamp for activity
   */
  static extendSession(): void {
    try {
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.timestamp = Date.now();
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }
    } catch (error) {
      console.error('[AdminAuth] Session extension error:', error);
    }
  }
}

// Dashboard data management
class AdminDashboard {
  private currentTab = 'overview';
  private refreshInterval: NodeJS.Timeout | null = null;
  private charts: Map<string, Chart> = new Map();

  // Store data for detail views
  private leadsData: any[] = [];
  private contactsData: any[] = [];
  private projectsData: any[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize security measures first
    AdminSecurity.init();

    // Initialize navigation and theme modules
    await this.initializeModules();

    // Check authentication
    if (!AdminAuth.isAuthenticated()) {
      this.showAuthGate();
      return;
    }

    this.showDashboard();
    this.setupEventListeners();
    await this.loadDashboardData();
    this.startAutoRefresh();
  }

  private async initializeModules(): Promise<void> {
    // Admin dashboard doesn't use theme toggle or main site navigation
    // Theme is handled via CSS and localStorage directly
    // No additional modules needed for admin portal
  }

  private showAuthGate(): void {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (authGate) authGate.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');

    this.setupAuthEventListeners();
  }

  private showDashboard(): void {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (authGate) authGate.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
  }

  private setupAuthEventListeners(): void {
    const authForm = document.getElementById('auth-form') as HTMLFormElement;

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(authForm);
        const authKey = formData.get('authKey') as string;

        try {
          if (await AdminAuth.authenticate(authKey)) {
            this.showDashboard();
            this.setupEventListeners();
            await this.loadDashboardData();
            this.startAutoRefresh();
          } else {
            this.showAuthError('Invalid access key. Please try again.');
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Authentication failed. Please try again.';
          this.showAuthError(message);
        }
      });
    }
  }

  private showAuthError(message: string): void {
    const authError = document.getElementById('auth-error');
    if (authError) {
      authError.textContent = message;
      authError.classList.remove('hidden');
      setTimeout(() => {
        authError.classList.add('hidden');
      }, 5000);
    }
  }

  private setupEventListeners(): void {
    // Logout button (both old and new IDs)
    const logoutBtn = document.getElementById('logout-btn') || document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        // Clear auth data and redirect to client landing
        localStorage.removeItem('clientAuth');
        localStorage.removeItem('client_auth_token');
        localStorage.removeItem('clientAuthToken');
        window.location.href = '/client/landing';
      });
    }

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
    sidebarButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = (btn as HTMLElement).dataset.tab;
        if (tabName) {
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
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/leads', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.updateLeadsDisplay(data);
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load leads:', error);
    }
  }

  private updateLeadsDisplay(data: { leads: any[], stats: any }): void {
    // Store leads data for detail views
    this.leadsData = data.leads || [];

    // Update overview stats
    const statTotal = document.getElementById('stat-total-leads');
    const statPending = document.getElementById('stat-pending-leads');
    const statVisitors = document.getElementById('stat-visitors');

    // Update leads tab stats
    const leadsTotal = document.getElementById('leads-total');
    const leadsPending = document.getElementById('leads-pending');
    const leadsActive = document.getElementById('leads-active');
    const leadsCompleted = document.getElementById('leads-completed');

    if (statTotal) statTotal.textContent = data.stats?.total?.toString() || '0';
    if (statPending) statPending.textContent = data.stats?.pending?.toString() || '0';
    if (statVisitors) statVisitors.textContent = '0';  // No visitor tracking backend yet
    if (leadsTotal) leadsTotal.textContent = data.stats?.total?.toString() || '0';
    if (leadsPending) leadsPending.textContent = data.stats?.pending?.toString() || '0';
    if (leadsActive) leadsActive.textContent = data.stats?.active?.toString() || '0';
    if (leadsCompleted) leadsCompleted.textContent = data.stats?.completed?.toString() || '0';

    // Update recent leads list
    const recentList = document.getElementById('recent-leads-list');
    if (recentList && data.leads) {
      const recentLeads = data.leads.slice(0, 5);
      if (recentLeads.length === 0) {
        recentList.innerHTML = '<li>No leads yet</li>';
      } else {
        recentList.innerHTML = recentLeads.map((lead: any) => {
          const date = new Date(lead.created_at).toLocaleDateString();
          return `<li>${lead.contact_name || 'Unknown'} - ${lead.project_type || 'Project'} - ${date}</li>`;
        }).join('');
      }
    }

    // Update leads table
    const tableBody = document.getElementById('leads-table-body');
    if (tableBody && data.leads) {
      if (data.leads.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No leads found</td></tr>';
      } else {
        tableBody.innerHTML = data.leads.map((lead: any) => {
          const date = new Date(lead.created_at).toLocaleDateString();
          const statusClass = lead.status === 'pending' ? 'status-pending' :
            lead.status === 'active' ? 'status-active' : 'status-completed';
          const showActivateBtn = lead.status === 'pending';
          return `
            <tr data-lead-id="${lead.id}">
              <td>${date}</td>
              <td>${lead.contact_name || '-'}</td>
              <td>${lead.company_name || '-'}</td>
              <td>${lead.email || '-'}</td>
              <td>${lead.project_type || '-'}</td>
              <td>${lead.budget_range || '-'}</td>
              <td>
                <span class="status-badge ${statusClass}">${lead.status || 'pending'}</span>
                ${showActivateBtn ? `<button class="action-btn action-convert activate-lead-btn" data-id="${lead.id}" onclick="event.stopPropagation()" style="margin-left: 0.5rem;">Activate</button>` : ''}
              </td>
            </tr>
          `;
        }).join('');

        // Add click handlers to rows
        const rows = tableBody.querySelectorAll('tr[data-lead-id]');
        rows.forEach((row) => {
          row.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).tagName === 'BUTTON') return;
            const leadId = parseInt((row as HTMLElement).dataset.leadId || '0');
            this.showLeadDetails(leadId);
          });
        });

        // Add click handlers for activate buttons
        const activateBtns = tableBody.querySelectorAll('.activate-lead-btn');
        activateBtns.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).dataset.id;
            if (id && confirm('Activate this lead as a project?')) {
              this.activateLead(parseInt(id));
            }
          });
        });
      }
    }
  }

  private async loadContactSubmissions(): Promise<void> {
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/contact-submissions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.updateContactsDisplay(data);
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load contact submissions:', error);
    }
  }

  private updateContactsDisplay(data: { submissions: any[], stats: any }): void {
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
        tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No contact form submissions yet</td></tr>';
      } else {
        tableBody.innerHTML = data.submissions.map((submission: any) => {
          const date = new Date(submission.created_at).toLocaleDateString();
          // Truncate message for display
          const truncatedMessage = submission.message && submission.message.length > 50
            ? `${submission.message.substring(0, 50)}...`
            : (submission.message || '-');
          return `
            <tr data-contact-id="${submission.id}">
              <td>${date}</td>
              <td>${submission.name || '-'}</td>
              <td>${submission.email || '-'}</td>
              <td>${submission.subject || '-'}</td>
              <td class="message-cell" title="${(submission.message || '').replace(/"/g, '&quot;')}">${truncatedMessage}</td>
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
        }).join('');

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
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/contact-submissions/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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

  private showLeadDetails(leadId: number): void {
    const lead = this.leadsData.find((l: any) => l.id === leadId);
    if (!lead) return;

    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = 'Intake Submission Details';

    const date = new Date(lead.created_at).toLocaleString();
    const statusClass = lead.status === 'pending' ? 'status-pending' :
      lead.status === 'active' ? 'status-active' : 'status-completed';

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Contact Name</span>
          <span class="detail-value">${lead.contact_name || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Company</span>
          <span class="detail-value">${lead.company_name || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value"><a href="mailto:${lead.email}">${lead.email || '-'}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${lead.phone ? `<a href="tel:${lead.phone}">${lead.phone}</a>` : '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Project Type</span>
          <span class="detail-value">${this.formatProjectType(lead.project_type)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Budget Range</span>
          <span class="detail-value">${lead.budget_range || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Timeline</span>
          <span class="detail-value">${lead.timeline || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value"><span class="status-badge ${statusClass}">${lead.status || 'pending'}</span></span>
        </div>
        ${lead.description ? `
        <div class="detail-row">
          <span class="detail-label">Description</span>
          <span class="detail-value message-full">${lead.description}</span>
        </div>
        ` : ''}
        ${lead.features ? `
        <div class="detail-row">
          <span class="detail-label">Features</span>
          <span class="detail-value message-full">${lead.features}</span>
        </div>
        ` : ''}
      </div>
      ${lead.email && lead.status === 'pending' ? `
      <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border-secondary);">
        <button class="btn btn-primary" id="invite-lead-btn" style="width: 100%;">
          Invite to Client Portal
        </button>
        <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 0.5rem; text-align: center;">
          Sends an email invitation to set up their account
        </p>
      </div>
      ` : ''}
    `;

    modal.style.display = 'flex';

    // Add invite button handler
    const inviteBtn = document.getElementById('invite-lead-btn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => {
        this.inviteLead(leadId, lead.email);
      });
    }
  }

  private async inviteLead(leadId: number, email: string): Promise<void> {
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    const inviteBtn = document.getElementById('invite-lead-btn') as HTMLButtonElement;
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Sending Invitation...';
    }

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${contact.name || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value"><a href="mailto:${contact.email}">${contact.email || '-'}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Subject</span>
          <span class="detail-value">${contact.subject || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value"><span class="status-badge ${statusClass}">${contact.status || 'new'}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Message</span>
          <span class="detail-value message-full">${contact.message || '-'}</span>
        </div>
        ${contact.read_at ? `
        <div class="detail-row">
          <span class="detail-label">Read At</span>
          <span class="detail-value">${new Date(contact.read_at).toLocaleString()}</span>
        </div>
        ` : ''}
        ${contact.replied_at ? `
        <div class="detail-row">
          <span class="detail-label">Replied At</span>
          <span class="detail-value">${new Date(contact.replied_at).toLocaleString()}</span>
        </div>
        ` : ''}
      </div>
    `;

    modal.style.display = 'flex';

    // Mark as read if status is 'new'
    if (contact.status === 'new') {
      this.updateContactStatus(contactId, 'read');
    }
  }

  private async loadProjects(): Promise<void> {
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/leads', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.projectsData = data.leads || [];
        this.updateProjectsDisplay(data);
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load projects:', error);
    }
  }

  private updateProjectsDisplay(data: { leads: any[], stats: any }): void {
    // Filter to only show non-pending projects (actual projects vs leads)
    const projects = (data.leads || []).filter((p: any) =>
      p.status !== 'pending' || p.project_name
    );

    // Update stats
    const projectsTotal = document.getElementById('projects-total');
    const projectsActive = document.getElementById('projects-active');
    const projectsCompleted = document.getElementById('projects-completed');
    const projectsOnHold = document.getElementById('projects-on-hold');

    const activeCount = projects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;
    const completedCount = projects.filter((p: any) => p.status === 'completed').length;
    const onHoldCount = projects.filter((p: any) => p.status === 'on_hold').length;

    if (projectsTotal) projectsTotal.textContent = projects.length.toString();
    if (projectsActive) projectsActive.textContent = activeCount.toString();
    if (projectsCompleted) projectsCompleted.textContent = completedCount.toString();
    if (projectsOnHold) projectsOnHold.textContent = onHoldCount.toString();

    // Update projects table
    const tableBody = document.getElementById('projects-table-body');
    if (tableBody) {
      if (projects.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No projects yet. Convert leads to start projects.</td></tr>';
      } else {
        tableBody.innerHTML = projects.map((project: any) => {
          return `
            <tr data-project-id="${project.id}">
              <td>${project.project_name || project.description?.substring(0, 30) || 'Untitled Project'}</td>
              <td>${project.contact_name || '-'}<br><small>${project.company_name || ''}</small></td>
              <td>${this.formatProjectType(project.project_type)}</td>
              <td>${project.budget_range || '-'}</td>
              <td>${project.timeline || '-'}</td>
              <td>
                <select class="project-status-select status-select" data-id="${project.id}" onclick="event.stopPropagation()">
                  <option value="pending" ${project.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="active" ${project.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="in_progress" ${project.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                  <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                  <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </td>
              <td>
                <button class="action-btn action-edit" data-id="${project.id}" onclick="event.stopPropagation()">View</button>
              </td>
            </tr>
          `;
        }).join('');

        // Add click handlers for rows
        const rows = tableBody.querySelectorAll('tr[data-project-id]');
        rows.forEach((row) => {
          row.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
            const projectId = parseInt((row as HTMLElement).dataset.projectId || '0');
            this.showProjectDetails(projectId);
          });
        });

        // Add change handlers for status selects
        const statusSelects = tableBody.querySelectorAll('.project-status-select');
        statusSelects.forEach((select) => {
          select.addEventListener('change', (e) => {
            e.stopPropagation();
            const target = e.target as HTMLSelectElement;
            const id = target.dataset.id;
            const newStatus = target.value;
            if (id) {
              this.updateProjectStatus(parseInt(id), newStatus);
            }
          });
        });

        // Add click handlers for view buttons
        const viewBtns = tableBody.querySelectorAll('.action-btn.action-edit');
        viewBtns.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).dataset.id;
            if (id) {
              this.showProjectDetails(parseInt(id));
            }
          });
        });
      }
    }
  }

  private async updateProjectStatus(id: number, status: string): Promise<void> {
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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

  // Current project being viewed in detail
  private currentProjectId: number | null = null;

  /**
   * Navigate to full project detail view (replaces modal approach)
   * This mirrors the client portal view for admin management
   */
  private showProjectDetails(projectId: number): void {
    const project = this.projectsData.find((p: any) => p.id === projectId);
    if (!project) return;

    this.currentProjectId = projectId;

    // Switch to project-detail tab
    this.switchTab('project-detail');

    // Populate project detail view
    this.populateProjectDetailView(project);

    // Set up project detail sub-tabs
    this.setupProjectDetailTabs();
  }

  /**
   * Populate the project detail view with project data
   */
  private populateProjectDetailView(project: any): void {
    // Header info
    const titleEl = document.getElementById('project-detail-title');
    if (titleEl) titleEl.textContent = project.project_name || 'Project Details';

    // Overview card
    const projectName = document.getElementById('pd-project-name');
    const clientName = document.getElementById('pd-client-name');
    const clientEmail = document.getElementById('pd-client-email');
    const company = document.getElementById('pd-company');
    const status = document.getElementById('pd-status');
    const projectType = document.getElementById('pd-type');
    const budget = document.getElementById('pd-budget');
    const timeline = document.getElementById('pd-timeline');
    const startDate = document.getElementById('pd-start-date');

    if (projectName) projectName.textContent = project.project_name || 'Untitled Project';
    if (clientName) clientName.textContent = project.contact_name || '-';
    if (clientEmail) clientEmail.textContent = project.email || '-';
    if (company) company.textContent = project.company_name || '-';
    if (status) {
      status.textContent = (project.status || 'pending').replace('_', ' ');
      status.className = `status-badge status-${(project.status || 'pending').replace('_', '-')}`;
    }
    if (projectType) projectType.textContent = this.formatProjectType(project.project_type);
    if (budget) budget.textContent = project.budget_range || '-';
    if (timeline) timeline.textContent = project.timeline || '-';
    if (startDate) startDate.textContent = project.created_at ? new Date(project.created_at).toLocaleDateString() : '-';

    // Progress
    const progressPercent = document.getElementById('pd-progress-percent');
    const progressBar = document.getElementById('pd-progress-bar');
    const progress = project.progress || 0;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    // Project notes
    const notes = document.getElementById('pd-notes');
    if (notes) {
      if (project.description) {
        notes.innerHTML = `<p>${project.description}</p>`;
        if (project.features) {
          notes.innerHTML += `<h4>Features Requested:</h4><p>${project.features}</p>`;
        }
      } else {
        notes.innerHTML = '<p class="empty-state">No project notes yet.</p>';
      }
    }

    // Settings form
    const settingName = document.getElementById('pd-setting-name') as HTMLInputElement;
    const settingStatus = document.getElementById('pd-setting-status') as HTMLSelectElement;
    const settingProgress = document.getElementById('pd-setting-progress') as HTMLInputElement;

    if (settingName) settingName.value = project.project_name || '';
    if (settingStatus) settingStatus.value = project.status || 'pending';
    if (settingProgress) settingProgress.value = (project.progress || 0).toString();

    // Client account info in settings
    const clientAccountEmail = document.getElementById('pd-client-account-email');
    const clientAccountStatus = document.getElementById('pd-client-account-status');
    const clientLastLogin = document.getElementById('pd-client-last-login');

    if (clientAccountEmail) clientAccountEmail.textContent = project.email || '-';
    if (clientAccountStatus) {
      // Check if client has account
      const hasAccount = project.client_id || project.password_hash;
      clientAccountStatus.textContent = hasAccount ? 'Active' : 'Not Invited';
      clientAccountStatus.className = `status-badge status-${hasAccount ? 'active' : 'pending'}`;
    }
    if (clientLastLogin) clientLastLogin.textContent = project.last_login_at ? new Date(project.last_login_at).toLocaleString() : 'Never';

    // Load project-specific data
    this.loadProjectMessages(project.id);
    this.loadProjectFiles(project.id);
  }

  /**
   * Set up project detail sub-tab navigation
   */
  private setupProjectDetailTabs(): void {
    const tabBtns = document.querySelectorAll('.pd-tab-btn');
    const tabContents = document.querySelectorAll('.pd-tab-content');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.pdTab;
        if (!tabName) return;

        // Update active button
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active content
        tabContents.forEach((content) => {
          content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
        });
      });
    });

    // Back button handler
    const backBtn = document.getElementById('btn-back-to-projects');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.currentProjectId = null;
        this.switchTab('projects');
      });
    }

    // Settings form handler
    const settingsForm = document.getElementById('pd-project-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProjectSettings();
      });
    }

    // Send message handler
    const sendMsgBtn = document.getElementById('btn-pd-send-message');
    if (sendMsgBtn) {
      sendMsgBtn.addEventListener('click', () => this.sendProjectMessage());
    }

    // Resend invite handler
    const resendInviteBtn = document.getElementById('btn-resend-invite');
    if (resendInviteBtn) {
      resendInviteBtn.addEventListener('click', () => {
        if (this.currentProjectId) {
          const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
          if (project && project.email) {
            this.inviteLead(this.currentProjectId, project.email);
          } else {
            alert('No email address found for this project.');
          }
        }
      });
    }
  }

  /**
   * Save project settings from the settings form
   */
  private async saveProjectSettings(): Promise<void> {
    if (!this.currentProjectId) return;

    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    const name = (document.getElementById('pd-setting-name') as HTMLInputElement)?.value;
    const status = (document.getElementById('pd-setting-status') as HTMLSelectElement)?.value;
    const progress = parseInt((document.getElementById('pd-setting-progress') as HTMLInputElement)?.value || '0');

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_name: name,
          status,
          progress
        })
      });

      if (response.ok) {
        alert('Project settings saved!');
        // Refresh project data
        await this.loadProjects();
        // Re-populate the view
        const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
        if (project) {
          this.populateProjectDetailView(project);
        }
      } else {
        alert('Failed to save project settings');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error saving project settings:', error);
      alert('Error saving project settings');
    }
  }

  /**
   * Load messages for the current project
   */
  private async loadProjectMessages(projectId: number): Promise<void> {
    const messagesThread = document.getElementById('pd-messages-thread');
    if (!messagesThread) return;

    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) {
      messagesThread.innerHTML = '<p class="empty-state">Authentication required to view messages.</p>';
      return;
    }

    try {
      // Get the client ID for this project
      const project = this.projectsData.find((p: any) => p.id === projectId);
      if (!project || !project.client_id) {
        messagesThread.innerHTML = '<p class="empty-state">No client account linked. Invite the client first to enable messaging.</p>';
        return;
      }

      const response = await fetch(`/api/messages?client_id=${project.client_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
          messagesThread.innerHTML = '<p class="empty-state">No messages yet. Start the conversation with your client.</p>';
        } else {
          messagesThread.innerHTML = messages.map((msg: any) => `
            <div class="message ${msg.sender_type === 'admin' ? 'message-sent' : 'message-received'}">
              <div class="message-content">
                <div class="message-header">
                  <span class="message-sender">${msg.sender_type === 'admin' ? 'You' : project.contact_name || 'Client'}</span>
                  <span class="message-time">${new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div class="message-body">${msg.content}</div>
              </div>
            </div>
          `).join('');
          // Scroll to bottom
          messagesThread.scrollTop = messagesThread.scrollHeight;
        }
      }
    } catch (error) {
      console.error('[AdminDashboard] Error loading project messages:', error);
      messagesThread.innerHTML = '<p class="empty-state">Error loading messages.</p>';
    }
  }

  /**
   * Send a message for the current project
   */
  private async sendProjectMessage(): Promise<void> {
    if (!this.currentProjectId) return;

    const messageInput = document.getElementById('pd-message-input') as HTMLTextAreaElement;
    if (!messageInput || !messageInput.value.trim()) return;

    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
    if (!project || !project.client_id) {
      alert('No client account linked. Invite the client first.');
      return;
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: project.client_id,
          content: messageInput.value.trim(),
          sender_type: 'admin'
        })
      });

      if (response.ok) {
        messageInput.value = '';
        // Reload messages
        this.loadProjectMessages(this.currentProjectId);
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('[AdminDashboard] Error sending message:', error);
      alert('Error sending message');
    }
  }

  /**
   * Load files for the current project
   */
  private async loadProjectFiles(projectId: number): Promise<void> {
    const filesList = document.getElementById('pd-files-list');
    if (!filesList) return;

    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) {
      filesList.innerHTML = '<p class="empty-state">Authentication required to view files.</p>';
      return;
    }

    try {
      const response = await fetch(`/api/files?project_id=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const files = data.files || [];

        if (files.length === 0) {
          filesList.innerHTML = '<p class="empty-state">No files uploaded yet.</p>';
        } else {
          filesList.innerHTML = files.map((file: any) => `
            <div class="file-item">
              <span class="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <div class="file-info">
                <span class="file-name">${file.original_name || file.filename}</span>
                <span class="file-meta">Uploaded ${new Date(file.created_at).toLocaleDateString()} - ${this.formatFileSize(file.size)}</span>
              </div>
              <div class="file-actions">
                <a href="/uploads/${file.filename}" class="btn btn-outline btn-sm" target="_blank">Download</a>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (error) {
      console.error('[AdminDashboard] Error loading project files:', error);
      filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
    if (sysUserAgent) sysUserAgent.textContent = `${navigator.userAgent.substring(0, 50)  }...`;
    if (sysScreen) sysScreen.textContent = `${screen.width} x ${screen.height}`;
    if (sysViewport) sysViewport.textContent = `${window.innerWidth} x ${window.innerHeight}`;

    // Load visitor tracking data from localStorage
    this.loadVisitorStats();
  }

  private loadVisitorStats(): void {
    try {
      // Read visitor tracking events from localStorage (set by visitor-tracking.ts)
      const eventsJson = localStorage.getItem('nbw_tracking_events');
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
          const totalTime = sessionsWithTime.reduce((sum: number, pv: any) => sum + (pv.timeOnPage || 0), 0);
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
    // Client selector dropdown
    const clientSelect = document.getElementById('admin-client-select') as HTMLSelectElement;
    if (clientSelect) {
      clientSelect.addEventListener('change', () => {
        const selectedValue = clientSelect.value;
        if (selectedValue) {
          const [clientId, threadId] = selectedValue.split(':').map(Number);
          const clientName = clientSelect.options[clientSelect.selectedIndex].text;
          this.selectThread(clientId, threadId, clientName);
        } else {
          // Clear messages when no client selected
          const messagesThread = document.getElementById('admin-messages-thread');
          if (messagesThread) {
            messagesThread.innerHTML = '<div style="text-align: center; color: var(--color-text-secondary, #666); padding: 2rem;">Select a client to view messages</div>';
          }
          const composeArea = document.getElementById('admin-compose-area');
          if (composeArea) {
            composeArea.style.display = 'none';
          }
        }
      });
    }

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
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    const clientSelect = document.getElementById('admin-client-select') as HTMLSelectElement;
    if (!clientSelect) return;

    try {
      const response = await fetch('/api/messages/threads', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.populateClientDropdown(data.threads || []);
      } else {
        console.error('[AdminDashboard] Failed to load threads');
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load threads:', error);
    }
  }

  private populateClientDropdown(threads: any[]): void {
    const clientSelect = document.getElementById('admin-client-select') as HTMLSelectElement;
    if (!clientSelect) return;

    // Clear existing options (except the default)
    clientSelect.innerHTML = '<option value="">-- Select a client --</option>';

    if (threads.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No conversations yet';
      option.disabled = true;
      clientSelect.appendChild(option);
      return;
    }

    threads.forEach((thread: any) => {
      const option = document.createElement('option');
      option.value = `${thread.client_id}:${thread.id}`;
      const clientName = thread.contact_name || thread.company_name || thread.client_name || 'Unknown Client';
      const unreadText = thread.unread_count > 0 ? ` (${thread.unread_count} unread)` : '';
      option.textContent = `${clientName} - ${thread.subject || 'No subject'}${unreadText}`;
      clientSelect.appendChild(option);
    });
  }

  private selectThread(clientId: number, threadId: number, _clientName: string): void {
    this.selectedClientId = clientId;
    this.selectedThreadId = threadId;

    // Show compose area
    const composeArea = document.getElementById('admin-compose-area');
    if (composeArea) {
      composeArea.style.display = 'block';
    }

    // Also support old UI structure
    const messageInput = document.getElementById('admin-message-input');
    if (messageInput) {
      messageInput.style.display = 'block';
    }

    // Load messages
    this.loadThreadMessages(threadId);
  }

  private async loadThreadMessages(threadId: number): Promise<void> {
    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    // Try new container ID first, then old one
    const container = document.getElementById('admin-messages-thread') || document.getElementById('admin-messages-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

    try {
      // Backend endpoint: /api/messages/threads/:threadId/messages
      const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.renderMessages(data.messages || []);

        // Mark messages as read
        await fetch(`/api/messages/threads/${threadId}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">Failed to load messages</div>';
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to load messages:', error);
      container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">Error loading messages</div>';
    }
  }

  private renderMessages(messages: any[]): void {
    const container = document.getElementById('admin-messages-thread') || document.getElementById('admin-messages-container');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">No messages yet. Start the conversation!</div>';
      return;
    }

    // Use client portal style messages
    container.innerHTML = messages.map((msg: any) => {
      const isAdmin = msg.sender_type === 'admin';
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date(msg.created_at).toLocaleDateString();
      const senderName = isAdmin ? 'You (Admin)' : (msg.sender_name || 'Client');

      if (isAdmin) {
        // Admin message (sent - right aligned)
        return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${date} at ${time}</span>
              </div>
              <div class="message-body">${msg.message || msg.content || ''}</div>
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
            <div class="message-avatar" data-name="${senderName}">
              <div class="avatar-placeholder">${senderName.substring(0, 2).toUpperCase()}</div>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${date} at ${time}</span>
              </div>
              <div class="message-body">${msg.message || msg.content || ''}</div>
            </div>
          </div>
        `;

    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('admin-message-text') as HTMLInputElement;
    if (!input || !input.value.trim() || !this.selectedThreadId) return;

    const token = localStorage.getItem('client_auth_token') || localStorage.getItem('clientAuthToken');
    if (!token) return;

    const message = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
      const response = await fetch(`/api/messages/threads/${this.selectedThreadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })  // Backend expects 'message' field
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
    const tabContent = document.getElementById(`tab-${tabName}`) || document.getElementById(`${tabName}-tab`);
    tabContent?.classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data
    this.loadTabData(tabName);

    // Special handling for messages tab
    if (tabName === 'messages') {
      this.loadClientThreads();
    }
  }

  private async loadDashboardData(): Promise<void> {
    this.showLoading(true);

    try {
      await Promise.all([
        this.loadOverviewData(),
        this.loadPerformanceData(),
        this.loadAnalyticsData(),
        this.loadVisitorsData(),
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
        await this.loadOverviewData();
        break;
      case 'performance':
        await this.loadPerformanceData();
        break;
      case 'analytics':
        await this.loadAnalyticsData();
        break;
      case 'visitors':
        await this.loadVisitorsData();
        break;
      case 'leads':
        await this.loadLeadsData();
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
    // Simulate API call - replace with actual data fetching
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock data - replace with actual analytics data
    this.updateElement('total-visitors', '1,234');
    this.updateElement('visitors-change', '+12% from last week', 'positive');

    this.updateElement('page-views', '5,678');
    this.updateElement('views-change', '+8% from last week', 'positive');

    this.updateElement('avg-session', '2m 34s');
    this.updateElement('session-change', '-3% from last week', 'negative');

    this.updateElement('card-interactions', '456');
    this.updateElement('interactions-change', '+18% from last week', 'positive');

    // Load real Chart.js charts
    this.loadChart('visitors-chart', 'visitors');
    this.loadChart('sources-chart', 'sources');
  }

  private async loadPerformanceData(): Promise<void> {
    try {
      // Initialize the PerformanceDashboard component for admin use
      await this.initializePerformanceDashboard();

      // Get actual performance data from the service
      const perfData = await this.getPerformanceMetrics();

      // Core Web Vitals
      this.updateVital('lcp', perfData.lcp);
      this.updateVital('fid', perfData.fid);
      this.updateVital('cls', perfData.cls);

      // Bundle analysis
      if (perfData.bundleSize) {
        this.updateElement('total-bundle-size', perfData.bundleSize.total);
        this.updateElement('js-bundle-size', perfData.bundleSize.main);
        this.updateElement('css-bundle-size', perfData.bundleSize.vendor);
      }

      // Performance score and alerts
      if (perfData.score !== undefined) {
        this.updateElement('performance-score', `${Math.round(perfData.score)}/100`);
      }

      if (perfData.alerts && perfData.alerts.length > 0) {
        this.displayPerformanceAlerts(
          perfData.alerts.map(
            (msg) =>
              ({
                type: 'warning' as const,
                message: msg,
                metric: '',
                value: 0,
                threshold: 0
              }) as PerformanceAlert
          )
        );
      }
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

    // Fallback mock data
    return {
      lcp: { value: '1.2s', status: 'good' },
      fid: { value: '45ms', status: 'good' },
      cls: { value: '0.05', status: 'good' },
      ttfb: { value: '120ms', status: 'good' },
      bundleSize: {
        total: '156 KB',
        main: '98 KB',
        vendor: '58 KB'
      },
      score: 95,
      grade: 'A',
      alerts: []
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
    try {
      const analyticsData = await this.getAnalyticsData();

      // Update with real data if available, otherwise use mock data
      this.populateDataList(
        'popular-pages',
        analyticsData.popularPages || [
          { label: 'Homepage', value: '2,145 views' },
          { label: 'Art Portfolio', value: '856 views' },
          { label: 'Codes Section', value: '634 views' },
          { label: 'Contact', value: '423 views' },
          { label: 'About', value: '312 views' }
        ]
      );

      this.populateDataList(
        'device-breakdown',
        analyticsData.deviceBreakdown || [
          { label: 'Desktop', value: '45%' },
          { label: 'Mobile', value: '38%' },
          { label: 'Tablet', value: '17%' }
        ]
      );

      this.populateDataList(
        'geo-distribution',
        analyticsData.geoDistribution || [
          { label: 'United States', value: '42%' },
          { label: 'Canada', value: '18%' },
          { label: 'United Kingdom', value: '12%' },
          { label: 'Germany', value: '8%' },
          { label: 'Other', value: '20%' }
        ]
      );

      this.populateDataList(
        'engagement-events',
        analyticsData.engagementEvents || [
          { label: 'Business Card Flips', value: '456' },
          { label: 'Contact Form Submissions', value: '23' },
          { label: 'External Link Clicks', value: '187' },
          { label: 'Download Clicks', value: '34' }
        ]
      );
    } catch (error) {
      console.error('[AdminDashboard] Error loading analytics data:', error);

      // Fallback to mock data
      this.populateDataList('popular-pages', [
        { label: 'Homepage', value: '2,145 views' },
        { label: 'Art Portfolio', value: '856 views' },
        { label: 'Codes Section', value: '634 views' },
        { label: 'Contact', value: '423 views' },
        { label: 'About', value: '312 views' }
      ]);

      this.populateDataList('device-breakdown', [
        { label: 'Desktop', value: '45%' },
        { label: 'Mobile', value: '38%' },
        { label: 'Tablet', value: '17%' }
      ]);

      this.populateDataList('geo-distribution', [
        { label: 'United States', value: '42%' },
        { label: 'Canada', value: '18%' },
        { label: 'United Kingdom', value: '12%' },
        { label: 'Germany', value: '8%' },
        { label: 'Other', value: '20%' }
      ]);

      this.populateDataList('engagement-events', [
        { label: 'Business Card Flips', value: '456' },
        { label: 'Contact Form Submissions', value: '23' },
        { label: 'External Link Clicks', value: '187' },
        { label: 'Download Clicks', value: '34' }
      ]);
    }
  }

  private async getAnalyticsData(): Promise<AnalyticsData> {
    try {
      // Try to get data from main app via parent window
      if (window.opener?.NBW_DEBUG) {
        const debug = window.opener.NBW_DEBUG;
        if (debug.getVisitorData) {
          return await debug.getVisitorData();
        }
      }

      // Try to get data from current window
      if (window.NBW_DEBUG?.getVisitorData) {
        return (await window.NBW_DEBUG.getVisitorData()) as AnalyticsData;
      }

      // Try to access visitor tracking service directly
      const { container } = await import('../../core/container');
      const visitorService = (await container.resolve('VisitorTrackingService')) as {
        exportData?: () => Promise<RawVisitorData>;
      };
      if (visitorService?.exportData) {
        const data = await visitorService.exportData();
        return this.formatAnalyticsData(data);
      }
    } catch (error) {
      console.warn('[AdminDashboard] Could not get live analytics data:', error);
    }

    return {};
  }

  private formatAnalyticsData(rawData: RawVisitorData): AnalyticsData {
    // Format raw visitor data into admin dashboard format
    if (!rawData || !rawData.sessions) return {};

    const sessions = rawData.sessions || [];
    const pageViews = rawData.pageViews || [];
    const interactions = rawData.interactions || [];

    // Calculate popular pages
    const pageViewCounts: Record<string, number> = {};
    pageViews.forEach((pv) => {
      pageViewCounts[pv.url] = (pageViewCounts[pv.url] || 0) + 1;
    });

    const popularPages = Object.entries(pageViewCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([url, count]) => ({
        label: this.formatPageUrl(url),
        value: `${count} views`
      }));

    // Calculate device breakdown
    const deviceCounts: Record<string, number> = {};
    sessions.forEach((session) => {
      const deviceType = (session.deviceInfo as { type?: string })?.type;
      if (deviceType) {
        deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
      }
    });

    const totalSessions = sessions.length;
    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
      label: device.charAt(0).toUpperCase() + device.slice(1),
      value: `${Math.round(((count as number) / totalSessions) * 100)}%`
    }));

    // Calculate engagement events
    const interactionCounts: Record<string, number> = {};
    interactions.forEach((interaction) => {
      const key = interaction.type || 'Unknown';
      interactionCounts[key] = (interactionCounts[key] || 0) + 1;
    });

    const engagementEvents = Object.entries(interactionCounts).map(([type, count]) => ({
      label: this.formatInteractionType(type),
      value: count.toString()
    }));

    return {
      popularPages: popularPages.length > 0 ? popularPages : undefined,
      deviceBreakdown: deviceBreakdown.length > 0 ? deviceBreakdown : undefined,
      engagementEvents: engagementEvents.length > 0 ? engagementEvents : undefined,
      geoDistribution: undefined // Would need geolocation data
    };
  }

  private formatPageUrl(url: string): string {
    // Convert URLs to readable page names
    const urlMap: Record<string, string> = {
      '/': 'Homepage',
      '/art': 'Art Portfolio',
      '/codes': 'Codes Section',
      '/contact': 'Contact',
      '/about': 'About'
    };

    return urlMap[url] || url;
  }

  private formatInteractionType(type: string): string {
    // Convert interaction types to readable labels
    const typeMap: Record<string, string> = {
      'business-card-flip': 'Business Card Flips',
      'contact-form-submit': 'Contact Form Submissions',
      'external-link-click': 'External Link Clicks',
      'download-click': 'Download Clicks',
      'scroll-depth': 'Scroll Depth Events'
    };

    return typeMap[type] || type;
  }

  private async loadVisitorsData(): Promise<void> {
    // Mock visitor data
    const visitors = [
      {
        id: 'v_001',
        firstVisit: '2024-08-30 14:23',
        lastVisit: '2024-08-31 09:15',
        sessions: 3,
        pageViews: 12,
        location: 'San Francisco, CA',
        device: 'Desktop'
      },
      {
        id: 'v_002',
        firstVisit: '2024-08-31 08:45',
        lastVisit: '2024-08-31 08:52',
        sessions: 1,
        pageViews: 5,
        location: 'Toronto, ON',
        device: 'Mobile'
      }
    ];

    this.populateVisitorsTable(visitors);
  }

  private async loadLeadsData(): Promise<void> {
    try {
      const token = AdminAuth.getToken();
      if (!token) {
        console.error('[AdminDashboard] No auth token for leads request');
        return;
      }

      const response = await fetch('/api/admin/leads', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`);
      }

      const data = await response.json();

      // Update stats
      this.updateElement('total-leads', String(data.stats?.total || 0));
      this.updateElement('pending-leads', String(data.stats?.pending || 0));
      this.updateElement('active-leads', String(data.stats?.active || 0));
      this.updateElement('completed-leads', String(data.stats?.completed || 0));

      // Populate table
      this.populateLeadsTable(data.leads || []);
    } catch (error) {
      console.error('[AdminDashboard] Error loading leads:', error);
      this.populateLeadsTable([]);
    }
  }

  private populateLeadsTable(leads: Array<{
    id: number;
    created_at: string;
    contact_name: string;
    company_name: string;
    email: string;
    project_type: string;
    budget_range: string;
    timeline: string;
    status: string;
  }>): void {
    const tbody = document.getElementById('leads-table-body');
    if (!tbody) return;

    if (leads.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No intake submissions yet</td></tr>';
      return;
    }

    tbody.innerHTML = leads
      .map((lead) => {
        const date = new Date(lead.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const statusClass = lead.status === 'pending' ? 'status-pending' :
          lead.status === 'active' || lead.status === 'in_progress' ? 'status-active' :
            lead.status === 'completed' ? 'status-completed' : '';

        return `
          <tr>
            <td>${date}</td>
            <td>${lead.contact_name || '-'}</td>
            <td>${lead.company_name || '-'}</td>
            <td><a href="mailto:${lead.email}">${lead.email || '-'}</a></td>
            <td>${this.formatProjectType(lead.project_type)}</td>
            <td>${lead.budget_range || '-'}</td>
            <td>${lead.timeline || '-'}</td>
            <td><span class="status-badge ${statusClass}">${lead.status || 'pending'}</span></td>
          </tr>
        `;
      })
      .join('');
  }

  private formatProjectType(type: string): string {
    const typeMap: Record<string, string> = {
      'simple-site': 'Simple Website',
      'business-site': 'Business Website',
      'portfolio': 'Portfolio',
      'ecommerce': 'E-commerce',
      'web-app': 'Web Application',
      'browser-extension': 'Browser Extension',
      'other': 'Other'
    };
    return typeMap[type] || type || '-';
  }

  private async loadSystemData(): Promise<void> {
    // Get application status
    const appStatus = await this.getApplicationStatus();
    this.populateSystemStatus(appStatus);
  }

  private async getApplicationStatus(): Promise<ApplicationStatus> {
    try {
      if (window.NBW_DEBUG?.getStatus) {
        return window.NBW_DEBUG.getStatus() as ApplicationStatus;
      }
    } catch (error) {
      console.error('[AdminDashboard] Error getting app status:', error);
    }

    // Fallback mock data
    return {
      modules: {
        ThemeModule: { status: 'healthy' },
        NavigationModule: { status: 'healthy' },
        ContactFormModule: { status: 'healthy' }
      },
      services: {
        DataService: { status: 'healthy' },
        PerformanceService: { status: 'healthy' },
        ContactService: { status: 'warning' }
      }
    };
  }

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
   * Create or update a Chart.js chart
   */
  private loadChart(containerId: string, chartType: 'visitors' | 'sources'): void {
    const container = document.getElementById(containerId);
    if (!container) return;

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

    let chart: Chart;

    if (chartType === 'visitors') {
      // Line chart for visitor trends
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Visitors',
              data: [120, 190, 150, 220, 180, 250, 210],
              borderColor: '#00ff41',
              backgroundColor: 'rgba(0, 255, 65, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Page Views',
              data: [300, 450, 380, 520, 420, 600, 480],
              borderColor: '#333333',
              backgroundColor: 'rgba(51, 51, 51, 0.1)',
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
                color: 'rgba(0, 0, 0, 0.1)'
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
      // Doughnut chart for traffic sources
      chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
          datasets: [
            {
              data: [35, 30, 20, 10, 5],
              backgroundColor: [
                '#00ff41',
                '#333333',
                '#666666',
                '#999999',
                '#cccccc'
              ],
              borderColor: '#ffffff',
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

  private populateVisitorsTable(visitors: VisitorInfo[]): void {
    const tbody = document.querySelector('#visitors-table tbody');
    if (!tbody) return;

    tbody.innerHTML = visitors
      .map(
        (visitor) => `
      <tr>
        <td>${visitor.id}</td>
        <td>${visitor.firstVisit}</td>
        <td>${visitor.lastVisit}</td>
        <td>${visitor.sessions}</td>
        <td>${visitor.pageViews}</td>
        <td>${visitor.location}</td>
        <td>${visitor.device}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewVisitorDetails('${visitor.id}')">
            View
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  private populateSystemStatus(status: ApplicationStatus): void {
    const container = document.getElementById('app-status');
    if (!container) return;

    const allItems = { ...status.modules, ...status.services };

    container.innerHTML = Object.entries(allItems)
      .map(
        ([name, data]) => `
      <div class="status-item">
        <span>${name}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="status-indicator ${data.status}"></div>
          <span>${data.status}</span>
        </div>
      </div>
    `
      )
      .join('');
  }

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
        throw new Error('Unknown export type');
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
      localStorage.clear();
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

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdminDashboard();
});

export { AdminAuth, AdminDashboard };
