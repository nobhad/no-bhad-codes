/**
 * ===============================================
 * ADMIN SYSTEM STATUS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-system-status.ts
 *
 * System status and health check functionality for admin dashboard.
 * Monitors module and service health.
 * Dynamically imported for code splitting.
 */

import type { AdminDashboardContext, ApplicationStatus, StatusItem } from '../admin-types';
import { APP_CONSTANTS } from '../../../config/constants';
import { apiFetch } from '../../../utils/api-client';
import { getStatusDotHTML } from '../../../components/status-badge';

let systemListenersInitialized = false;

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>',
  TRASH: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  MAIL: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  CLOCK: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the System Status tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderSystemStatusTab(container: HTMLElement): void {
  container.innerHTML = `
    <!-- Health Check -->
    <div class="portal-project-card portal-shadow">
      <div class="section-header-with-actions">
        <h3>Health Check</h3>
        <button type="button" class="icon-btn" id="btn-refresh-health" title="Refresh health status" aria-label="Refresh health status">
          <span class="icon-btn-svg">${RENDER_ICONS.REFRESH}</span>
        </button>
      </div>
      <div class="health-check-grid" id="health-check-status">
        <div class="health-item">
          <span class="health-indicator health-loading" id="health-database"></span>
          <span class="health-label">Database</span>
          <span class="health-status" id="health-database-status">Checking...</span>
        </div>
        <div class="health-item">
          <span class="health-indicator health-loading" id="health-email"></span>
          <span class="health-label">Email Service</span>
          <span class="health-status" id="health-email-status">Checking...</span>
        </div>
        <div class="health-item">
          <span class="health-indicator health-loading" id="health-storage"></span>
          <span class="health-label">File Storage</span>
          <span class="health-status" id="health-storage-status">Checking...</span>
        </div>
        <div class="health-item">
          <span class="health-indicator health-loading" id="health-scheduler"></span>
          <span class="health-label">Scheduler</span>
          <span class="health-status" id="health-scheduler-status">Checking...</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="portal-project-card portal-shadow">
      <h3>Quick Actions</h3>
      <div class="quick-actions-grid">
        <button type="button" class="btn btn-secondary" id="btn-clear-cache" title="Clear application cache">
          ${RENDER_ICONS.TRASH}
          Clear Cache
        </button>
        <button type="button" class="btn btn-secondary" id="btn-test-email" title="Send test email">
          ${RENDER_ICONS.MAIL}
          Test Email
        </button>
        <button type="button" class="btn btn-secondary" id="btn-run-scheduler" title="Force run scheduled tasks">
          ${RENDER_ICONS.CLOCK}
          Run Scheduler
        </button>
      </div>
    </div>

    <!-- Recent Errors -->
    <div class="portal-project-card portal-shadow">
      <h3>Recent Errors</h3>
      <div class="recent-errors-list" id="recent-errors-list">
        <p class="empty-state-text">No recent errors</p>
      </div>
    </div>

    <!-- Build Information -->
    <details class="portal-project-card portal-shadow system-details" open>
      <summary><h3>Build Information</h3></summary>
      <div class="system-info-grid">
        <div class="system-info-row">
          <span>Version</span>
          <span id="sys-version">10.0.0</span>
        </div>
        <div class="system-info-row">
          <span>Environment</span>
          <span id="sys-environment">development</span>
        </div>
        <div class="system-info-row">
          <span>Build Date</span>
          <span id="sys-build-date">-</span>
        </div>
      </div>
    </details>

    <!-- Browser Information -->
    <details class="portal-project-card portal-shadow system-details">
      <summary><h3>Browser Information</h3></summary>
      <div class="system-info-grid">
        <div class="system-info-row">
          <span>User Agent</span>
          <span id="sys-useragent" class="truncate-text">-</span>
        </div>
        <div class="system-info-row">
          <span>Screen Resolution</span>
          <span id="sys-screen">-</span>
        </div>
        <div class="system-info-row">
          <span>Viewport Size</span>
          <span id="sys-viewport">-</span>
        </div>
      </div>
    </details>

    <!-- Legacy Module/Service Status (hidden, for backwards compat) -->
    <div class="sr-only" aria-hidden="true">
      <div id="modules-status"></div>
      <div id="services-status"></div>
    </div>
  `;

  // Reset listeners initialization so they get re-attached
  systemListenersInitialized = false;
}

/**
 * Load system status data for admin dashboard
 */
export async function loadSystemData(ctx: AdminDashboardContext): Promise<void> {
  // Setup event listeners once
  setupSystemEventListeners(ctx);

  try {
    // Load health check and legacy status in parallel
    await Promise.all([
      loadHealthCheck(),
      loadLegacyStatus()
    ]);

    // Populate browser info
    populateBrowserInfo();
  } catch (error) {
    console.error('[AdminSystemStatus] Error loading system data:', error);
    showSystemError();
  }
}

