/**
 * ===============================================
 * PORTAL DOCUMENT REQUESTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-document-requests.ts
 *
 * Documents tab: list document requests, view one, mark viewed, upload.
 * Uses React component for all functionality.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalDocumentRequests');

// Track React unmount function
let reactDocRequestsUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal document requests
 */
export function cleanupPortalDocumentRequests(): void {
  if (reactDocRequestsUnmountFn) {
    reactDocRequestsUnmountFn();
    reactDocRequestsUnmountFn = null;
  }
}

/**
 * Load document requests - mounts React component
 */
export async function loadDocumentRequests(ctx: ClientPortalContext): Promise<void> {
  const component = getReactComponent('portalDocumentRequests');
  const container =
    document.getElementById('documents-list') ||
    document.querySelector('.documents-list');

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
    reactDocRequestsUnmountFn = unmountResult;
  }
}
