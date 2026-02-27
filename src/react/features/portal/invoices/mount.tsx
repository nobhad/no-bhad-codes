/**
 * Portal Invoices Mount
 * Island architecture mount function for PortalInvoicesTable
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalInvoicesTable } from './PortalInvoicesTable';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalInvoicesMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalInvoicesTable component into a container element
 */
export function mountPortalInvoices(
  container: HTMLElement,
  options: PortalInvoicesMountOptions = {}
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
      <PortalInvoicesTable
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalInvoices(container);
  };
}

/**
 * Unmount the PortalInvoicesTable component from a container element
 */
export function unmountPortalInvoices(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal invoices should be used
 */
export function shouldUseReactPortalInvoices(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_portal_invoices') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_portal_invoices');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
