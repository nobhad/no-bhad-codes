/**
 * ===============================================
 * PORTAL AUTH MODULE
 * ===============================================
 * @file src/features/client/modules/portal-auth.ts
 *
 * Authentication functionality for client portal.
 * Handles login, logout, session validation, and admin features.
 */

import { decodeJwtPayload, isAdminPayload } from '../../../utils/jwt-utils';

/** API base URL for authentication */
const AUTH_API_BASE = '/api/auth';

/** Login credentials */
interface LoginCredentials {
  email: string;
  password: string;
}

/** User data from login response */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  contactName?: string;
  companyName?: string;
  isAdmin?: boolean;
  type?: string;
}

/** Login callbacks */
export interface LoginCallbacks {
  onLoginSuccess: (user: AuthUser) => Promise<void>;
  onLoginError: (message: string) => void;
  setLoading: (loading: boolean) => void;
  clearErrors: () => void;
  showFieldError: (fieldId: string, message: string) => void;
}

/**
 * Handle login form submission
 */
export async function handleLogin(
  credentials: LoginCredentials,
  callbacks: LoginCallbacks
): Promise<void> {
  callbacks.clearErrors();

  // Basic validation
  if (!credentials.email.trim()) {
    callbacks.showFieldError('client-email', 'Email address is required');
    return;
  }

  if (!credentials.password.trim()) {
    callbacks.showFieldError('client-password', 'Password is required');
    return;
  }

  callbacks.setLoading(true);

  try {
    // Try backend authentication first
    try {
      const response = await fetch(`${AUTH_API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        const data = await response.json();

        // Store auth mode and user info (token is in HttpOnly cookie)
        sessionStorage.setItem('client_auth_mode', 'authenticated');
        sessionStorage.setItem('client_auth_user', JSON.stringify(data.user));

        // Check for redirect parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');
        console.log('[ClientPortal] Login success, redirect param:', redirectUrl, 'user:', data.user);

        if (redirectUrl && redirectUrl.startsWith('/')) {
          console.log('[ClientPortal] Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;
          return;
        }

        // If user is admin, redirect to admin dashboard
        if (data.user.isAdmin || data.user.type === 'admin') {
          console.log('[ClientPortal] User is admin, redirecting to /admin/');
          window.location.href = '/admin/';
          return;
        }

        // Call success handler
        await callbacks.onLoginSuccess({
          id: data.user.id,
          email: data.user.email,
          name: data.user.contactName || data.user.companyName || data.user.email.split('@')[0],
          isAdmin: data.user.isAdmin,
          type: data.user.type
        });
        return;
      }

      // Handle specific error responses from backend
      const errorData = await response.json();
      if (errorData.code === 'INVALID_CREDENTIALS') {
        throw new Error('Invalid email or password');
      } else if (errorData.code === 'ACCOUNT_INACTIVE') {
        throw new Error('Your account is inactive. Please contact support.');
      } else {
        throw new Error(errorData.error || 'Login failed');
      }
    } catch (fetchError) {
      // If backend is unavailable, show error
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        console.error('[ClientPortal] Backend unavailable');
        throw new Error('Unable to connect to server. Please try again later.');
      }

      // Re-throw authentication errors
      throw fetchError;
    }
  } catch (error) {
    console.error('Login error:', error);
    callbacks.onLoginError(error instanceof Error ? error.message : 'Login failed');
  } finally {
    callbacks.setLoading(false);
  }
}

/**
 * Check for existing authentication
 */
export async function checkExistingAuth(callbacks: {
  onAuthValid: (user: AuthUser) => Promise<void>;
}): Promise<boolean> {
  const authMode = sessionStorage.getItem('client_auth_mode');
  if (!authMode) return false;

  // Check for redirect parameter first - if user is already logged in and there's a redirect, go there
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect');
  if (redirectUrl && redirectUrl.startsWith('/')) {
    console.log('[ClientPortal] Already authenticated, redirecting to:', redirectUrl);
    window.location.href = redirectUrl;
    return true;
  }

  try {
    const response = await fetch(`${AUTH_API_BASE}/profile`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (response.ok) {
      const data = await response.json();

      // If user is admin, redirect to admin dashboard
      if (data.user.isAdmin || data.user.type === 'admin') {
        console.log('[ClientPortal] User is admin, redirecting to /admin/');
        window.location.href = '/admin/';
        return true;
      }

      await callbacks.onAuthValid({
        id: data.user.id,
        email: data.user.email,
        name: data.user.contactName || data.user.companyName || data.user.email.split('@')[0],
        isAdmin: data.user.isAdmin,
        type: data.user.type
      });
      return true;
    }
    // Auth is invalid, clear it
    clearAuthData();
    return false;

  } catch (error) {
    console.error('Auth check failed:', error);
    // Don't remove auth on network errors - might just be backend down
    if (!(error instanceof TypeError)) {
      clearAuthData();
    }
    return false;
  }
}

/**
 * Handle user logout - clear session and redirect to landing page
 */
export function handleLogout(): void {
  clearAuthData();
  window.location.href = '/';
}

/**
 * Clear all authentication data from sessionStorage
 */
export function clearAuthData(): void {
  sessionStorage.removeItem('clientAuth');
  sessionStorage.removeItem('clientAuthToken');
  sessionStorage.removeItem('client_auth_mode');
  sessionStorage.removeItem('client_auth_user');
  sessionStorage.removeItem('clientPortalAuth');
  sessionStorage.removeItem('clientEmail');
  sessionStorage.removeItem('clientName');
}

/**
 * Check if user is admin and show admin-only UI elements
 */
export function setupAdminFeatures(): void {
  try {
    // Check sessionStorage for admin flag
    const authData = sessionStorage.getItem('clientAuth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.isAdmin) {
        showAdminButtons();
        console.log('[ClientPortal] Admin features enabled');
      }
    }

    // Also check JWT token for admin flag
    const token = sessionStorage.getItem('client_auth_token');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && isAdminPayload(payload)) {
        showAdminButtons();
        console.log('[ClientPortal] Admin features enabled (from token)');
      }
    }
  } catch (error) {
    console.error('[ClientPortal] Error checking admin status:', error);
  }
}

/**
 * Show admin-only buttons
 */
function showAdminButtons(): void {
  const adminButtons = document.querySelectorAll('.btn-admin');
  adminButtons.forEach((btn) => btn.classList.remove('hidden'));
}

/**
 * Show field-specific error
 */
export function showFieldError(fieldId: string, message: string): void {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(`${fieldId.replace('client-', '')}-error`);

  if (field) field.classList.add('error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

/**
 * Show login error message
 */
export function showLoginError(message: string): void {
  const errorElement = document.getElementById('login-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

/**
 * Set login button loading state
 */
export function setLoginLoading(loading: boolean): void {
  const submitBtn = document.getElementById('login-btn') as HTMLButtonElement;
  const loader = document.querySelector('.btn-loader') as HTMLElement;

  if (submitBtn) {
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.classList.add('loading');
    } else {
      submitBtn.classList.remove('loading');
    }
  }

  if (loader) {
    loader.style.display = loading ? 'block' : 'none';
  }
}

/**
 * Clear all error states
 */
export function clearErrors(): void {
  document.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
  document.querySelectorAll('.error-message').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });
}
