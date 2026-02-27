/**
 * Portal Ad-Hoc Requests Mount
 * Island architecture mount function for PortalAdHocRequests
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalAdHocRequests } from './PortalAdHocRequests';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalAdHocRequestsMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalAdHocRequests component into a container element
 */
export function mountPortalAdHocRequests(
  container: HTMLElement,
  options: PortalAdHocRequestsMountOptions = {}
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
      <PortalAdHocRequests
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalAdHocRequests(container);
  };
}

/**
 * Unmount the PortalAdHocRequests component from a container element
 */
export function unmountPortalAdHocRequests(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal ad-hoc requests should be used
 */
export function shouldUseReactPortalAdHocRequests(): boolean {
  return true;
}
