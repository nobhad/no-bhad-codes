/**
 * ===============================================
 * REACT TABLE INTEGRATION FACTORY
 * ===============================================
 * @file src/features/admin/shared/reactTableIntegration.ts
 *
 * Factory for creating React table integration boilerplate.
 * Eliminates ~50 lines of duplicated code per admin module.
 *
 * Usage:
 * ```typescript
 * const reactIntegration = createReactTableIntegration({
 *   modulePath: () => import('../../../react/features/admin/contacts'),
 *   mountFnName: 'mountContactsTable',
 *   unmountFnName: 'unmountContactsTable',
 *   displayName: 'Contacts'
 * });
 *
 * // In load function:
 * if (reactIntegration.shouldUseReact()) {
 *   const success = await reactIntegration.mount(container, options);
 *   if (success) return;
 * }
 *
 * // In cleanup function:
 * reactIntegration.cleanup();
 * ```
 */

import { createLogger } from '../../../utils/logger';

/**
 * Configuration for React table integration
 */
export interface ReactTableConfig<TModule extends Record<string, unknown>> {
  /**
   * Dynamic import function for the React module
   * Example: () => import('../../../react/features/admin/contacts')
   */
  modulePath: () => Promise<TModule>;

  /**
   * Name of the mount function exported from the module
   * Example: 'mountContactsTable'
   */
  mountFnName: keyof TModule;

  /**
   * Name of the unmount function exported from the module
   * Example: 'unmountContactsTable'
   */
  unmountFnName: keyof TModule;

  /**
   * Display name for logging purposes
   * Example: 'Contacts'
   */
  displayName: string;
}

/**
 * Generic mount function type
 * First parameter is always HTMLElement, second is optional options object
 */
type MountFunction = (container: HTMLElement, options?: Record<string, unknown>) => void;

/**
 * Generic unmount function type
 */
type UnmountFunction = () => void;

/**
 * Interface returned by the factory
 */
export interface ReactTableIntegration {
  /**
   * Check if React table is actually mounted (container exists and has content)
   */
  isActuallyMounted: () => boolean;

  /**
   * Load the React module (lazy load mount/unmount functions)
   * Returns true if successful, false on error
   */
  load: () => Promise<boolean>;

  /**
   * Check if React implementation should be used
   * Currently always returns true - can be modified for feature flags
   */
  shouldUseReact: () => boolean;

  /**
   * Mount the React table to a container
   * Handles unmounting previous instance if needed
   * Returns true if mounted successfully
   */
  mount: (container: HTMLElement, options?: Record<string, unknown>) => Promise<boolean>;

  /**
   * Unmount the React table if mounted
   */
  cleanup: () => void;

  /**
   * Get the current mount state
   */
  isMounted: () => boolean;
}

/**
 * Create a React table integration with all boilerplate handled
 *
 * @param config - Configuration for the React module
 * @returns Object with methods to manage React table lifecycle
 *
 * @example
 * ```typescript
 * // Define integration at module level
 * const reactIntegration = createReactTableIntegration({
 *   modulePath: () => import('../../../react/features/admin/contacts'),
 *   mountFnName: 'mountContactsTable',
 *   unmountFnName: 'unmountContactsTable',
 *   displayName: 'Contacts'
 * });
 *
 * // Use in load function
 * export async function loadContacts(ctx: AdminDashboardContext): Promise<void> {
 *   if (reactIntegration.shouldUseReact()) {
 *     if (reactIntegration.isActuallyMounted()) {
 *       return; // Already mounted
 *     }
 *
 *     const container = document.getElementById('react-contacts-mount');
 *     if (container) {
 *       const success = await reactIntegration.mount(container, {
 *         onNavigate: ctx.switchTab,
 *         showNotification: ctx.showNotification
 *       });
 *       if (success) return;
 *     }
 *   }
 *
 *   // Fall through to vanilla implementation
 *   await contactsModule.load(ctx);
 * }
 *
 * // Use in cleanup function
 * export function cleanupContactsTab(): void {
 *   reactIntegration.cleanup();
 * }
 * ```
 */
export function createReactTableIntegration<TModule extends Record<string, unknown>>(
  config: ReactTableConfig<TModule>
): ReactTableIntegration {
  const { modulePath, mountFnName, unmountFnName, displayName } = config;
  const logger = createLogger(`Admin${displayName}React`);

  // Internal state
  let mountFn: MountFunction | null = null;
  let unmountFn: UnmountFunction | null = null;
  let reactTableMounted = false;
  let reactMountContainer: HTMLElement | null = null;

  /**
   * Check if React table is actually mounted (container exists and has content)
   */
  function isActuallyMounted(): boolean {
    if (!reactTableMounted) return false;

    // Check if the container still exists in the DOM and has content
    if (
      !reactMountContainer ||
      !reactMountContainer.isConnected ||
      reactMountContainer.children.length === 0
    ) {
      reactTableMounted = false;
      reactMountContainer = null;
      return false;
    }

    return true;
  }

  /**
   * Lazy load React mount functions
   */
  async function load(): Promise<boolean> {
    if (mountFn && unmountFn) return true;

    try {
      const module = await modulePath();
      const mountFunction = module[mountFnName];
      const unmountFunction = module[unmountFnName];

      if (typeof mountFunction !== 'function' || typeof unmountFunction !== 'function') {
        logger.error('Mount/unmount functions not found in module', {
          moduleName: displayName,
          mountFnName: String(mountFnName),
          unmountFnName: String(unmountFnName),
          mountFnType: typeof mountFunction,
          unmountFnType: typeof unmountFunction,
          moduleKeys: Object.keys(module)
        });
        return false;
      }

      mountFn = mountFunction as MountFunction;
      unmountFn = unmountFunction as UnmountFunction;
      logger.log(`React module loaded successfully: ${displayName}`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('Failed to load React module:', {
        moduleName: displayName,
        message: errorMessage,
        stack: errorStack,
        error: err
      });
      return false;
    }
  }

  /**
   * Check if React implementation should be used
   * Can be extended to check feature flags
   */
  function shouldUseReact(): boolean {
    return true;
  }

  /**
   * Mount the React table to a container
   */
  async function mount(
    container: HTMLElement,
    options?: Record<string, unknown>
  ): Promise<boolean> {
    const loaded = await load();
    if (!loaded || !mountFn) {
      logger.error('React module failed to load, falling back to vanilla');
      return false;
    }

    // Unmount first if previously mounted to a different container
    if (reactTableMounted && unmountFn) {
      unmountFn();
    }

    try {
      logger.log(`Mounting React ${displayName} to container`, {
        containerId: container.id,
        containerTagName: container.tagName,
        hasOptions: !!options
      });
      mountFn(container, options);
      reactTableMounted = true;
      reactMountContainer = container;
      logger.log(`React ${displayName} mounted successfully`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error('Failed to mount React table:', {
        moduleName: displayName,
        containerId: container.id,
        message: errorMessage,
        stack: errorStack,
        error: err
      });
      reactTableMounted = false;
      reactMountContainer = null;
      return false;
    }
  }

  /**
   * Cleanup: unmount the React table if mounted
   */
  function cleanup(): void {
    if (reactTableMounted && unmountFn) {
      unmountFn();
      reactTableMounted = false;
      reactMountContainer = null;
    }
  }

  /**
   * Get the current mount state
   */
  function isMounted(): boolean {
    return reactTableMounted;
  }

  return {
    isActuallyMounted,
    load,
    shouldUseReact,
    mount,
    cleanup,
    isMounted
  };
}
