/**
 * Portal Navigation Mount
 * Island architecture mount using createMountWrapper factory
 *
 * Note: This file includes additional helpers (update, isMounted) for
 * dynamic navigation updates without full remount.
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalSidebar, type PortalNavigationProps } from './PortalSidebar';
import { ErrorBoundary } from '../../../components/portal/ErrorBoundary';
import { createMountWrapper } from '@/react/factories';

// Note: PortalNavigationProps.onNavigate takes (tab: string) while
// BaseMountOptions.onNavigate takes (tab: string, entityId?: string).
// We use PortalNavigationProps directly to avoid type conflicts.
export interface PortalNavigationMountOptions extends PortalNavigationProps {
  /** Function to retrieve auth token */
  getAuthToken?: () => string | null;
  /** Function to show toast notifications */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Optional callback when mount completes */
  onMounted?: () => void;
}

// Wrapped component with ErrorBoundary
function PortalSidebarWithErrorBoundary(props: PortalNavigationProps) {
  return (
    <ErrorBoundary componentName="Navigation">
      <PortalSidebar {...props} />
    </ErrorBoundary>
  );
}

// Use factory for standard mount/unmount
export const {
  mount: mountPortalNavigation,
  unmount: unmountPortalNavigation,
  shouldUseReact: shouldUseReactPortalNavigation
} = createMountWrapper<PortalNavigationMountOptions>({
  Component: PortalSidebarWithErrorBoundary as React.ComponentType<PortalNavigationMountOptions>,
  displayName: 'PortalNavigation'
});

// Store roots for update functionality
const updateRoots = new Map<HTMLElement, Root>();

/**
 * Update props on an already-mounted PortalSidebar
 * @param container - The HTML element containing the mounted component
 * @param options - New navigation options
 */
export function updatePortalNavigation(
  container: HTMLElement,
  options: PortalNavigationMountOptions
): void {
  let root = updateRoots.get(container);

  if (!root) {
    // Create a new root if one doesn't exist
    root = createRoot(container);
    updateRoots.set(container, root);
  }

  root.render(
    <React.StrictMode>
      <PortalSidebarWithErrorBoundary {...options} />
    </React.StrictMode>
  );
}

/**
 * Check if portal navigation is mounted in a container
 * @param container - The HTML element to check
 * @returns Whether the component is mounted
 */
export function isPortalNavigationMounted(container: HTMLElement): boolean {
  return updateRoots.has(container) || container.classList.contains('react-portal-mount');
}
