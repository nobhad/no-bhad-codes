/**
 * ===============================================
 * PORTAL SETTINGS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-settings.ts
 *
 * Settings management functionality for client portal.
 * Uses React component for all functionality.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalSettings');

// Track React unmount function
let reactSettingsUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal settings
 */
export function cleanupPortalSettings(): void {
  if (reactSettingsUnmountFn) {
    reactSettingsUnmountFn();
    reactSettingsUnmountFn = null;
  }
}

/**
 * Setup settings forms - mounts React component
 */
export function setupSettingsForms(ctx: ClientPortalContext): void {
  const settingsContainer =
    document.getElementById('settings-content') ||
    document.querySelector('.settings-content');

  // Show error state in container if it exists but component is missing
  if (!settingsContainer) {
    logger.error('Settings container not found');
    return;
  }

  const component = getReactComponent('portalSettings');
  if (!component) {
    logger.error('React component not found');
    // Show error state instead of leaving loading spinner (avoid inline onclick for CSP compliance)
    settingsContainer.innerHTML = `
      <div class="settings-error" style="text-align: center; padding: 2rem;">
        <p style="color: var(--portal-text-muted);">Unable to load settings. Please refresh the page.</p>
        <button class="btn btn-secondary" data-action="reload">Refresh</button>
      </div>
    `;
    // Add event listener for refresh button
    const refreshBtn = settingsContainer.querySelector('[data-action="reload"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => window.location.reload());
    }
    return;
  }

  // Mount React component
  const unmountResult = component.mount(settingsContainer as HTMLElement, {
    getAuthToken: ctx.getAuthToken,
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      showToast(message, type);
    }
  });

  if (typeof unmountResult === 'function') {
    reactSettingsUnmountFn = unmountResult;
  }
}

/**
 * Load user settings - no-op as React component handles data fetching
 */
export async function loadUserSettings(_currentUser: string | null): Promise<void> {
  // React component handles its own data fetching
}
