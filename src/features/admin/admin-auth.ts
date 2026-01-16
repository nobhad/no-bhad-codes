/**
 * ===============================================
 * ADMIN AUTHENTICATION
 * ===============================================
 * @file src/features/admin/admin-auth.ts
 *
 * Admin authentication and session management using JWT backend.
 */

import { AdminSecurity } from './admin-security';
import { apiPost } from '../../utils/api-client';
import { decodeJwtPayload, isTokenExpired, isAdminPayload } from '../../utils/jwt-utils';

/**
 * Admin authentication and session management using JWT backend
 */
export class AdminAuth {
  private static readonly SESSION_KEY = 'nbw_admin_session';
  private static readonly TOKEN_KEY = 'nbw_admin_token';
  private static readonly API_BASE = '/api/auth';

  /**
   * Authenticate with backend JWT API
   * Falls back to client-side hash for offline/development mode
   */
  static async authenticate(inputKey: string): Promise<boolean> {
    try {
      // Check rate limiting first
      AdminSecurity.checkRateLimit();

      // Try backend authentication first
      try {
        const response = await apiPost(`${this.API_BASE}/admin/login`, { password: inputKey });

        if (response.ok) {
          const data = await response.json();

          // Clear failed attempts on successful login
          AdminSecurity.clearAttempts();

          // Store JWT token and session
          sessionStorage.setItem(this.TOKEN_KEY, data.token);
          const session = {
            authenticated: true,
            timestamp: Date.now(),
            expiresIn: data.expiresIn
          };
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

          return true;
        } else if (response.status === 401) {
          // Invalid credentials
          AdminSecurity.recordFailedAttempt();
          return false;
        }
        // For other errors, fall through to fallback
      } catch (fetchError) {
        console.warn('[AdminAuth] Backend auth failed, using fallback:', fetchError);
      }

      // Fallback: Client-side hash authentication for development only
      // SECURITY: No hardcoded fallback - must use environment variable
      const fallbackHash = import.meta.env && import.meta.env.VITE_ADMIN_PASSWORD_HASH;

      if (!fallbackHash) {
        console.error('[AdminAuth] VITE_ADMIN_PASSWORD_HASH not configured - admin access disabled');
        return false;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(inputKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === fallbackHash) {
        AdminSecurity.clearAttempts();
        const session = {
          authenticated: true,
          timestamp: Date.now(),
          fallback: true // Mark as fallback auth
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return true;
      }

      AdminSecurity.recordFailedAttempt();
      return false;
    } catch (error) {
      console.error('[AdminAuth] Authentication error:', error);
      AdminSecurity.recordFailedAttempt();
      throw error;
    }
  }

  /**
   * Check if user is authenticated (valid session or token)
   */
  static isAuthenticated(): boolean {
    try {
      // Check for admin JWT token first
      const token = sessionStorage.getItem(this.TOKEN_KEY);
      if (token) {
        // Validate token hasn't expired
        if (!isTokenExpired(token)) {
          return true;
        }
        // Token expired, clean up
        this.logout();
        return false;
      }

      // Also check for client portal auth token (for admin users logged in via client portal)
      const clientToken = sessionStorage.getItem('client_auth_token');
      if (clientToken) {
        const payload = decodeJwtPayload(clientToken);
        // Check if user is admin and token not expired
        if (payload && isAdminPayload(payload) && !isTokenExpired(clientToken)) {
          return true;
        }
      }

      // Fallback: Check session storage
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const sessionDuration = 60 * 60 * 1000; // 1 hour
      const isValid = session.authenticated && Date.now() - session.timestamp < sessionDuration;

      if (!isValid) {
        this.logout();
      }

      return isValid;
    } catch (error) {
      console.error('[AdminAuth] Session validation error:', error);
      return false;
    }
  }

  /**
   * Get the current JWT token for API calls
   * Checks both admin token and client token (for admin users logged in via client portal)
   */
  static getToken(): string | null {
    // First check for admin-specific token
    const adminToken = sessionStorage.getItem(this.TOKEN_KEY);
    if (adminToken) return adminToken;

    // Also check for client portal token (admin users use this)
    const clientToken = sessionStorage.getItem('client_auth_token');
    if (clientToken) {
      const payload = decodeJwtPayload(clientToken);
      // Only return if this is an admin user
      if (payload && isAdminPayload(payload)) {
        return clientToken;
      }
    }

    return null;
  }

  /**
   * Logout and clear all auth data
   */
  static async logout(): Promise<void> {
    console.log('[AdminAuth] Logout called - clearing ALL session data');

    // Call server logout to clear HttpOnly cookie
    try {
      await apiPost('/api/auth/logout');
    } catch (error) {
      console.warn('[AdminAuth] Server logout failed:', error);
    }

    // Clear all sessionStorage (ensures nothing is missed)
    sessionStorage.clear();
    // Also clear localStorage in case anything is stored there
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('client_auth_token');
    console.log('[AdminAuth] All storage cleared, navigating to login');
    // Navigate to /admin instead of reload to ensure fresh state
    window.location.href = '/admin';
  }

  /**
   * Extend session timestamp for activity
   */
  static extendSession(): void {
    try {
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.timestamp = Date.now();
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }
    } catch (error) {
      console.error('[AdminAuth] Session extension error:', error);
    }
  }
}

