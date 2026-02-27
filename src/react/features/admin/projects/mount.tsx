import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProjectsTable } from './ProjectsTable';

// Store root for cleanup
let projectsTableRoot: Root | null = null;

interface MountOptions {
  /** Auth token getter */
  getAuthToken?: () => string | null;
  /** Callback when project is selected */
  onViewProject?: (projectId: number) => void;
  /** Notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the React ProjectsTable into a DOM element
 * Used for island architecture - embedding React into existing vanilla pages
 *
 * @param container - DOM element or selector to mount into
 * @param options - Mount options including callbacks
 * @returns Cleanup function
 */
export function mountProjectsTable(
  container: HTMLElement | string,
  options: MountOptions = {}
): () => void {
  const element =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!element) {
    console.error('[React/ProjectsTable] Mount container not found:', container);
    return () => {};
  }

  // Clean up existing root
  if (projectsTableRoot) {
    projectsTableRoot.unmount();
    projectsTableRoot = null;
  }

  // Add class for portal styling context
  element.classList.add('react-portal-mount');

  // Create root and render
  projectsTableRoot = createRoot(element);
  projectsTableRoot.render(
    <React.StrictMode>
      <ProjectsTable
        getAuthToken={options.getAuthToken}
        onViewProject={options.onViewProject}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    if (projectsTableRoot) {
      projectsTableRoot.unmount();
      projectsTableRoot = null;
    }
    element.classList.remove('react-portal-mount');
  };
}

/**
 * Unmount the ProjectsTable
 */
export function unmountProjectsTable(): void {
  if (projectsTableRoot) {
    projectsTableRoot.unmount();
    projectsTableRoot = null;
  }
}

/**
 * Check if React projects table should be used
 * Always returns true - React is the default implementation
 */
export function shouldUseReactProjectsTable(): boolean {
  return true;
}
