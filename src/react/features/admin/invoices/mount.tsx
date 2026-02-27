import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { InvoicesTable } from './InvoicesTable';

// Track mounted root for cleanup
let invoicesTableRoot: Root | null = null;

interface MountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when invoice is clicked for detail view */
  onViewInvoice?: (invoiceId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the React InvoicesTable component
 * @param container - DOM element or selector to mount into
 * @param options - Mount options including callbacks
 */
export function mountInvoicesTable(
  container: HTMLElement | string,
  options: MountOptions
): void {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('[mountInvoicesTable] Container not found:', container);
    return;
  }

  // Cleanup any existing mount
  if (invoicesTableRoot) {
    invoicesTableRoot.unmount();
    invoicesTableRoot = null;
  }

  // Add brutalist styling class
  element.classList.add('react-portal-mount');

  // Create new root and render
  invoicesTableRoot = createRoot(element);
  invoicesTableRoot.render(
    <React.StrictMode>
      <InvoicesTable
        getAuthToken={options.getAuthToken}
        onViewInvoice={options.onViewInvoice}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );
}

/**
 * Unmount the React InvoicesTable component
 */
export function unmountInvoicesTable(): void {
  if (invoicesTableRoot) {
    invoicesTableRoot.unmount();
    invoicesTableRoot = null;
  }
  // Remove styling class from any element that has it
  const element = document.querySelector('.react-portal-mount');
  if (element) {
    element.classList.remove('react-portal-mount');
  }
}

/**
 * Check if React invoices table should be used
 * Always returns true - React is the default implementation
 */
export function shouldUseReactInvoicesTable(): boolean {
  return true;
}