/**
 * Setup event listeners for system status UI
 */
function setupSystemEventListeners(ctx: AdminDashboardContext): void {
  if (systemListenersInitialized) return;
  systemListenersInitialized = true;

  // Refresh health button
  const refreshBtn = document.getElementById('btn-refresh-health');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      await loadHealthCheck();
      refreshBtn.classList.remove('spinning');
    });
  }

  // Clear cache button
  const clearCacheBtn = document.getElementById('btn-clear-cache') as HTMLButtonElement | null;
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      clearCacheBtn.disabled = true;
      try {
        // Clear localStorage (except auth tokens)
        const keysToKeep = ['client_auth_token', 'clientAuthToken', 'admin_session', 'theme'];
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.includes(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear sessionStorage (except auth tokens)
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && !keysToKeep.includes(key)) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

        ctx.showNotification('Cache cleared successfully', 'success');
      } catch (error) {
        console.error('[AdminSystem] Failed to clear cache:', error);
        ctx.showNotification('Failed to clear cache', 'error');
      } finally {
        clearCacheBtn.disabled = false;
      }
    });
  }

  // Test email button
  const testEmailBtn = document.getElementById('btn-test-email') as HTMLButtonElement | null;
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async () => {
      testEmailBtn.disabled = true;
      try {
        const res = await apiFetch('/api/admin/test-email', { method: 'POST' });
        if (res.ok) {
          ctx.showNotification('Test email sent', 'success');
        } else {
          const data = await res.json().catch(() => ({}));
          ctx.showNotification(data.error || 'Failed to send test email', 'error');
        }
      } catch (error) {
        console.error('[AdminSystem] Failed to send test email:', error);
        ctx.showNotification('Failed to send test email', 'error');
      } finally {
        testEmailBtn.disabled = false;
      }
    });
  }

  // Run scheduler button
  const runSchedulerBtn = document.getElementById('btn-run-scheduler') as HTMLButtonElement | null;
  if (runSchedulerBtn) {
    runSchedulerBtn.addEventListener('click', async () => {
      runSchedulerBtn.disabled = true;
      try {
        const res = await apiFetch('/api/admin/run-scheduler', { method: 'POST' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          ctx.showNotification(data.message || 'Scheduler run triggered', 'success');
        } else {
          const data = await res.json().catch(() => ({}));
          ctx.showNotification(data.error || 'Failed to run scheduler', 'error');
        }
      } catch (error) {
        console.error('[AdminSystem] Failed to run scheduler:', error);
        ctx.showNotification('Failed to run scheduler', 'error');
      } finally {
        runSchedulerBtn.disabled = false;
      }
    });
  }
}

/**
 * Load health check status
 */
async function loadHealthCheck(): Promise<void> {
  const healthItems = [
    { id: 'database', label: 'Database', check: checkDatabaseHealth },
    { id: 'email', label: 'Email Service', check: checkEmailHealth },
    { id: 'storage', label: 'File Storage', check: checkStorageServiceHealth },
    { id: 'scheduler', label: 'Scheduler', check: checkSchedulerHealth }
  ];

  // Check all health items in parallel
  await Promise.all(healthItems.map(async (item) => {
    const indicator = document.getElementById(`health-${item.id}`);
    const status = document.getElementById(`health-${item.id}-status`);

    if (indicator && status) {
      // Set loading state
      indicator.className = 'health-indicator health-loading';
      status.textContent = 'Checking...';

      try {
        const result = await item.check();
        indicator.className = `health-indicator health-${result.status}`;
        status.textContent = result.message;
      } catch {
        indicator.className = 'health-indicator health-error';
        status.textContent = 'Check failed';
      }
    }
  }));
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<{ status: string; message: string }> {
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { status: 'ok', message: data.database || 'Connected' };
    }
    return { status: 'warning', message: 'Degraded' };
  } catch {
    return { status: 'error', message: 'Unreachable' };
  }
}

/**
 * Check email service health
 */
async function checkEmailHealth(): Promise<{ status: string; message: string }> {
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.email === 'configured' || data.services?.email) {
        return { status: 'ok', message: 'Configured' };
      }
      return { status: 'warning', message: 'Not configured' };
    }
    return { status: 'warning', message: 'Unknown' };
  } catch {
    return { status: 'error', message: 'Check failed' };
  }
}

/**
 * Check file storage health
 */
async function checkStorageServiceHealth(): Promise<{ status: string; message: string }> {
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) {
      return { status: 'ok', message: 'Available' };
    }
    return { status: 'warning', message: 'Unknown' };
  } catch {
    return { status: 'error', message: 'Check failed' };
  }
}

