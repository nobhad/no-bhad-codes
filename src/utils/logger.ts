/**
 * ===============================================
 * DEBUG LOGGER UTILITY
 * ===============================================
 * @file src/utils/logger.ts
 *
 * Centralized logging utility that respects debug mode.
 * All debug logs are automatically disabled in production.
 */

import { isDev, getDebugMode } from '../core/env';

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string) {
  const debug = getDebugMode();

  return {
    /**
     * Log debug message (only in development)
     */
    log(...args: unknown[]): void {
      if (debug) {
        console.log(`[${prefix}]`, ...args);
      }
    },

    /**
     * Log warning (always shown)
     */
    warn(...args: unknown[]): void {
      console.warn(`[${prefix}]`, ...args);
    },

    /**
     * Log error (always shown)
     */
    error(...args: unknown[]): void {
      console.error(`[${prefix}]`, ...args);
    },

    /**
     * Log info (only in development)
     */
    info(...args: unknown[]): void {
      if (debug) {
        // eslint-disable-next-line no-console
        console.info(`[${prefix}]`, ...args);
      }
    },

    /**
     * Log debug (only in development)
     */
    debug(...args: unknown[]): void {
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug(`[${prefix}]`, ...args);
      }
    }
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger('App');

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = (): boolean => isDev();
