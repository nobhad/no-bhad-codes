/**
 * ===============================================
 * PORTAL INVOICES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-invoices.ts
 *
 * Invoice management functionality for client portal.
 * Dynamically imported for code splitting.
 * Delegates all rendering to the React portalInvoices component.
 */

import type { ClientPortalContext } from '../portal-types';
import { showToast } from '../../../utils/toast-notifications';
import { createErrorState } from '../../../components/empty-state';
import { getReactComponent } from '../../../react/registry';
import { createReactCleanupHandler } from '../../../utils/react-cleanup';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalInvoices');

// React cleanup handler
const reactInvoicesCleanup = createReactCleanupHandler();

/**
 * Cleanup React portal invoices
 */
export function cleanupPortalInvoices(): void {
  reactInvoicesCleanup.cleanup();
}

/**
 * Load invoices - mounts React component
 */
export async function loadInvoices(ctx: ClientPortalContext): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  if (!invoicesContainer) return;

  const component = getReactComponent('portalInvoices');
  if (component) {
    // Hide vanilla summary cards - React renders its own
    const summaryContainer = document.querySelector('.invoices-summary');
    if (summaryContainer) {
      (summaryContainer as HTMLElement).style.display = 'none';
    }

    // Mount React component
    const unmountResult = component.mount(invoicesContainer as HTMLElement, {
      getAuthToken: ctx.getAuthToken,
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        showToast(message, type);
      }
    });

    if (typeof unmountResult === 'function') {
      reactInvoicesCleanup.setUnmount(unmountResult);
    }

    return;
  }

  // React component not available - show error state
  logger.error('React component not found');
  const errorState = createErrorState('Unable to load invoices component. Please refresh the page.', {
    className: 'no-invoices-message',
    onRetry: () => window.location.reload()
  });
  const listContent = invoicesContainer.querySelector('#invoices-list-content');
  if (listContent) {
    listContent.innerHTML = '';
    listContent.appendChild(errorState);
  } else {
    invoicesContainer.appendChild(errorState);
  }
}
