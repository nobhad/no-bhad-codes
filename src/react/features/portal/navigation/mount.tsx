/**
 * Portal Navigation Mount
 * Island architecture mount/unmount functions for PortalSidebar
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalSidebar, type PortalNavigationProps } from './PortalSidebar';

// Store roots for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalNavigationMountOptions extends PortalNavigationProps {
  /** Optional callback when mount completes */
  onMounted?: () => void;
}

/**
 * Mount the PortalSidebar component into a container element
 * @param container - The HTML element to mount into
 * @param options - Navigation options and callbacks
 * @returns Cleanup function to unmount
 */
export function mountPortalNavigation(
  container: HTMLElement,
  options: PortalNavigationMountOptions
): () => void {
  // Clean up existing root if present
  const existingRoot = roots.get(container);
  if (existingRoot) {
    existingRoot.unmount();
    roots.delete(container);
  }

  // Clear container
  container.innerHTML = '';

  const root = createRoot(container);
  roots.set(container, root);

  const { onMounted, ...props } = options;

  root.render(
    <React.StrictMode>
      <PortalSidebar {...props} />
    </React.StrictMode>
  );

  // Call onMounted callback if provided
  if (onMounted) {
    // Use requestAnimationFrame to ensure render is complete
    requestAnimationFrame(() => {
      onMounted();
    });
  }

  // Return cleanup function
  return () => {
    unmountPortalNavigation(container);
  };
}

/**
 * Unmount the PortalSidebar component from a container element
 * @param container - The HTML element to unmount from
 */
export function unmountPortalNavigation(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
  container.innerHTML = '';
}

/**
 * Update props on an already-mounted PortalSidebar
 * @param container - The HTML element containing the mounted component
 * @param options - New navigation options
 */
export function updatePortalNavigation(
  container: HTMLElement,
  options: PortalNavigationMountOptions
): void {
  const root = roots.get(container);
  if (root) {
    const { onMounted, ...props } = options;
    root.render(
      <React.StrictMode>
        <PortalSidebar {...props} />
      </React.StrictMode>
    );
  }
}

/**
 * Check if portal navigation is mounted in a container
 * @param container - The HTML element to check
 * @returns Whether the component is mounted
 */
export function isPortalNavigationMounted(container: HTMLElement): boolean {
  return roots.has(container);
}

/**
 * Check if React portal navigation should be used
 * @returns Whether to use React implementation
 */
export function shouldUseReactPortalNavigation(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_portal_navigation') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_portal_navigation');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
