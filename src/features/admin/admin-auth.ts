/**
 * ===============================================
 * ADMIN AUTHENTICATION
 * ===============================================
 * @file src/features/admin/admin-auth.ts
 *
 * Admin authentication wrapper.
 * Delegates to centralized authStore for state management.
 *
 * SECURITY NOTES:
 * - Authentication is handled SERVER-SIDE via authStore.adminLogin()
 * - JWT tokens are stored in HttpOnly cookies (not accessible via JS)
 * - Client-side rate limiting is for UX only (not actual security)
 * - No fallback authentication in production - server auth is required
 *
 * @deprecated Consider using authStore directly for new code.
 * This class is maintained for backward compatibility.
 */

import { AdminSecurity } from './admin-security';
import { authStore } from '../../auth';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminAuth');

// Legacy storage keys for fallback mode (development only)
const LEGACY_SESSION_KEY = 'nbw_admin_session';

// Check if we're in development mode
const isDevelopment = import.meta.env?.MODE === 'development' || import.meta.env?.DEV;

/**
 * Admin authentication wrapper
 * Delegates to authStore with additional security features
 */
export class AdminAuth {
  // Flag set by AdminDashboard when API authentication is confirmed
  private static _apiAuthenticated = false;

  /**
   * Mark the user as authenticated via API (called by AdminDashboard)
   */
  static setApiAuthenticated(value: boolean): void {
    AdminAuth._apiAuthenticated = value;
    logger.log('API authentication status set to:', value);
  }

  /**
   * Check if authenticated via API
   */
  static isApiAuthenticated(): boolean {
    return AdminAuth._apiAuthenticated;
  }

  /**
   * Authenticate with backend JWT API
   *
   * SECURITY: Authentication is server-side only.
   * - In production: Only server authentication is allowed
   * - In development: Falls back to client-side hash if server is unavailable
   *
   * The fallback exists ONLY for local development when the backend may not be running.
   * In production, if the server is unavailable, authentication fails.
   */
  static async authenticate(inputKey: string): Promise<boolean> {
    try {
      // Check rate limiting first (UX enhancement, not security - easily bypassed)
      AdminSecurity.checkRateLimit();

      // Try backend authentication via authStore (REQUIRED for production)
      try {
        const result = await authStore.adminLogin({ password: inputKey });

        if (result.success) {
          // Clear failed attempts on successful login
          AdminSecurity.clearAttempts();
          return true;
        }

        // Invalid credentials from server
        AdminSecurity.recordFailedAttempt();
        return false;
      } catch (_fetchError) {
        // In production, server auth is required - no fallback
        if (!isDevelopment) {
          logger.error('Server authentication failed. Backend server may be unavailable.');
          AdminSecurity.recordFailedAttempt();
          return false;
        }

        // Development only: warn and try fallback
        logger.warn('Backend auth unavailable in development, trying fallback');
      }

      // DEVELOPMENT ONLY: Client-side hash authentication fallback
      // This allows local development without a running backend
      // SECURITY: This code path is DISABLED in production (checked above)
      if (!isDevelopment) {
        logger.error('Fallback authentication is disabled in production');
        return false;
      }

      const fallbackHash = import.meta.env?.VITE_ADMIN_PASSWORD_HASH;

      if (!fallbackHash) {
        logger.error('Development fallback: VITE_ADMIN_PASSWORD_HASH not configured');
        return false;
      }

      logger.warn('Using development-only fallback authentication');

      const encoder = new TextEncoder();
      const data = encoder.encode(inputKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === fallbackHash) {
        AdminSecurity.clearAttempts();
        // Store fallback session for legacy compatibility (development only)
        const session = {
          authenticated: true,
          timestamp: Date.now(),
          fallback: true,
          isDev: true
        };
        sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(session));
        return true;
      }

      AdminSecurity.recordFailedAttempt();
      return false;
    } catch (error) {
      logger.error('Authentication error:', error);
      AdminSecurity.recordFailedAttempt();
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * Delegates to authStore.isAdmin()
   */
  static isAuthenticated(): boolean {
    // First check API authentication flag (set by AdminDashboard after API check)
    if (AdminAuth._apiAuthenticated) {
      return true;
    }

    // Check authStore (primary)
    if (authStore.isAdmin()) {
      return true;
    }

    // Check if authenticated via client portal as admin
    if (authStore.isAuthenticated()) {
      const user = authStore.getCurrentUser();
      if (user?.role === 'admin') {
        return true;
      }
    }

    // Fallback: Check legacy session storage (for development fallback hash auth only)
    // In production, this should never be the authentication path
    if (!isDevelopment) {
      return false;
    }

    try {
      const sessionData = sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);

      // Only accept sessions explicitly marked as development
      if (!session.isDev && !session.fallback) {
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
        return false;
      }

      const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
      const isValid = session.authenticated && Date.now() - session.timestamp < SESSION_DURATION_MS;

      if (!isValid) {
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
      }

      return isValid;
    } catch (error) {
      logger.warn('Legacy session validation failed:', error);
      return false;
    }
  }

  /**
   * Get the current JWT token for API calls
   * @deprecated With HttpOnly cookies, tokens are managed by the browser.
   * This method is kept for backward compatibility but returns null
   * as tokens are no longer stored client-side.
   */
  static getToken(): string | null {
    // With HttpOnly cookies, tokens are sent automatically by the browser.
    // This method is deprecated - API calls should use credentials: 'include'
    logger.warn('getToken() is deprecated - use credentials: "include" for API calls');
    return null;
  }

  /**
   * Logout and clear all auth data
   * Delegates to authStore.logout()
   */
  static async logout(): Promise<void> {
    logger.info('Logout called - delegating to authStore');

    // Clear API authentication flag
    AdminAuth._apiAuthenticated = false;

    // Clear legacy session
    sessionStorage.removeItem(LEGACY_SESSION_KEY);

    try {
      // Delegate to authStore
      await authStore.logout();
      logger.info('Logout complete, navigating to login');
    } catch (error) {
      logger.error('authStore.logout() failed:', error);
    } finally {
      // Always navigate to /admin to ensure fresh state, even if logout API fails
      window.location.href = '/admin';
    }
  }

  /**
   * Extend session timestamp for activity
   * Delegates to authStore.extendSession()
   */
  static extendSession(): void {
    // Extend via authStore
    authStore.extendSession();

    // Also extend legacy session if present
    try {
      const sessionData = sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.timestamp = Date.now();
        sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(session));
      }
    } catch (_error) {
      // Ignore legacy session errors
    }
  }
}

