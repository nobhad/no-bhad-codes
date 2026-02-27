/**
 * Client Detail Mount
 * Mounts the React ClientDetail component into a DOM container
 */

import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ClientDetail } from './ClientDetail';

// Track mounted roots for cleanup
const mountedRoots = new Map<HTMLElement, Root>();

export interface ClientDetailMountOptions {
  /** Client ID to display */
  clientId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to clients list */
  onBack?: () => void;
  /** Callback to edit client */
  onEdit?: (clientId: number) => void;
  /** Callback to view project */
  onViewProject?: (projectId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the ClientDetail component into a container
 */
export function mountClientDetail(
  container: HTMLElement,
  options: ClientDetailMountOptions
): void {
  // Unmount existing if any
  unmountClientDetail(container);

  // Create new root
  const root = createRoot(container);
  mountedRoots.set(container, root);

  // Render component
  root.render(
    <React.StrictMode>
      <ClientDetail
        clientId={options.clientId}
        getAuthToken={options.getAuthToken}
        onBack={options.onBack}
        onEdit={options.onEdit}
        onViewProject={options.onViewProject}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );
}

/**
 * Unmount the ClientDetail component from a container
 */
export function unmountClientDetail(container: HTMLElement): void {
  const root = mountedRoots.get(container);
  if (root) {
    root.unmount();
    mountedRoots.delete(container);
  }
}

/**
 * Check if a container has a mounted ClientDetail
 */
export function isClientDetailMounted(container: HTMLElement): boolean {
  return mountedRoots.has(container);
}
