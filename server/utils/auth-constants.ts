/**
 * ===============================================
 * AUTHENTICATION CONSTANTS
 * ===============================================
 * @file server/utils/auth-constants.ts
 *
 * Centralized authentication configuration constants.
 * Use these instead of hardcoding values in route files.
 */

import config from '../config/environment.js';

/**
 * Password hashing configuration
 */
export const PASSWORD_CONFIG = {
  /** Number of bcrypt salt rounds - higher is more secure but slower */
  SALT_ROUNDS: config.BCRYPT_ROUNDS || 12,

  /** Minimum password length */
  MIN_LENGTH: 12,

  /** Password complexity requirements */
  REQUIREMENTS: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true
  }
} as const;

/**
 * JWT token configuration
 */
export const JWT_CONFIG = {
  /** Regular user token expiry */
  USER_TOKEN_EXPIRY: config.JWT_EXPIRES_IN || '7d',

  /** Admin token expiry (shorter for security) */
  ADMIN_TOKEN_EXPIRY: '1h',

  /** Refresh token expiry */
  REFRESH_TOKEN_EXPIRY: config.REFRESH_TOKEN_EXPIRES_IN || '30d',

  /** Magic link token expiry */
  MAGIC_LINK_EXPIRY: '15m',

  /** Password reset token expiry */
  RESET_TOKEN_EXPIRY: '1h'
} as const;

/**
 * Time durations in milliseconds
 */
export const TIME_MS = {
  /** 1 minute */
  MINUTE: 60 * 1000,

  /** 15 minutes */
  FIFTEEN_MINUTES: 15 * 60 * 1000,

  /** 1 hour */
  HOUR: 60 * 60 * 1000,

  /** 24 hours */
  DAY: 24 * 60 * 60 * 1000,

  /** 7 days */
  WEEK: 7 * 24 * 60 * 60 * 1000,

  /** 30 days */
  MONTH: 30 * 24 * 60 * 60 * 1000
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Login attempts before lockout */
  LOGIN: {
    MAX_ATTEMPTS: config.RATE_LIMIT_LOGIN_MAX || 5,
    WINDOW_MS: TIME_MS.FIFTEEN_MINUTES
  },

  /** Forgot password requests */
  FORGOT_PASSWORD: {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: TIME_MS.FIFTEEN_MINUTES
  },

  /** Admin login (stricter) */
  ADMIN_LOGIN: {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: TIME_MS.FIFTEEN_MINUTES
  },

  /** Magic link requests */
  MAGIC_LINK: {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: TIME_MS.FIFTEEN_MINUTES
  },

  /** Contact form submissions */
  CONTACT_FORM: {
    MAX_ATTEMPTS: config.RATE_LIMIT_CONTACT_MAX || 5,
    WINDOW_MS: TIME_MS.HOUR
  },

  /** Intake form submissions */
  INTAKE_FORM: {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: TIME_MS.DAY
  },

  /** File uploads */
  FILE_UPLOAD: {
    MAX_ATTEMPTS: 10,
    WINDOW_MS: 10 * TIME_MS.MINUTE
  }
} as const;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  /** Session timeout duration */
  TIMEOUT_MS: TIME_MS.HOUR,

  /** Session extension threshold (extend when less than this remaining) */
  EXTENSION_THRESHOLD_MS: 10 * TIME_MS.MINUTE
} as const;

/**
 * Cookie configuration for HttpOnly auth tokens
 */
export const COOKIE_CONFIG = {
  /** Cookie name for auth token */
  AUTH_TOKEN_NAME: 'auth_token',

  /** Cookie options for user tokens */
  USER_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Use 'lax' in development so auth cookies work through dev proxies
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    maxAge: TIME_MS.WEEK, // 7 days
    path: '/'
  },

  /** Cookie options for admin tokens (shorter lived) */
  ADMIN_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    maxAge: TIME_MS.HOUR, // 1 hour
    path: '/'
  }
} as const;

/**
 * Password validation regex
 * Requires: 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Validate password against requirements
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`);
  }

  if (PASSWORD_CONFIG.REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_CONFIG.REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_CONFIG.REQUIREMENTS.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_CONFIG.REQUIREMENTS.REQUIRE_SPECIAL && !/[@$!%*?&-]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&-)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
