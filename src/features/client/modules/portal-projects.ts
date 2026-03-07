/**
 * ===============================================
 * PORTAL PROJECTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-projects.ts
 *
 * Project loading and display for client portal.
 * Delegates all rendering to the React portalProjects component.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalProjects');

// Track React unmount function
let reactProjectsUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal projects
 */
export function cleanupPortalProjects(): void {
  if (reactProjectsUnmountFn) {
    reactProjectsUnmountFn();
    reactProjectsUnmountFn = null;
  }
}

/**
 * Load projects - mounts React component
 */
export async function loadProjects(ctx: ClientPortalContext): Promise<void> {
  const container =
    document.getElementById('projects-list') || document.querySelector('.projects-section');
  if (!container) return;

  const component = getReactComponent('portalProjects');
  if (component) {
    const unmountResult = component.mount(container as HTMLElement, {
      getAuthToken: ctx.getAuthToken,
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        showToast(message, type);
      }
    });

    if (typeof unmountResult === 'function') {
      reactProjectsUnmountFn = unmountResult;
    }

    return;
  }

  logger.error('React component not found');
}