/**
 * Check scheduler health
 */
async function checkSchedulerHealth(): Promise<{ status: string; message: string }> {
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.scheduler) {
        return { status: 'ok', message: data.scheduler };
      }
      return { status: 'ok', message: 'Running' };
    }
    return { status: 'warning', message: 'Unknown' };
  } catch {
    return { status: 'error', message: 'Check failed' };
  }
}

/**
 * Load legacy status (modules/services for hidden elements)
 */
async function loadLegacyStatus(): Promise<void> {
  try {
    const status = await getApplicationStatus();
    populateSystemStatus(status);
  } catch {
    // Silent fail - legacy status is optional
  }
}

/**
 * Populate browser info
 */
function populateBrowserInfo(): void {
  const userAgentEl = document.getElementById('sys-useragent');
  const screenEl = document.getElementById('sys-screen');
  const viewportEl = document.getElementById('sys-viewport');
  const buildDateEl = document.getElementById('sys-build-date');
  const envEl = document.getElementById('sys-environment');

  if (userAgentEl) {
    userAgentEl.textContent = navigator.userAgent;
    userAgentEl.title = navigator.userAgent;
  }

  if (screenEl) {
    screenEl.textContent = `${screen.width} × ${screen.height}`;
  }

  if (viewportEl) {
    viewportEl.textContent = `${window.innerWidth} × ${window.innerHeight}`;
  }

  if (buildDateEl) {
    buildDateEl.textContent = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  if (envEl) {
    envEl.textContent = import.meta.env?.MODE || 'development';
  }
}

/**
 * Get application status from window.NBW_DEBUG or check services directly
 */
export async function getApplicationStatus(): Promise<ApplicationStatus> {
  // Try to get status from NBW_DEBUG first
  if (window.NBW_DEBUG?.getStatus) {
    try {
      const status = window.NBW_DEBUG.getStatus() as ApplicationStatus;
      if (status && status.modules) {
        return status;
      }
    } catch (error) {
      console.warn('[AdminSystemStatus] Could not get status from NBW_DEBUG:', error);
    }
  }

  // Check services directly
  return await checkServicesDirectly();
}

/**
 * Check services directly when NBW_DEBUG is not available
 */
async function checkServicesDirectly(): Promise<ApplicationStatus> {
  const modules: Record<string, StatusItem> = {};
  const services: Record<string, StatusItem> = {};

  // Check if we're in admin context (different page from main site)
  const isAdminPage = window.location.pathname.includes('/admin');

  // Check backend API health
  const apiHealth = await checkApiHealth();
  services['API Server'] = apiHealth;

  // Check authentication status
  const authToken = sessionStorage.getItem('client_auth_token') || sessionStorage.getItem('clientAuthToken');
  services['Authentication'] = {
    status: authToken ? 'healthy' : 'warning',
    message: authToken ? 'Authenticated' : 'Not authenticated'
  };

  // Check localStorage availability
  const storageHealth = checkStorageHealth();
  services['Local Storage'] = storageHealth;

  // Check visitor tracking
  const trackingEvents = getTrackingEventCount();
  services['Visitor Tracking'] = {
    status: trackingEvents > 0 ? 'healthy' : 'warning',
    message: trackingEvents > 0 ? `${trackingEvents} events recorded` : 'No tracking data'
  };

  // Module health - check if essential modules are loaded
  if (!isAdminPage) {
    // On main site, check for loaded modules
    const moduleChecks: Array<{ name: string; selector: string }> = [
      { name: 'Navigation', selector: '.navigation, .nav-menu' },
      { name: 'Business Card', selector: '#business-card, .business-card' },
      { name: 'Contact Form', selector: '.contact-form, #contact-form' },
      { name: 'Footer', selector: 'footer, .footer' }
    ];

    moduleChecks.forEach(({ name, selector }) => {
      const element = document.querySelector(selector);
      modules[`${name}Module`] = {
        status: element ? 'healthy' : 'warning',
        message: element ? 'Loaded' : 'Not found on page'
      };
    });
  } else {
    // On admin page, check admin modules
    modules['AdminDashboard'] = { status: 'healthy', message: 'Active' };
    modules['ThemeModule'] = {
      status: document.documentElement.hasAttribute('data-theme') ? 'healthy' : 'warning',
      message: 'Theme system active'
    };
  }

  return { modules, services };
}

/**
 * Check API server health
 */
async function checkApiHealth(): Promise<StatusItem> {
  // Use globalThis to access AbortController (browser global)
  const AbortControllerClass = globalThis.AbortController;
  const controller = new AbortControllerClass();
  const timeoutId = setTimeout(() => controller.abort(), APP_CONSTANTS.TIMERS.API_REQUEST_TIMEOUT);

  try {
    const startTime = Date.now();
    const response = await apiFetch('/api/health', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: responseTime < 500 ? 'healthy' : 'warning',
        responseTime,
        message: `Response time: ${responseTime}ms`
      };
    }

    return {
      status: 'warning',
      message: `Status: ${response.status}`
    };
  } catch (error) {
    console.error('[AdminSystem] Health check failed, trying root endpoint:', error);
    clearTimeout(timeoutId);
    // API might not have a /health endpoint, try root
    const rootController = new AbortControllerClass();
    const rootTimeoutId = setTimeout(() => rootController.abort(), APP_CONSTANTS.TIMERS.API_REQUEST_TIMEOUT);

    try {
      const response = await apiFetch('/api', {
        method: 'GET',
        signal: rootController.signal
      });
      clearTimeout(rootTimeoutId);

      return {
        status: response.ok ? 'healthy' : 'warning',
        message: response.ok ? 'API responding' : 'API returned error'
      };
    } catch {
      clearTimeout(rootTimeoutId);
      return {
        status: 'error',
        message: 'API unreachable'
      };
    }
  }
}

