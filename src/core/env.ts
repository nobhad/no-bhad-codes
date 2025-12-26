/**
 * ===============================================
 * ENVIRONMENT UTILITIES
 * ===============================================
 * @file src/core/env.ts
 *
 * Centralized environment detection for the application.
 */

/**
 * Check if running in development environment
 */
export function isDev(): boolean {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  );
}

/**
 * Check if running in production environment
 */
export function isProd(): boolean {
  return !isDev();
}

/**
 * Get debug mode based on environment
 * Returns true only in development
 */
export function getDebugMode(): boolean {
  return isDev();
}
