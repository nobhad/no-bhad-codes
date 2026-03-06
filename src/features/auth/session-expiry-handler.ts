/**
 * ===============================================
 * SESSION EXPIRY HANDLER
 * ===============================================
 * @file src/features/auth/session-expiry-handler.ts
 *
 * Handles session expiry detection from URL params.
 * Clears stale auth data and shows expiry message.
 *
 * Extracted from server/views/partials/head.ejs
 */

const AUTH_STORAGE_KEYS = [
  'nbw_auth_user',
  'nbw_auth_expiry',
  'nbw_auth_role',
  'nbw_auth_session_id'
] as const;

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/**
 * Check URL for session=expired param and handle accordingly.
 * Should be called on DOMContentLoaded.
 */
export function handleSessionExpiry(): boolean {
  const params = new URLSearchParams(window.location.search);
  const sessionExpired = params.get('session') === 'expired';

  if (!sessionExpired) return false;

  // Clear stale auth data
  for (const key of AUTH_STORAGE_KEYS) {
    sessionStorage.removeItem(key);
  }

  // Show session expired message
  const errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.textContent = SESSION_EXPIRED_MESSAGE;
    errorEl.style.display = 'block';
  }

  // Clean up URL
  params.delete('session');
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, '', newUrl);

  return true;
}

/**
 * Check if user has a valid auth session in sessionStorage.
 * Adds 'auth-checked' class to html element if authenticated.
 */
export function checkAuthSession(): boolean {
  const authUser = sessionStorage.getItem('nbw_auth_user');
  const authExpiry = sessionStorage.getItem('nbw_auth_expiry');
  const isAuthenticated = !!(authUser && authExpiry && Date.now() < parseInt(authExpiry, 10));

  if (isAuthenticated) {
    document.documentElement.classList.add('auth-checked');
  }

  return isAuthenticated;
}
