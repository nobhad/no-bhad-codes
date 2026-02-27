import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ClientsTable } from './ClientsTable';

// Track mounted root for cleanup
let clientsTableRoot: Root | null = null;

interface MountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when client is clicked for detail view */
  onViewClient?: (clientId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the React ClientsTable component
 * @param container - DOM element or selector to mount into
 * @param options - Mount options including callbacks
 */
export function mountClientsTable(
  container: HTMLElement | string,
  options: MountOptions
): void {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('[mountClientsTable] Container not found:', container);
    return;
  }

  // Cleanup any existing mount
  if (clientsTableRoot) {
    clientsTableRoot.unmount();
    clientsTableRoot = null;
  }

  // Add brutalist styling class
  element.classList.add('react-portal-mount');

  // Create new root and render
  clientsTableRoot = createRoot(element);
  clientsTableRoot.render(
    <React.StrictMode>
      <ClientsTable
        getAuthToken={options.getAuthToken}
        onViewClient={options.onViewClient}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );
}

/**
 * Unmount the React ClientsTable component
 */
export function unmountClientsTable(): void {
  if (clientsTableRoot) {
    clientsTableRoot.unmount();
    clientsTableRoot = null;
  }
  // Remove styling class from any element that has it
  const element = document.querySelector('.react-portal-mount');
  if (element) {
    element.classList.remove('react-portal-mount');
  }
}

/**
 * Check if React clients table should be used
 * Based on feature flag in localStorage or URL param
 */
export function shouldUseReactClientsTable(): boolean {
  // Check URL param first
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('react_clients') === 'true') {
    return true;
  }

  // Check localStorage
  try {
    return localStorage.getItem('feature_react_clients_table') === 'true';
  } catch {
    return false;
  }
}
