/**
 * Portal Files Mount
 * Island architecture mount function for PortalFilesManager
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalFilesManager } from './PortalFilesManager';
import { ErrorBoundary } from '../../../components/portal/ErrorBoundary';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalFilesMountOptions {
  /** Filter files by project ID */
  projectId?: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalFilesManager component into a container element
 */
export function mountPortalFiles(
  container: HTMLElement,
  options: PortalFilesMountOptions = {}
): () => void {
  // Clean up existing root if present
  const existingRoot = roots.get(container);
  if (existingRoot) {
    existingRoot.unmount();
    roots.delete(container);
  }

  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    <React.StrictMode>
      <ErrorBoundary componentName="Files">
        <PortalFilesManager
          projectId={options.projectId}
          getAuthToken={options.getAuthToken}
          showNotification={options.showNotification}
        />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalFiles(container);
  };
}

/**
 * Unmount the PortalFilesManager component from a container element
 */
export function unmountPortalFiles(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal files should be used
 */
export function shouldUseReactPortalFiles(): boolean {
  return true;
}
