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
import { createLogger } from '../../../utils/logger';
import { ROUTES } from '../../../constants/api-endpoints';
import { validateEmail } from '../../../../shared/validation/validators';

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
    callbacks.showFieldError('portal-email', 'Email address is required');
    return;
  }

  // Email format validation
  const emailValidation = validateEmail(credentials.email, { allowDisposable: true });
  if (!emailValidation.isValid) {
    callbacks.showFieldError('portal-email', emailValidation.error || 'Invalid email format');
    return;
  }

  if (!credentials.password.trim()) {
    callbacks.showFieldError('portal-password', 'Password is required');
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

      const authUser = toAuthUser(result.data);

      // Admin always redirects directly — no need to load client projects.
      if (authUser.isAdmin) {
        window.location.href = ROUTES.PORTAL.DASHBOARD;
        return;
      }

      // Client: delegate to caller to handle dashboard transition.
      await callbacks.onLoginSuccess(authUser);
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
 * Check for existing authentication.
 *
 * Two-path strategy to eliminate the in-page duplicate auth gate:
 *  1. authStore has a session → validate with server → show dashboard.
 *  2. authStore is empty (e.g. fresh page load, new tab, expired sessionStorage)
 *     → try to restore session from the JWT cookie via GET /api/auth/profile.
 *     If the cookie is valid we show the dashboard directly; if not we redirect
 *     to the login page. The in-page auth gate is NEVER shown.
 */
export async function checkExistingAuth(callbacks: {
  onAuthValid: (user: AuthUser) => Promise<void>;
}): Promise<boolean> {
  // Check for redirect parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect');
  if (redirectUrl && redirectUrl.startsWith('/')) {
    window.location.href = redirectUrl;
    return true;
  }

  // ── Path 1: authStore has an in-memory/sessionStorage session ─────────────
  if (authStore.isAuthenticated()) {
    try {
      const isValid = await authStore.validateSession();

      if (!isValid) {
        window.location.href = ROUTES.CLIENT.LOGIN;
        return false;
      }

      const user = authStore.getCurrentUser();
      if (!user) {
        window.location.href = ROUTES.CLIENT.LOGIN;
        return false;
      }

      if (user.role === 'admin') {
        window.location.href = ROUTES.PORTAL.DASHBOARD;
        return true;
      }

      await callbacks.onAuthValid(toAuthUser(user));
      return true;
    } catch (error) {
      logger.error('Auth validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      window.location.href = ROUTES.CLIENT.LOGIN;
      return false;
    }
  }

  // ── Path 2: No authStore session — restore from JWT cookie if valid ────────
  // This handles: landing on /dashboard directly (bookmark / new tab) after the
  // server already validated the cookie and rendered the portal template.
  // We fetch the full profile using the HttpOnly cookie. If valid we show the
  // dashboard; if not we redirect to login. Either way the in-page auth gate
  // is never shown to the user.
  return await restoreSessionFromCookie(callbacks);
}

/**
 * Attempt to restore a client session from the JWT cookie by fetching the
 * user profile from the server. On success calls onAuthValid and returns true.
 * On any failure redirects to the login page and returns false.
 */
async function restoreSessionFromCookie(callbacks: {
  onAuthValid: (user: AuthUser) => Promise<void>;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      // Cookie invalid, expired, or user not found → go to login
      window.location.href = ROUTES.CLIENT.LOGIN;
      return false;
    }

    const json = await res.json();
    const user = json.data?.user;

    if (!user) {
      window.location.href = ROUTES.CLIENT.LOGIN;
      return false;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.contactName || user.companyName || user.email.split('@')[0],
      contactName: user.contactName,
      companyName: user.companyName,
      isAdmin: user.isAdmin,
      type: user.role
    };

    await callbacks.onAuthValid(authUser);
    return true;
  } catch (error) {
    logger.error('Session restore from cookie failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    window.location.href = ROUTES.CLIENT.LOGIN;
    return false;
  }
}

/**
 * Handle user logout - clear session and redirect to client login
 * Delegates to authStore.logout()
 */
export async function handleLogout(): Promise<void> {
  await authStore.logout();
  window.location.href = ROUTES.CLIENT.LOGIN;
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
    logger.error('Error checking admin status', {
      error: error instanceof Error ? error.message : String(error)
    });
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
  const field = document.getElementById(fieldId) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  // Handle both 'portal-' and 'client-' prefixes for backward compatibility
  const errorId = `${fieldId.replace(/^(portal-|client-)/, '')}-error`;
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
  // Try both possible error element IDs for compatibility
  const errorElement =
    document.getElementById('auth-error') || document.getElementById('login-error');
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
