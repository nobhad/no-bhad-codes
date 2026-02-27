/**
 * Portal Document Requests Mount
 * Island architecture mount function for PortalDocumentRequests
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalDocumentRequests } from './PortalDocumentRequests';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalDocumentRequestsMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalDocumentRequests component into a container element
 */
export function mountPortalDocumentRequests(
  container: HTMLElement,
  options: PortalDocumentRequestsMountOptions = {}
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
      <PortalDocumentRequests
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalDocumentRequests(container);
  };
}

/**
 * Unmount the PortalDocumentRequests component from a container element
 */
export function unmountPortalDocumentRequests(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal document requests should be used
 */
export function shouldUseReactPortalDocumentRequests(): boolean {
  return true;
}
