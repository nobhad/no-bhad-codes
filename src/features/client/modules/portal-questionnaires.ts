/**
 * ===============================================
 * PORTAL QUESTIONNAIRES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires.ts
 *
 * Client portal UI for viewing and completing questionnaires.
 * Delegates all rendering to the React portalQuestionnaires component.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalQuestionnaires');

// Track React unmount function
let reactQuestionnairesUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal questionnaires
 */
export function cleanupPortalQuestionnaires(): void {
  if (reactQuestionnairesUnmountFn) {
    reactQuestionnairesUnmountFn();
    reactQuestionnairesUnmountFn = null;
  }
}

/**
 * Load questionnaires - mounts React component
 */
export async function loadQuestionnaires(context: ClientPortalContext): Promise<void> {
  const component = getReactComponent('portalQuestionnaires');
  const container =
    document.getElementById('questionnaires-list') ||
    document.querySelector('.questionnaires-section');

  if (!component || !container) {
    logger.error('React component or container not found');
    return;
  }

  const unmountResult = component.mount(container as HTMLElement, {
    getAuthToken: context.getAuthToken,
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      showToast(message, type);
    }
  });

  if (typeof unmountResult === 'function') {
    reactQuestionnairesUnmountFn = unmountResult;
  }
}
