/**
 * ===============================================
 * CENTRALIZED AUTH STORE
 * ===============================================
 * @file src/auth/auth-store.ts
 *
 * Centralized authentication state management.
 * Single source of truth for auth state across the application.
 */

import {
  AUTH_STORAGE_KEYS,
  AUTH_TIMING,
  AUTH_EVENTS,
  getLegacyKeys,
  type UserRole
} from './auth-constants';

import {
  type AuthState,
  type AuthStore,
  type AnyUser,
  type LoginCredentials,
  type AdminLoginCredentials,
  type AuthResult,
  type LoginResult,
  type SessionData,
  INITIAL_AUTH_STATE,
  isSessionExpired
} from './auth-types';

import { authEndpoints, adminAuthEndpoints } from '../config/api';
import { getCsrfToken, CSRF_HEADER_NAME } from '../utils/api-client';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthStore');

// ============================================
// HTTP Error with status code
// ============================================

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// ============================================
// Module-level guards
// ============================================

/** AbortController for in-flight refresh requests */
let refreshAbortController: AbortController | null = null;

/** Deduplication guard for concurrent refresh calls */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Runtime type guard for parsed user objects from storage.
 * Validates the parsed JSON has the minimum required fields.
 */
function isValidUser(obj: unknown): obj is AnyUser {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'role' in obj
  );
}

// ============================================
// Auth Store Implementation
// ============================================

/**
 * Create the auth store
 */
