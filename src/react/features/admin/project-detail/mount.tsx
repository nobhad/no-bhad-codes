import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProjectDetail } from './ProjectDetail';

// Track mounted roots for cleanup
const mountedRoots = new Map<HTMLElement, Root>();

interface MountOptions {
  projectId: number;
  getAuthToken?: () => string | null;
  onBack?: () => void;
  onEdit?: (projectId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the ProjectDetail component into a container
 */
export function mountProjectDetail(
  container: HTMLElement,
  options: MountOptions
): () => void {
  // Unmount existing root if any
  const existingRoot = mountedRoots.get(container);
  if (existingRoot) {
    existingRoot.unmount();
    mountedRoots.delete(container);
  }

  // Create new root and render
  const root = createRoot(container);
  mountedRoots.set(container, root);

  root.render(
    <React.StrictMode>
      <ProjectDetail
        projectId={options.projectId}
        getAuthToken={options.getAuthToken}
        onBack={options.onBack}
        onEdit={options.onEdit}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return unmount function
  return () => {
    const root = mountedRoots.get(container);
    if (root) {
      root.unmount();
      mountedRoots.delete(container);
    }
  };
}

/**
 * Unmount the ProjectDetail component from a container
 */
export function unmountProjectDetail(container: HTMLElement): void {
  const root = mountedRoots.get(container);
  if (root) {
    root.unmount();
    mountedRoots.delete(container);
  }
}

/**
 * Check if React project detail should be used
 * Always returns true - React is the default implementation
 */
export function shouldUseReactProjectDetail(): boolean {
  return true;
}
