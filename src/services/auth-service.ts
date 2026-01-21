/**
 * ===============================================
 * AUTHENTICATION SERVICE
 * ===============================================
 * Handles client authentication using HttpOnly cookies.
 * Delegates to centralized authStore for state management.
 *
 * @deprecated Consider using authStore directly for new code.
 * This service is maintained for backward compatibility.
 */

import { BaseService } from './base-service';
import { authStore } from '../auth';
import type { AnyUser, AuthResult, LoginResult } from '../auth/auth-types';

interface LoginCredentials {
  email: string;
  password: string;
}

// Re-export AuthUser type for backward compatibility
export type AuthUser = AnyUser;

export class AuthService extends BaseService {
  constructor() {
    super('auth-service');
  }

  /**
   * Login user with email and password
   * Delegates to authStore.login()
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    const result: LoginResult = await authStore.login(credentials);
    return {
      success: result.success,
      error: result.error
    };
  }

  /**
   * Logout user and clear authentication data
   * Delegates to authStore.logout()
   */
  async logout(): Promise<void> {
    await authStore.logout();
  }

  /**
   * Check if user is authenticated
   * Delegates to authStore.isAuthenticated()
   */
  isAuthenticated(): boolean {
    return authStore.isAuthenticated();
  }

  /**
   * Get current user
   * Delegates to authStore.getCurrentUser()
   */
  getCurrentUser(): AuthUser | null {
    return authStore.getCurrentUser();
  }

  /**
   * Refresh authentication token
   * Delegates to authStore.refreshSession()
   */
  async refreshToken(): Promise<boolean> {
    return authStore.refreshSession();
  }

  /**
   * Validate current token with server
   * Delegates to authStore.validateSession()
   */
  async validateToken(): Promise<boolean> {
    return authStore.validateSession();
  }

  /**
   * Get user profile data
   * Note: This fetches fresh data from server
   */
  async getProfile(): Promise<AuthUser | null> {
    if (!authStore.isAuthenticated()) {
      return null;
    }

    // Profile is available from current user data
    return authStore.getCurrentUser();
  }

  /**
   * Initialize authentication state on app start
   * AuthStore auto-initializes, but this validates with server
   */
  async initialize(): Promise<void> {
    if (authStore.isAuthenticated()) {
      const isValid = await authStore.validateSession();
      if (!isValid) {
        await authStore.logout();
      }
    }
  }

  /**
   * Request magic link for passwordless login
   * Delegates to authStore.requestMagicLink()
   */
  async requestMagicLink(email: string): Promise<AuthResult> {
    return authStore.requestMagicLink(email);
  }

  /**
   * Verify magic link token and authenticate user
   * Delegates to authStore.verifyMagicLink()
   */
  async verifyMagicLink(token: string): Promise<{ success: boolean; error?: string }> {
    const result: LoginResult = await authStore.verifyMagicLink(token);
    return {
      success: result.success,
      error: result.error
    };
  }

  /**
   * Subscribe to auth state changes
   * New method for reactive updates
   */
  subscribe(listener: (state: { isAuthenticated: boolean; user: AuthUser | null }) => void): () => void {
    return authStore.subscribe((state) => {
      listener({
        isAuthenticated: state.isAuthenticated,
        user: state.user
      });
    });
  }

  /**
   * Get session time remaining in milliseconds
   */
  getSessionTimeRemaining(): number {
    return authStore.getSessionTimeRemaining();
  }

  /**
   * Extend current session
   */
  extendSession(): void {
    authStore.extendSession();
  }
}