function createAuthStore(): AuthStore {
  // ============================================
  // Private State
  // ============================================
  let state: AuthState = { ...INITIAL_AUTH_STATE };
  const listeners: Set<(state: AuthState) => void> = new Set();
  let refreshTimer: number | null = null;
  let inactivityTimer: number | null = null;

  // Event listener cleanup storage
  let activityListenerCleanup: (() => void) | null = null;
  let storageListenerCleanup: (() => void) | null = null;

  // ============================================
  // State Management
  // ============================================

  function setState(updates: Partial<AuthState>): void {
    state = { ...state, ...updates };
    notifyListeners();
  }

  function notifyListeners(): void {
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Auth listener error:', error);
      }
    });
  }

  function emitEvent(eventName: string, detail?: unknown): void {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // ============================================
  // Storage Operations
  // ============================================

  function saveSession(user: AnyUser, expiresAt: number, sessionId: string): void {
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.USER, JSON.stringify(user));
      sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.ROLE, user.role);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.EXPIRY, expiresAt.toString());
      sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.SESSION_ID, sessionId);
    } catch (error) {
      logger.error('Failed to save session:', error);
    }
  }

  function loadSession(): SessionData | null {
    try {
      const userStr = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION.USER);
      const role = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION.ROLE) as UserRole | null;
      const expiryStr = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION.EXPIRY);
      const sessionId = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION.SESSION_ID);

      if (!userStr || !role || !expiryStr || !sessionId) {
        return null;
      }

      const parsed: unknown = JSON.parse(userStr);
      if (!isValidUser(parsed)) {
        logger.warn('Invalid user data in session storage');
        return null;
      }
      const user: AnyUser = parsed;
      const expiresAt = parseInt(expiryStr, 10);

      return {
        user,
        role,
        expiresAt,
        sessionId,
        createdAt: Date.now()
      };
    } catch (error) {
      logger.error('Failed to load session:', error);
      return null;
    }
  }

  function clearSession(): void {
    // Clear new storage keys
    Object.values(AUTH_STORAGE_KEYS.SESSION).forEach((key) => {
      sessionStorage.removeItem(key);
    });

    // Clear legacy keys
    getLegacyKeys().forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  }

  // ============================================
  // Timer Management
  // ============================================

  /**
   * Internal refresh session logic - extracted to avoid forward reference to store
   */
  async function doRefreshSession(): Promise<boolean> {
    if (!state.isAuthenticated) {
      return false;
    }

    // Deduplicate concurrent refresh calls
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const refreshEndpoint =
          state.role === 'admin' ? adminAuthEndpoints.validate : authEndpoints.refresh;

        await fetchWithAuth(refreshEndpoint, { method: 'POST' });

        const newExpiresAt =
          Date.now() +
          (state.role === 'admin'
            ? AUTH_TIMING.ADMIN_SESSION_TIMEOUT_MS
            : AUTH_TIMING.CLIENT_SESSION_TIMEOUT_MS);

        sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.EXPIRY, newExpiresAt.toString());

        setState({ expiresAt: newExpiresAt });
        startRefreshTimer();
        emitEvent(AUTH_EVENTS.TOKEN_REFRESHED);

        return true;
      } catch (_error) {
        handleSessionExpired();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function startRefreshTimer(): void {
    stopRefreshTimer();

    if (!state.expiresAt) return;

    const timeUntilRefresh = state.expiresAt - Date.now() - AUTH_TIMING.REFRESH_BUFFER_MS;

    if (timeUntilRefresh > 0) {
      refreshTimer = window.setTimeout(doRefreshSession, timeUntilRefresh);
    }
  }

  function stopRefreshTimer(): void {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function startInactivityTimer(): void {
    stopInactivityTimer();

    inactivityTimer = window.setTimeout(() => {
      if (state.isAuthenticated) {
        // Check if session should be expired due to inactivity
        if (isSessionExpired(state.expiresAt)) {
          handleSessionExpired();
        }
      }
    }, AUTH_TIMING.INACTIVITY_CHECK_INTERVAL_MS);
  }

  function stopInactivityTimer(): void {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }

  function handleSessionExpired(): void {
    // Abort any in-flight refresh request
    if (refreshAbortController) {
      refreshAbortController.abort();
      refreshAbortController = null;
    }

    clearSession();
    stopRefreshTimer();
    stopInactivityTimer();

    setState({
      isAuthenticated: false,
      user: null,
      role: null,
      expiresAt: null,
      sessionId: null,
      error: 'Session expired'
    });

    emitEvent(AUTH_EVENTS.SESSION_EXPIRED);
  }

  // ============================================
  // API Helpers
  // ============================================

  async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
    const method = options.method?.toUpperCase() || 'GET';
    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const csrfToken = needsCsrf ? getCsrfToken() : null;

    // Create an AbortController so in-flight requests can be cancelled on logout/expiry
    refreshAbortController = new AbortController();
    const { signal } = refreshAbortController;

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
        ...options.headers
      }
    });

    const json = await response.json();

    if (!response.ok) {
      throw new HttpError(json.error || 'Request failed', response.status);
    }

    // Server wraps responses in { success: true, data: { ... } }
    // Unwrap the data property for easier access
    return json.data ?? json;
  }

  // ============================================
  // Store Implementation
  // ============================================

  const store: AuthStore = {
    // ----------------------------------------
    // State
    // ----------------------------------------

    getState(): AuthState {
      return { ...state };
    },

    subscribe(listener: (state: AuthState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // ----------------------------------------
    // Client Login
    // ----------------------------------------

    async login(credentials: LoginCredentials): Promise<LoginResult> {
      setState({ isProcessing: true, error: null });

      try {
        const data = await fetchWithAuth<{
          message: string;
          user: AnyUser;
          expiresIn: string;
          isFirstLogin?: boolean;
        }>(authEndpoints.login, {
          method: 'POST',
          body: JSON.stringify(credentials)
        });

        const expiresAt = Date.now() + AUTH_TIMING.CLIENT_SESSION_TIMEOUT_MS;
        const sessionId = crypto.randomUUID();
        const isFirstLogin = data.isFirstLogin ?? false;

        saveSession(data.user, expiresAt, sessionId);

        // Store isFirstLogin for greeting display
        sessionStorage.setItem('nbw_auth_is_first_login', isFirstLogin ? 'true' : 'false');

        setState({
          isAuthenticated: true,
          isProcessing: false,
          user: data.user,
          role: data.user.role,
          expiresAt,
          sessionId,
          error: null,
          isFirstLogin
        });

        startRefreshTimer();
        emitEvent(AUTH_EVENTS.LOGIN, { user: data.user, isFirstLogin });

        return {
          success: true,
          data: data.user,
          expiresIn: data.expiresIn,
          sessionId,
          isFirstLogin
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        setState({ isProcessing: false, error: message });
        return { success: false, error: message };
      }
    },

    // ----------------------------------------
    // Admin Login
    // ----------------------------------------

    async adminLogin(credentials: AdminLoginCredentials): Promise<LoginResult> {
      setState({ isProcessing: true, error: null });

      try {
        const data = await fetchWithAuth<{
          message: string;
          user: AnyUser;
        }>(adminAuthEndpoints.login, {
          method: 'POST',
          body: JSON.stringify(credentials)
        });

        const expiresAt = Date.now() + AUTH_TIMING.ADMIN_SESSION_TIMEOUT_MS;
        const sessionId = crypto.randomUUID();

        saveSession(data.user, expiresAt, sessionId);

        setState({
          isAuthenticated: true,
          isProcessing: false,
          user: data.user,
          role: 'admin',
          expiresAt,
          sessionId,
          error: null,
          isFirstLogin: false
        });

        startRefreshTimer();
        emitEvent(AUTH_EVENTS.LOGIN, { user: data.user });

        return {
          success: true,
          data: data.user,
          sessionId
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Admin login failed';
        setState({ isProcessing: false, error: message });
        return { success: false, error: message };
      }
    },

    // ----------------------------------------
    // Logout
    // ----------------------------------------

    async logout(): Promise<void> {
      setState({ isProcessing: true });

      try {
        // Notify server (ignore errors)
        if (state.isAuthenticated) {
          const logoutEndpoint =
            state.role === 'admin' ? adminAuthEndpoints.logout : authEndpoints.logout;

          await fetch(logoutEndpoint, {
            method: 'POST',
            credentials: 'include'
          }).catch((error) => {
            // Logout API failure is non-critical - local cleanup continues
            logger.warn('Logout API call failed:', error);
          });
        }
      } finally {
        // Abort any in-flight refresh request
        if (refreshAbortController) {
          refreshAbortController.abort();
          refreshAbortController = null;
        }

        clearSession();
        stopRefreshTimer();
        stopInactivityTimer();

        // Cleanup event listeners
        if (activityListenerCleanup) {
          activityListenerCleanup();
          activityListenerCleanup = null;
        }
        if (storageListenerCleanup) {
          storageListenerCleanup();
          storageListenerCleanup = null;
        }

        setState({
          ...INITIAL_AUTH_STATE,
          isLoading: false
        });

        emitEvent(AUTH_EVENTS.LOGOUT);
      }
    },

    // ----------------------------------------
    // Session Refresh
    // ----------------------------------------

    async refreshSession(): Promise<boolean> {
      return doRefreshSession();
    },

    // ----------------------------------------
    // Session Validation
    // ----------------------------------------

    async validateSession(): Promise<boolean> {
      if (!state.isAuthenticated) {
        return false;
      }

      // Check local expiry first
      if (isSessionExpired(state.expiresAt)) {
        handleSessionExpired();
        return false;
      }

      try {
        const validateEndpoint =
          state.role === 'admin' ? adminAuthEndpoints.validate : authEndpoints.validate;

        await fetchWithAuth(validateEndpoint, { method: 'GET' });
        return true;
      } catch (error) {
        // Only expire session on explicit auth rejection (401/403).
        // Network errors or server issues should not destroy a valid local session.
        const isAuthRejection =
          error instanceof HttpError && (error.status === 401 || error.status === 403);

        if (isAuthRejection) {
          handleSessionExpired();
        } else {
          logger.warn('Session validation failed (non-auth error):', error);
        }
        return false;
      }
    },

    // ----------------------------------------
    // Magic Link
    // ----------------------------------------

    async requestMagicLink(email: string): Promise<AuthResult> {
      try {
        await fetchWithAuth(authEndpoints.magicLink, {
          method: 'POST',
          body: JSON.stringify({ email })
        });

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send magic link';
        return { success: false, error: message };
      }
    },

    async verifyMagicLink(token: string): Promise<LoginResult> {
      setState({ isProcessing: true, error: null });

      try {
        const data = await fetchWithAuth<{
          user: AnyUser;
        }>(authEndpoints.verifyMagicLink, {
          method: 'POST',
          body: JSON.stringify({ token })
        });

        const expiresAt = Date.now() + AUTH_TIMING.CLIENT_SESSION_TIMEOUT_MS;
        const sessionId = crypto.randomUUID();

        saveSession(data.user, expiresAt, sessionId);

        setState({
          isAuthenticated: true,
          isProcessing: false,
          user: data.user,
          role: data.user.role,
          expiresAt,
          sessionId,
          error: null,
          isFirstLogin: false
        });

        startRefreshTimer();
        emitEvent(AUTH_EVENTS.LOGIN, { user: data.user });

        return {
          success: true,
          data: data.user,
          sessionId
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid or expired magic link';
        setState({ isProcessing: false, error: message });
        return { success: false, error: message };
      }
    },

    // ----------------------------------------
    // Getters
    // ----------------------------------------

    isAuthenticated(): boolean {
      return state.isAuthenticated && state.expiresAt != null && !isSessionExpired(state.expiresAt);
    },

    isAdmin(): boolean {
      return state.isAuthenticated && state.role === 'admin';
    },

    isClient(): boolean {
      return state.isAuthenticated && state.role === 'client';
    },

    getCurrentUser(): AnyUser | null {
      return state.user;
    },

    getSessionTimeRemaining(): number {
      if (!state.expiresAt) return 0;
      return Math.max(0, state.expiresAt - Date.now());
    },

    // ----------------------------------------
    // Utilities
    // ----------------------------------------

    clearError(): void {
      setState({ error: null });
    },

    extendSession(): void {
      if (!state.isAuthenticated || !state.expiresAt) return;

      const newExpiresAt = Date.now() + AUTH_TIMING.SESSION_EXTENSION_MS;

      sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.EXPIRY, newExpiresAt.toString());

      setState({ expiresAt: newExpiresAt });
      startRefreshTimer();
      emitEvent(AUTH_EVENTS.SESSION_EXTENDED);
    }
  };

  // ============================================
  // Initialization
  // ============================================

  function initialize(): void {
    const session = loadSession();

    if (session && !isSessionExpired(session.expiresAt)) {
      // Restore isFirstLogin from session storage
      const isFirstLoginStr = sessionStorage.getItem('nbw_auth_is_first_login');
      const isFirstLogin = isFirstLoginStr === 'true';

      setState({
        isAuthenticated: true,
        isLoading: false,
        user: session.user,
        role: session.role,
        expiresAt: session.expiresAt,
        sessionId: session.sessionId,
        isFirstLogin
      });

      startRefreshTimer();
      startInactivityTimer();

      // Validate with server (fire-and-forget).
      // On failure, log but do NOT expire the session — the server already
      // gates authenticated pages via JWT cookie. If the token is truly
      // invalid, API calls will 401 and the global interceptor handles it.
      store.validateSession().catch((error) => {
        logger.warn('Background session validation failed:', error);
      });
    } else {
      clearSession();
      sessionStorage.removeItem('nbw_auth_is_first_login');
      setState({ isLoading: false });
    }

    // Listen for storage changes (multi-tab sync)
    const handleStorageChange = (event: globalThis.StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEYS.SESSION.USER) {
        if (!event.newValue) {
          // Session was cleared in another tab
          clearSession();
          stopRefreshTimer();
          setState({
            ...INITIAL_AUTH_STATE,
            isLoading: false
          });
          emitEvent(AUTH_EVENTS.LOGOUT);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    storageListenerCleanup = () => {
      window.removeEventListener('storage', handleStorageChange);
    };

    // Extend session on activity - use named handler for cleanup
    const handleActivity = () => {
      if (state.isAuthenticated) {
        startInactivityTimer();
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    activityEvents.forEach((eventType) => {
      window.addEventListener(eventType, handleActivity, { passive: true });
    });

    // Store cleanup function
    activityListenerCleanup = () => {
      activityEvents.forEach((eventType) => {
        window.removeEventListener(eventType, handleActivity);
      });
    };

    // Clean up all listeners on page unload to prevent leaks
    window.addEventListener('beforeunload', () => {
      activityListenerCleanup?.();
      storageListenerCleanup?.();
      stopRefreshTimer();
      stopInactivityTimer();
    });
  }

  initialize();

  return store;
}

// ============================================
// Export Singleton
// ============================================

export const authStore = createAuthStore();
export default authStore;
