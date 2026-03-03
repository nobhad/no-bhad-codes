/**
 * ===============================================
 * USE LOGGER HOOK
 * ===============================================
 * @file src/react/hooks/useLogger.ts
 *
 * React hook wrapper for the centralized logger.
 * Provides memoized logger instances for components/hooks.
 */

import { useMemo } from 'react';
import { createLogger, type Logger } from '../../utils/logger';

/**
 * Get a memoized logger instance for a React component or hook
 *
 * @param prefix - Component or hook name for log identification
 * @returns Logger instance with debug, info, warn, error, errorWithContext methods
 *
 * @example
 * function MyComponent() {
 *   const logger = useLogger('MyComponent');
 *
 *   const handleError = (err: unknown) => {
 *     logger.errorWithContext('Failed to load data', { error: err });
 *   };
 * }
 */
export function useLogger(prefix: string): Logger {
  return useMemo(() => createLogger(prefix), [prefix]);
}

/**
 * Create a logger for use outside of React components (e.g., in utility functions)
 * This is just a re-export of createLogger for convenience
 */
export { createLogger } from '../../utils/logger';

export default useLogger;
