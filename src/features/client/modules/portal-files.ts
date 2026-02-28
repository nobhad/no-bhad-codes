/**
 * ===============================================
 * PORTAL FILES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-files.ts
 *
 * File management functionality for client portal.
 * Uses React component for all functionality.
 */

import type { ClientPortalContext } from '../portal-types';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { createLogger } from '../../../utils/logger';
import { createReactCleanupHandler } from '../../../utils/react-cleanup';

const logger = createLogger('PortalFiles');

// React cleanup handler
const reactFilesCleanup = createReactCleanupHandler();

/**
 * Cleanup React portal files
 */
export function cleanupPortalFiles(): void {
  reactFilesCleanup.cleanup();
}

/**
 * Load files - mounts React component
 */
export async function loadFiles(ctx: ClientPortalContext): Promise<void> {
  const filesContainer =
    document.getElementById('files-list') ||
    document.querySelector('.files-list-section');

  if (!filesContainer) {
    logger.error('Container not found');
    return;
  }

  const component = getReactComponent('portalFiles');
  if (!component) {
    logger.error('React component not found');
    // Show error state instead of leaving loading spinner
    filesContainer.innerHTML = `
      <div class="files-error" style="text-align: center; padding: 2rem;">
        <p style="color: var(--portal-text-muted);">Unable to load files. Please refresh the page.</p>
        <button class="btn btn-secondary" onclick="window.location.reload()">Refresh</button>
      </div>
    `;
    return;
  }

  // Hide vanilla elements - React renders its own
  const folderTree = document.getElementById('folder-tree');
  const uploadDropzone = document.getElementById('upload-dropzone');
  if (folderTree) folderTree.style.display = 'none';
  if (uploadDropzone) uploadDropzone.style.display = 'none';

  // Mount React component
  const unmountResult = component.mount(filesContainer as HTMLElement, {
    getAuthToken: ctx.getAuthToken,
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      showToast(message, type);
    }
  });

  if (typeof unmountResult === 'function') {
    reactFilesCleanup.setUnmount(unmountResult);
  }
}

/**
 * Reset files module state - no-op as React component handles its own state
 */
export function resetFilesState(): void {
  // React component handles its own state management
}
