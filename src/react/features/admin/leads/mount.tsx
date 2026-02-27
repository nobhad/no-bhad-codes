import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LeadsTable } from './LeadsTable';

// Store root reference for cleanup
let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

interface MountOptions {
  /** Auth token getter */
  getAuthToken?: () => string | null;
  /** Callback when lead is viewed */
  onViewLead?: (leadId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the React LeadsTable into a container element
 */
export function mountLeadsTable(
  container: HTMLElement | string,
  options: MountOptions = {}
): void {
  const element = typeof container === 'string'
    ? document.querySelector(container) as HTMLElement
    : container;

  if (!element) {
    console.error('[React LeadsTable] Container not found:', container);
    return;
  }

  // If container changed or root is stale, create new root
  if (root && mountedContainer !== element) {
    try {
      root.unmount();
    } catch {
      // Ignore unmount errors
    }
    root = null;
    mountedContainer = null;
  }

  // Create root if needed
  if (!root) {
    element.classList.add('react-portal-mount');
    root = createRoot(element);
    mountedContainer = element;
  }

  root.render(
    <React.StrictMode>
      <LeadsTable
        getAuthToken={options.getAuthToken}
        onViewLead={options.onViewLead}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );
}

/**
 * Unmount the React LeadsTable
 */
export function unmountLeadsTable(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.classList.remove('react-portal-mount');
    mountedContainer = null;
  }
}

/**
 * Check if React leads table should be used based on feature flag
 */
export function shouldUseReactLeadsTable(): boolean {
  // Check localStorage
  const localFlag = localStorage.getItem('feature_react_leads_table');
  if (localFlag === 'true') return true;

  // Check URL param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('react_leads') === 'true') return true;

  return false;
}
