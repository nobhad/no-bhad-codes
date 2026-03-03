/**
 * ===============================================
 * CREATE MOUNT WRAPPER FACTORY
 * ===============================================
 * @file src/react/factories/createMountWrapper.tsx
 *
 * Higher-level factory that generates complete mount/unmount utilities
 * with selector handling, error logging, and feature flags.
 *
 * Eliminates boilerplate across 39+ mount.tsx files.
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('createMountWrapper');

// ============================================
// TYPES
// ============================================

/**
 * Base mount options that all components receive.
 */
export interface BaseMountOptions {
  /** Callback for navigation events */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Function to retrieve auth token */
  getAuthToken?: () => string | null;
  /** Function to show toast notifications */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Configuration for mount wrapper creation.
 */
export interface MountWrapperConfig<P extends BaseMountOptions> {
  /** The React component to mount */
  Component: React.ComponentType<P>;
  /** Display name for logging/debugging */
  displayName: string;
  /** Optional feature flag check */
  shouldUseReact?: () => boolean;
  /** Custom error renderer */
  renderError?: (error: Error, displayName: string) => React.ReactNode;
  /** Callback when mount fails */
  onMountError?: (error: Error, displayName: string) => void;
}

/**
 * Result from createMountWrapper factory.
 */
export interface MountWrapperResult<P extends BaseMountOptions> {
  /** Mount component into a container (accepts element or selector) */
  mount: (container: HTMLElement | string, options?: P) => () => void;
  /** Unmount the component */
  unmount: () => void;
  /** Check if React implementation should be used */
  shouldUseReact: () => boolean;
  /** Display name for debugging */
  displayName: string;
}

// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  displayName: string;
  onError?: (error: Error) => void;
  renderError?: (error: Error, displayName: string) => React.ReactNode;
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
    logger.error(`[React/${this.props.displayName}] Render error:`, error, errorInfo);
    this.props.onError?.(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.renderError) {
        return this.props.renderError(this.state.error, this.props.displayName);
      }
      return <DefaultErrorDisplay displayName={this.props.displayName} />;
    }
    return this.props.children;
  }
}

function DefaultErrorDisplay({ displayName }: { displayName: string }) {
  return (
    <div className="mount-error-container">
      <p className="mount-error-message">Failed to load {displayName}</p>
      <button
        className="mount-error-button"
        onClick={() => window.location.reload()}
      >
        Refresh Page
      </button>
    </div>
  );
}

// ============================================
// FACTORY
// ============================================

/**
 * Creates a complete mount/unmount wrapper with selector handling,
 * error boundaries, and logging.
 *
 * @example
 * ```typescript
 * // mount.tsx - Minimal boilerplate
 * import { createMountWrapper, BaseMountOptions } from '@/react/factories';
 * import { ClientsTable } from './ClientsTable';
 *
 * export interface ClientsMountOptions extends BaseMountOptions {
 *   onViewClient?: (clientId: number) => void;
 * }
 *
 * export const {
 *   mount: mountClientsTable,
 *   unmount: unmountClientsTable,
 *   shouldUseReact: shouldUseReactClientsTable
 * } = createMountWrapper<ClientsMountOptions>({
 *   Component: ClientsTable,
 *   displayName: 'ClientsTable'
 * });
 * ```
 */
export function createMountWrapper<P extends BaseMountOptions>(
  config: MountWrapperConfig<P>
): MountWrapperResult<P> {
  const {
    Component,
    displayName,
    shouldUseReact: customShouldUseReact,
    renderError,
    onMountError
  } = config;

  let root: Root | null = null;
  let mountedContainer: HTMLElement | null = null;

  /**
   * Resolve container from element or selector string.
   */
  function resolveContainer(container: HTMLElement | string): HTMLElement | null {
    if (typeof container === 'string') {
      return document.querySelector<HTMLElement>(container);
    }
    return container;
  }

  /**
   * Mount the React component.
   */
  function mount(container: HTMLElement | string, options: P = {} as P): () => void {
    const element = resolveContainer(container);

    if (!element) {
      logger.error(`[React/${displayName}] Container not found:`, container);
      return () => {};
    }

    // Clean up any existing mount
    if (root) {
      root.unmount();
      root = null;
    }

    mountedContainer = element;
    element.innerHTML = '';
    element.classList.add('react-portal-mount');

    try {
      root = createRoot(element);
      root.render(
        <React.StrictMode>
          <MountErrorBoundary
            displayName={displayName}
            onError={onMountError ? (err) => onMountError(err, displayName) : undefined}
            renderError={renderError}
          >
            <Component {...options} />
          </MountErrorBoundary>
        </React.StrictMode>
      );
      logger.info(`[React/${displayName}] Mounted successfully`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`[React/${displayName}] Mount failed:`, error);
      onMountError?.(error, displayName);

      // Show error state (avoid inline onclick for CSP compliance)
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
   * Unmount the component.
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

  /**
   * Check if React implementation should be used.
   */
  function shouldUseReact(): boolean {
    if (customShouldUseReact) {
      return customShouldUseReact();
    }
    return true;
  }

  // Set display names for debugging
  mount.displayName = `mount${displayName}`;
  unmount.displayName = `unmount${displayName}`;

  return {
    mount,
    unmount,
    shouldUseReact,
    displayName
  };
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

/**
 * Quick mount wrapper for simple components.
 * Use when you don't need custom options beyond BaseMountOptions.
 */
export function createSimpleMount<P extends BaseMountOptions>(
  Component: React.ComponentType<P>,
  displayName: string
): MountWrapperResult<P> {
  return createMountWrapper<P>({ Component, displayName });
}
