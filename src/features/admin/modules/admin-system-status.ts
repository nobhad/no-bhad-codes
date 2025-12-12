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

/**
 * Load system status data for admin dashboard
 */
export async function loadSystemData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const status = await getApplicationStatus();
    populateSystemStatus(status);
  } catch (error) {
    console.error('[AdminSystemStatus] Error loading system data:', error);
    showSystemError();
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
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const startTime = Date.now();
    const response = await fetch('/api/health', {
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
  } catch (_error) {
    clearTimeout(timeoutId);
    // API might not have a /health endpoint, try root
    const rootController = new AbortControllerClass();
    const rootTimeoutId = setTimeout(() => rootController.abort(), 5000);

    try {
      const response = await fetch('/api', {
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
    const statusClass = getStatusClass(item.status);
    const statusIcon = getStatusIcon(item.status);
    const message = item.message || item.status;

    return `
      <div class="status-item ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-name">${formatName(name)}</span>
        <span class="status-badge ${statusClass}">${item.status}</span>
        ${message ? `<span class="status-message">${message}</span>` : ''}
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
