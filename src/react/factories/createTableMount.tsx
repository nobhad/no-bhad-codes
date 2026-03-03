import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Base options for table mount functions.
 * Components can extend this interface for additional props.
 */
export interface TableMountOptions {
  /** Callback for navigation events (e.g., switching tabs, viewing entities) */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Function to retrieve auth token for API requests */
  getAuthToken?: () => string | null;
  /** Function to show toast notifications */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Error Boundary component to catch React rendering errors
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  displayName: string;
  onError?: (error: Error) => void;
}

class MountErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[React/${this.props.displayName}] Render error:`, error, errorInfo);
    this.props.onError?.(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mount-error-container">
          <p className="mount-error-message">Failed to load component</p>
          <button
            className="mount-error-button"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Return type from createTableMount factory.
 * Provides mount and unmount functions for the component.
 */
export interface TableMountResult<P extends TableMountOptions> {
  /** Mount the component into a DOM element */
  mount: (element: HTMLElement, options?: P) => () => void;
  /** Unmount the component and clean up */
  unmount: () => void;
}

/**
 * Factory function to create standardized mount/unmount utilities for React table components.
 * Eliminates duplication across 12+ admin table mount.tsx files.
 *
 * @param Component - The React component to mount
 * @param displayName - Name used for debugging/logging (e.g., 'ProposalsTable')
 * @returns Object with mount and unmount functions
 *
 * @example
 * ```typescript
 * // In mount.tsx
 * import { createTableMount, TableMountOptions } from '@/react/factories/createTableMount';
 * import { ProposalsTable } from './ProposalsTable';
 *
 * export interface ProposalsMountOptions extends TableMountOptions {}
 *
 * const { mount, unmount } = createTableMount<ProposalsMountOptions>(
 *   ProposalsTable,
 *   'ProposalsTable'
 * );
 *
 * export const mountProposalsTable = mount;
 * export const unmountProposalsTable = unmount;
 * ```
 */
export function createTableMount<P extends TableMountOptions>(
  Component: React.ComponentType<P>,
  displayName: string
): TableMountResult<P> {
  let root: Root | null = null;
  let mountedContainer: HTMLElement | null = null;

  /**
   * Mount the React component into a DOM element.
   *
   * @param element - The DOM element to mount into
   * @param options - Props to pass to the component
   * @returns Cleanup function to unmount the component
   */
  function mount(element: HTMLElement, options: P = {} as P): () => void {
    // Clean up any existing mount
    if (root) {
      root.unmount();
      root = null;
    }

    mountedContainer = element;
    element.innerHTML = '';

    // Add portal styling class for React mount point
    element.classList.add('react-portal-mount');

    try {
      root = createRoot(element);
      root.render(
        <React.StrictMode>
          <MountErrorBoundary displayName={displayName}>
            <Component {...options} />
          </MountErrorBoundary>
        </React.StrictMode>
      );
      console.log(`[React/${displayName}] Mounted successfully`);
    } catch (err) {
      console.error(`[React/${displayName}] Mount failed:`, err);
      // Show error state in container (avoid inline onclick for CSP compliance)
      element.innerHTML = `
        <div class="mount-error-container">
          <p class="mount-error-message">Failed to load ${displayName}</p>
          <button class="mount-error-button" data-action="reload">
            Refresh Page
          </button>
        </div>
      `;
      // Add event listener for reload button
      const reloadBtn = element.querySelector('[data-action="reload"]');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => window.location.reload());
      }
      root = null;
    }

    // Return cleanup function
    return () => {
      if (root) {
        root.unmount();
        root = null;
      }
      if (mountedContainer) {
        mountedContainer.classList.remove('react-portal-mount');
        mountedContainer.innerHTML = '';
        mountedContainer = null;
      }
    };
  }

  /**
   * Unmount the component and clean up.
   * Safe to call even if component is not mounted.
   */
  function unmount(): void {
    if (root) {
      root.unmount();
      root = null;
    }
    if (mountedContainer) {
      mountedContainer.classList.remove('react-portal-mount');
      mountedContainer.innerHTML = '';
      mountedContainer = null;
    }
  }

  // Set display names for debugging
  mount.displayName = `mount${displayName}`;
  unmount.displayName = `unmount${displayName}`;

  return { mount, unmount };
}
