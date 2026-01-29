/**
 * ===============================================
 * PORTAL AUTH MODULE
 * ===============================================
 * @file src/features/client/modules/portal-auth.ts
 *
 * Authentication functionality for client portal.
 * Delegates to centralized authStore for state management.
 *
 * @deprecated Consider using authStore directly for new code.
 * This module is maintained for backward compatibility.
 */

import { authStore } from '../../../auth';
import type { AnyUser, ClientUser } from '../../../auth/auth-types';
import { isClientUser } from '../../../auth/auth-types';
import { createLogger } from '../../../utils/logging';

const logger = createLogger('PortalAuth');

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
 * Get display name from user based on role
 */
function getUserDisplayName(user: AnyUser): string {
  if (isClientUser(user)) {
    return user.contactName || user.companyName || user.email.split('@')[0];
  }
  // Admin user - use username or email
  return user.username || user.email.split('@')[0];
}

/**
 * Convert AnyUser to AuthUser for backward compatibility
 */
function toAuthUser(user: AnyUser): AuthUser {
  const isClient = isClientUser(user);
  const clientUser = isClient ? (user as ClientUser) : null;

  return {
    id: user.id,
    email: user.email,
    name: getUserDisplayName(user),
    contactName: clientUser?.contactName,
    companyName: clientUser?.companyName,
    isAdmin: user.role === 'admin',
    type: user.role
  };
}

/**
 * Handle login form submission
 * Delegates to authStore.login()
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
    const result = await authStore.login(credentials);

    if (result.success && result.data) {
      // Check for redirect parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');

      if (redirectUrl && redirectUrl.startsWith('/')) {
        window.location.href = redirectUrl;
        return;
      }

      // If user is admin, redirect to admin dashboard
      if (result.data.role === 'admin') {
        window.location.href = '/admin/';
        return;
      }

      // Call success handler
      await callbacks.onLoginSuccess(toAuthUser(result.data));
      return;
    }

    // Handle error
    const errorMessage = result.error || 'Login failed';
    throw new Error(errorMessage);
  } catch (error) {
    logger.error('Login error', { error: error instanceof Error ? error.message : String(error) });
    callbacks.onLoginError('Login failed. Please check your email and password.');
  } finally {
    callbacks.setLoading(false);
  }
}

/**
 * Check for existing authentication
 * Delegates to authStore.validateSession()
 */
export async function checkExistingAuth(callbacks: {
  onAuthValid: (user: AuthUser) => Promise<void>;
}): Promise<boolean> {
  // Check if already authenticated via authStore
  if (!authStore.isAuthenticated()) {
    return false;
  }

  // Check for redirect parameter first - if user is already logged in and there's a redirect, go there
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect');
  if (redirectUrl && redirectUrl.startsWith('/')) {
    window.location.href = redirectUrl;
    return true;
  }

  try {
    // Validate session with server
    const isValid = await authStore.validateSession();

    if (isValid) {
      const user = authStore.getCurrentUser();

      if (!user) {
        return false;
      }

      // If user is admin, redirect to admin dashboard
      if (user.role === 'admin') {
        logger.info('User is admin, redirecting to /admin/');
        window.location.href = '/admin/';
        return true;
      }

      await callbacks.onAuthValid(toAuthUser(user));
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Auth check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Handle user logout - clear session and redirect to landing page
 * Delegates to authStore.logout()
 */
export async function handleLogout(): Promise<void> {
  await authStore.logout();
  window.location.href = '/';
}

/**
 * Clear all authentication data from sessionStorage
 * @deprecated Use authStore.logout() instead
 */
export function clearAuthData(): void {
  // Legacy keys - authStore handles these now
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
 * Delegates to authStore.isAdmin()
 */
export function setupAdminFeatures(): void {
  try {
    // Check via authStore
    if (authStore.isAdmin()) {
      showAdminButtons();
      return;
    }

    // Also check if user is authenticated with admin role
    if (authStore.isAuthenticated()) {
      const user = authStore.getCurrentUser();
      if (user?.role === 'admin') {
        showAdminButtons();
      }
    }
  } catch (error) {
    logger.error('Error checking admin status', { error: error instanceof Error ? error.message : String(error) });
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
 * Show field-specific error with ARIA for accessibility
 */
export function showFieldError(fieldId: string, message: string): void {
  const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  const errorId = `${fieldId.replace('client-', '')}-error`;
  const errorElement = document.getElementById(errorId);

  if (field) {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
  }
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'polite');
    if (field) field.setAttribute('aria-describedby', errorId);
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
 * Clear all error states and ARIA attributes
 */
export function clearErrors(): void {
  document.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  document.querySelectorAll('.error-message').forEach((el) => {
    const span = el as HTMLElement;
    span.style.display = 'none';
    span.removeAttribute('role');
    span.removeAttribute('aria-live');
  });
}
