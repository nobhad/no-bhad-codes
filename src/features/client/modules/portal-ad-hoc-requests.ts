/**
 * ===============================================
 * PORTAL AD HOC REQUESTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-ad-hoc-requests.ts
 *
 * Client portal: submit ad hoc requests and view history.
 * Uses React component for all functionality.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalAdHocRequests');

// Track React unmount function
let reactAdHocRequestsUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal ad-hoc requests
 */
export function cleanupPortalAdHocRequests(): void {
  if (reactAdHocRequestsUnmountFn) {
    reactAdHocRequestsUnmountFn();
    reactAdHocRequestsUnmountFn = null;
  }
}

/**
 * Load ad-hoc requests - mounts React component
 */
export async function loadAdHocRequests(ctx: ClientPortalContext): Promise<void> {
  const component = getReactComponent('portalAdHocRequests');
  const container =
    document.getElementById('ad-hoc-requests-section') ||
    document.querySelector('.ad-hoc-requests-section');

  if (!component || !container) {
    logger.error('React component or container not found');
    return;
  }

  // Mount React component
  const unmountResult = component.mount(container as HTMLElement, {
    getAuthToken: ctx.getAuthToken,
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      showToast(message, type);
    }
  });

  if (typeof unmountResult === 'function') {
    reactAdHocRequestsUnmountFn = unmountResult;
  }
}
