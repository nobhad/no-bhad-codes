/**
 * Portal Projects Mount
 * Island architecture mount functions for Portal Projects components
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalProjectsList } from './PortalProjectsList';
import { PortalProjectDetail } from './PortalProjectDetail';

// Store roots for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalProjectsMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export interface PortalProjectDetailMountOptions {
  /** Project ID to display */
  projectId: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to projects list */
  onBack?: () => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalProjectsList component into a container element
 */
export function mountPortalProjects(
  container: HTMLElement,
  options: PortalProjectsMountOptions = {}
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
      <PortalProjectsList
        getAuthToken={options.getAuthToken}
        onSelectProject={options.onSelectProject}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalProjects(container);
  };
}

/**
 * Unmount the PortalProjectsList component from a container element
 */
export function unmountPortalProjects(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Mount the PortalProjectDetail component into a container element
 */
export function mountPortalProjectDetail(
  container: HTMLElement,
  options: PortalProjectDetailMountOptions
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
      <PortalProjectDetail
        projectId={options.projectId}
        getAuthToken={options.getAuthToken}
        onBack={options.onBack}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalProjectDetail(container);
  };
}

/**
 * Unmount the PortalProjectDetail component from a container element
 */
export function unmountPortalProjectDetail(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal projects should be used
 */
export function shouldUseReactPortalProjects(): boolean {
  return true;
}
