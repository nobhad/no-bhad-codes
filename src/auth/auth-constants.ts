/**
 * ===============================================
 * AUTH STORAGE CONSTANTS
 * ===============================================
 * @file src/auth/auth-constants.ts
 *
 * Centralized storage keys and constants for authentication.
 * Consolidates 14+ scattered localStorage/sessionStorage keys.
 */

/**
 * Unified auth storage keys
 * All auth-related storage uses these keys
 */
export const AUTH_STORAGE_KEYS = {
  // ============================================
  // Session Storage Keys (active session)
  // ============================================
  SESSION: {
    /** Current authenticated user data */
    USER: 'nbw_auth_user',

    /** User role (admin | client) */
    ROLE: 'nbw_auth_role',

    /** Session expiry timestamp */
    EXPIRY: 'nbw_auth_expiry',

    /** Current client ID (for client portal) */
    CLIENT_ID: 'nbw_auth_client_id',

    /** Session ID for tracking */
    SESSION_ID: 'nbw_auth_session_id',

    /** Auth mode flag */
    AUTH_MODE: 'nbw_auth_mode'
  },

  // ============================================
  // Local Storage Keys (persistent)
  // ============================================
  LOCAL: {
    /** Remember user preference */
    REMEMBER_USER: 'nbw_remember_user',

    /** Last login email (for convenience) */
    LAST_EMAIL: 'nbw_last_email',

    /** Theme preference */
    THEME: 'nbw_theme'
  },

  // ============================================
  // Legacy Keys (for migration)
  // These are the old scattered keys that need to be cleaned up
  // ============================================
  LEGACY: {
    // Old auth service keys
    auth_user: 'auth_user',
    auth_token: 'auth_token',
    auth_expiry: 'auth_expiry',

    // Old admin auth keys
    admin_session: 'admin_session',
    admin_token: 'admin_token',
    admin_auth: 'admin_auth',

    // Old client portal keys
    client_session: 'client_session',
    client_token: 'client_token',
    client_auth_mode: 'client_auth_mode',
    client_id: 'client_id',
    client_data: 'client_data',

    // Other scattered keys
    session_data: 'session_data',
    user_data: 'user_data'
  }
} as const;

/**
 * Auth timing constants
 */
export const AUTH_TIMING = {
  /** Session timeout in milliseconds (30 minutes) */
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,

  /** Admin session timeout in milliseconds (2 hours) */
  ADMIN_SESSION_TIMEOUT_MS: 2 * 60 * 60 * 1000,

  /** Client session timeout in milliseconds (7 days) */
  CLIENT_SESSION_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,

  /** Token refresh buffer (5 minutes before expiry) */
  REFRESH_BUFFER_MS: 5 * 60 * 1000,

  /** Session extension on activity (30 minutes) */
  SESSION_EXTENSION_MS: 30 * 60 * 1000,

  /** Inactivity check interval (1 minute) */
  INACTIVITY_CHECK_INTERVAL_MS: 60 * 1000
} as const;

/**
 * Auth event names (for custom events)
 */
export const AUTH_EVENTS = {
  /** Fired when user logs in */
  LOGIN: 'nbw:auth:login',

  /** Fired when user logs out */
  LOGOUT: 'nbw:auth:logout',

  /** Fired when session expires */
  SESSION_EXPIRED: 'nbw:auth:session-expired',

  /** Fired when session is extended */
  SESSION_EXTENDED: 'nbw:auth:session-extended',

  /** Fired when auth state changes */
  STATE_CHANGE: 'nbw:auth:state-change',

  /** Fired when token is refreshed */
  TOKEN_REFRESHED: 'nbw:auth:token-refreshed'
} as const;

/**
 * Auth error codes
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  MAGIC_LINK_EXPIRED: 'MAGIC_LINK_EXPIRED',
  MAGIC_LINK_INVALID: 'MAGIC_LINK_INVALID',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

/**
 * User roles
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client'
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Get all legacy keys for cleanup
 */
export function getLegacyKeys(): string[] {
  return Object.values(AUTH_STORAGE_KEYS.LEGACY);
}

/**
 * Get all session keys
 */
export function getSessionKeys(): string[] {
  return Object.values(AUTH_STORAGE_KEYS.SESSION);
}

/**
 * Get all local keys
 */
export function getLocalKeys(): string[] {
  return Object.values(AUTH_STORAGE_KEYS.LOCAL);
}