/**
 * Check localStorage health
 */
function checkStorageHealth(): StatusItem {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);

    // Check storage usage
    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalSize += localStorage.getItem(key)?.length || 0;
      }
    }

    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      status: 'healthy',
      message: `Using ${sizeMB} MB`
    };
  } catch {
    return {
      status: 'error',
      message: 'Storage unavailable'
    };
  }
}

/**
 * Get tracking event count
 */
function getTrackingEventCount(): number {
  try {
    const events = localStorage.getItem('nbw_tracking_events');
    return events ? JSON.parse(events).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Populate system status UI
 */
function populateSystemStatus(status: ApplicationStatus): void {
  const modulesContainer = document.getElementById('modules-status');
  const servicesContainer = document.getElementById('services-status');

  if (modulesContainer) {
    modulesContainer.innerHTML = renderStatusList(status.modules, 'Module');
  }

  if (servicesContainer) {
    servicesContainer.innerHTML = renderStatusList(status.services, 'Service');
  }
}

/**
 * Render status list HTML
 */
function renderStatusList(items: Record<string, StatusItem>, type: string): string {
  const entries = Object.entries(items);

  if (entries.length === 0) {
    return `<p class="no-status">No ${type.toLowerCase()}s to display</p>`;
  }

  return entries.map(([name, item]) => {
    // Handle cases where status is undefined (e.g., { loaded: true })
    const status = item.status || (item.loaded ? 'healthy' : 'unknown');
    const statusClass = getStatusClass(status);
    const statusIcon = getStatusIcon(status);

    return `
      <div class="status-item ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-name">${formatName(name)}</span>
        ${getStatusDotHTML(status)}
      </div>
    `;
  }).join('');
}

/**
 * Get CSS class for status
 */
function getStatusClass(status: string): string {
  switch (status) {
  case 'healthy':
    return 'status-healthy';
  case 'warning':
    return 'status-warning';
  case 'error':
    return 'status-error';
  default:
    return 'status-unknown';
  }
}

/**
 * Get icon for status
 */
function getStatusIcon(status: string): string {
  switch (status) {
  case 'healthy':
    return '✓';
  case 'warning':
    return '⚠';
  case 'error':
    return '✗';
  default:
    return '?';
  }
}

/**
 * Format module/service name for display
 */
function formatName(name: string): string {
  // Remove "Module" or "Service" suffix if present
  return name
    .replace(/Module$/, '')
    .replace(/Service$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

/**
 * Show system error state
 */
function showSystemError(): void {
  const modulesContainer = document.getElementById('modules-status');
  const servicesContainer = document.getElementById('services-status');

  const errorHtml = '<p class="status-error">Unable to retrieve system status</p>';

  if (modulesContainer) {
    modulesContainer.innerHTML = errorHtml;
  }

  if (servicesContainer) {
    servicesContainer.innerHTML = errorHtml;
  }
}

/**
 * Get overall system health
 */
export async function getSystemHealth(): Promise<'healthy' | 'warning' | 'error'> {
  const status = await getApplicationStatus();

  const allStatuses = [
    ...Object.values(status.modules).map(m => m.status),
    ...Object.values(status.services).map(s => s.status)
  ];

  if (allStatuses.some(s => s === 'error')) {
    return 'error';
  }

  if (allStatuses.some(s => s === 'warning')) {
    return 'warning';
  }

  return 'healthy';
}

/**
 * Refresh system status
 */
export async function refreshSystemStatus(ctx: AdminDashboardContext): Promise<void> {
  await loadSystemData(ctx);
}
