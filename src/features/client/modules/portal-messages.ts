/**
 * ===============================================
 * PORTAL MESSAGES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-messages.ts
 *
 * Messaging functionality for client portal.
 * Dynamically imported for code splitting.
 * Delegates all rendering to the React portalMessages component.
 */

import type { ClientPortalContext } from '../portal-types';
import { showToast } from '../../../utils/toast-notifications';
import { renderErrorState } from '../../../components/empty-state';
import { getReactComponent } from '../../../react/registry';
import { createReactCleanupHandler } from '../../../utils/react-cleanup';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalMessages');

// React cleanup handler
const reactMessagesCleanup = createReactCleanupHandler();

/**
 * Cleanup React portal messages
 */
export function cleanupReactPortalMessages(): void {
  reactMessagesCleanup.cleanup();
}

/**
 * Load messages - mounts React component
 */
export async function loadMessagesFromAPI(
  ctx: ClientPortalContext,
  _bustCache: boolean = false
): Promise<void> {
  const messagesContainer = document.getElementById('messages-thread');
  if (!messagesContainer) return;

  // Hide vanilla thread list - React renders its own
  const threadList = document.getElementById('thread-list');
  if (threadList) threadList.style.display = 'none';

  const component = getReactComponent('portalMessages');
  if (component) {
    const unmountResult = component.mount(messagesContainer as HTMLElement, {
      getAuthToken: ctx.getAuthToken,
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        showToast(message, type);
      }
    });

    if (typeof unmountResult === 'function') {
      reactMessagesCleanup.setUnmount(unmountResult);
    }

    return;
  }

  // React component not available - show error state
  logger.error('React component not found');
  renderErrorState(messagesContainer as HTMLElement, 'Unable to load messages. Please refresh the page.', {
    onRetry: () => window.location.reload()
  });
}

/**
 * Send a message - no-op, React component handles messaging
 */
export async function sendMessage(_ctx: ClientPortalContext): Promise<void> {
  // React component handles its own message sending
}

/**
 * Setup message event listeners - no-op, React component handles events
 */
export function setupMessageListeners(_ctx: ClientPortalContext): void {
  // React component handles its own event listeners
}

/**
 * Cleanup function to be called when leaving the messages view
 */
export function cleanupMessages(): void {
  reactMessagesCleanup.cleanup();
}
