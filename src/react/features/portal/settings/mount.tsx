/**
 * Portal Settings Mount
 * Island architecture mount function for PortalSettings
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalSettings } from './PortalSettings';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalSettingsMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalSettings component into a container element
 */
export function mountPortalSettings(
  container: HTMLElement,
  options: PortalSettingsMountOptions = {}
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
      <PortalSettings
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalSettings(container);
  };
}

/**
 * Unmount the PortalSettings component from a container element
 */
export function unmountPortalSettings(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal settings should be used
 */
export function shouldUseReactPortalSettings(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_portal_settings') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_portal_settings');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
