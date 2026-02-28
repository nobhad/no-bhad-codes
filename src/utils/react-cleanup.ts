/**
 * ===============================================
 * REACT CLEANUP UTILITY
 * ===============================================
 * @file src/utils/react-cleanup.ts
 *
 * Factory for creating React cleanup handlers.
 * Eliminates boilerplate in client portal modules that mount React components.
 *
 * @example
 * ```typescript
 * import { createReactCleanupHandler } from '../../utils/react-cleanup';
 *
 * const reactSettingsCleanup = createReactCleanupHandler();
 *
 * // When mounting React component:
 * const unmountFn = component.mount(container, props);
 * reactSettingsCleanup.setUnmount(unmountFn);
 *
 * // When cleaning up:
 * export function cleanupPortalSettings(): void {
 *   reactSettingsCleanup.cleanup();
 * }
 * ```
 */

/**
 * Interface for React cleanup handler
 */
export interface ReactCleanupHandler {
  /**
   * Set the unmount function returned by React component mount
   * @param fn - The unmount function, or null to clear
   */
  setUnmount: (fn: (() => void) | null) => void;

  /**
   * Execute cleanup - calls unmount function if one exists and clears it
   */
  cleanup: () => void;

  /**
   * Check if a React component is currently mounted
   * @returns true if an unmount function is registered
   */
  isActive: () => boolean;
}

/**
 * Factory function to create a React cleanup handler
 *
 * Creates an encapsulated cleanup handler that manages the lifecycle
 * of a mounted React component. Each module should create its own
 * handler instance.
 *
 * @returns A ReactCleanupHandler instance
 */
export function createReactCleanupHandler(): ReactCleanupHandler {
  let unmountFn: (() => void) | null = null;

  return {
    setUnmount: (fn: (() => void) | null): void => {
      unmountFn = fn;
    },

    cleanup: (): void => {
      if (unmountFn) {
        unmountFn();
        unmountFn = null;
      }
    },

    isActive: (): boolean => unmountFn !== null
  };
}
