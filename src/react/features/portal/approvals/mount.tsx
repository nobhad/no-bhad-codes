/**
 * Portal Approvals Mount
 * Island architecture mount function for PortalApprovals
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalApprovals, type PortalApprovalsProps } from './PortalApprovals';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalApprovalsMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to navigate to entity detail */
  onNavigate?: (entityType: string, entityId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalApprovals component into a container element
 */
export function mountPortalApprovals(
  container: HTMLElement,
  options: PortalApprovalsMountOptions = {}
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
      <PortalApprovals
        getAuthToken={options.getAuthToken}
        onNavigate={options.onNavigate}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalApprovals(container);
  };
}

/**
 * Unmount the PortalApprovals component from a container element
 */
export function unmountPortalApprovals(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal approvals should be used
 */
export function shouldUseReactPortalApprovals(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_portal_approvals') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_portal_approvals');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
