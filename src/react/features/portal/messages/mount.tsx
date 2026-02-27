/**
 * Portal Messages Mount
 * Island architecture mount function for PortalMessagesView
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalMessagesView } from './PortalMessagesView';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalMessagesMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalMessagesView component into a container element
 */
export function mountPortalMessages(
  container: HTMLElement,
  options: PortalMessagesMountOptions = {}
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
      <PortalMessagesView
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalMessages(container);
  };
}

/**
 * Unmount the PortalMessagesView component from a container element
 */
export function unmountPortalMessages(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal messages should be used
 */
export function shouldUseReactPortalMessages(): boolean {
  return true;
}
