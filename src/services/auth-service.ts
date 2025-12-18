/**
 * ===============================================
 * AUTHENTICATION SERVICE
 * ===============================================
 * Handles client authentication using HttpOnly cookies.
 * Tokens are stored in secure HttpOnly cookies (set by server),
 * not in JavaScript-accessible storage.
 */

import { BaseService } from './base-service';
import { authEndpoints } from '../config/api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthUser {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  status: string;
}

interface LoginResponse {
  message: string;
  user: AuthUser;
  expiresIn: string;
}

interface ApiError {
  error: string;
  code: string;
  timestamp: string;
}

export class AuthService extends BaseService {
  private user: AuthUser | null = null;
  private refreshTimer: number | null = null;
  private isAuth: boolean = false;

  constructor() {
    super('auth-service');
    this.loadStoredUser();
  }

  /**
   * Load user data from sessionStorage (not token - that's in HttpOnly cookie)
   */
  private loadStoredUser(): void {
    try {
      const storedUser = sessionStorage.getItem('auth_user');

      if (storedUser) {
        this.user = JSON.parse(storedUser);
        this.isAuth = true;
        this.scheduleTokenRefresh();
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
      this.clearAuthData();
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(authEndpoints.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        return {
          success: false,
          error: error.error || 'Login failed'
        };
      }

      const loginData = data as LoginResponse;

      // Store user data (token is now in HttpOnly cookie set by server)
      this.user = loginData.user;
      this.isAuth = true;

      sessionStorage.setItem('auth_user', JSON.stringify(loginData.user));

      // Schedule token refresh
      this.scheduleTokenRefresh();

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Logout user and clear authentication data
   */
  async logout(): Promise<void> {
    try {
      if (this.isAuth) {
        // Notify server of logout (server clears HttpOnly cookie)
        await fetch(authEndpoints.logout, {
          method: 'POST',
          credentials: 'include' // Include HttpOnly cookies
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuthData();
    }
  }

  /**
   * Clear authentication data
   */
  private clearAuthData(): void {
    this.user = null;
    this.isAuth = false;

    sessionStorage.removeItem('auth_user');

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuth && this.user !== null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.user;
  }

  /**
   * Refresh authentication token
   * Note: Token is in HttpOnly cookie, server handles refresh
   */
  async refreshToken(): Promise<boolean> {
    if (!this.isAuth) {
      return false;
    }

    try {
      const response = await fetch(authEndpoints.refresh, {
        method: 'POST',
        credentials: 'include' // Include HttpOnly cookies
      });

      if (!response.ok) {
        this.clearAuthData();
        return false;
      }

      // Server sets new HttpOnly cookie, we just schedule next refresh
      this.scheduleTokenRefresh();
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh token 1 hour before expiry (assuming 7 day tokens)
    const refreshInterval = 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds

    this.refreshTimer = window.setTimeout(() => {
      this.refreshToken();
    }, refreshInterval);
  }

  /**
   * Validate current token with server
   */
  async validateToken(): Promise<boolean> {
    if (!this.isAuth) {
      return false;
    }

    try {
      const response = await fetch(authEndpoints.validate, {
        method: 'GET',
        credentials: 'include' // Include HttpOnly cookies
      });

      if (!response.ok) {
        this.clearAuthData();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Get user profile data
   */
  async getProfile(): Promise<AuthUser | null> {
    if (!this.isAuth) {
      return null;
    }

    try {
      const response = await fetch(authEndpoints.profile, {
        method: 'GET',
        credentials: 'include' // Include HttpOnly cookies
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.user = data.user;
      sessionStorage.setItem('auth_user', JSON.stringify(data.user));

      return data.user;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  }

  /**
   * Initialize authentication state on app start
   */
  async initialize(): Promise<void> {
    if (this.isAuth) {
      const isValid = await this.validateToken();
      if (!isValid) {
        this.clearAuthData();
      }
    }
  }

  /**
   * Request magic link for passwordless login
   * @param email - User's email address
   */
  async requestMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(authEndpoints.magicLink, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to send magic link'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Magic link request error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Verify magic link token and authenticate user
   * @param token - Magic link token from URL
   */
  async verifyMagicLink(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(authEndpoints.verifyMagicLink, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Invalid or expired login link'
        };
      }

      // Store user data (token is now in HttpOnly cookie set by server)
      this.user = data.user;
      this.isAuth = true;

      sessionStorage.setItem('auth_user', JSON.stringify(data.user));

      // Schedule token refresh
      this.scheduleTokenRefresh();

      return { success: true };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }
}
