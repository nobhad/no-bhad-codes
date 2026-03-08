/**
 * ===============================================
 * TWO-FACTOR AUTHENTICATION CONSTANTS
 * ===============================================
 * @file server/utils/two-factor-constants.ts
 *
 * Centralized configuration for TOTP-based 2FA.
 * All magic numbers and configuration values are
 * defined here as named constants.
 */

/**
 * TOTP secret generation and validation configuration
 */
export const TOTP_CONFIG = {
  /** Length in bytes of the generated TOTP secret (20 bytes = 160 bits, RFC 4226 recommended) */
  SECRET_LENGTH_BYTES: 20,

  /** Number of digits in the TOTP code */
  CODE_DIGITS: 6,

  /** Time step in seconds (standard TOTP period) */
  TIME_STEP_SECONDS: 30,

  /** Hash algorithm used for HMAC */
  ALGORITHM: 'SHA1' as const,

  /** Number of time steps to check before/after current (for clock drift tolerance) */
  WINDOW: 1,

  /** Issuer name shown in authenticator apps */
  ISSUER: 'NoBhadCodes Admin'
} as const;

/**
 * Backup code configuration
 */
export const BACKUP_CODE_CONFIG = {
  /** Number of backup codes to generate */
  COUNT: 8,

  /** Length in bytes for each backup code (6 bytes = 12 hex chars) */
  CODE_LENGTH_BYTES: 6,

  /** Display format separator for backup codes (e.g., "abcd-efgh-ijkl") */
  SEPARATOR: '-',

  /** Number of characters per group in display format */
  GROUP_SIZE: 4
} as const;

/**
 * Temporary token configuration for 2FA login flow
 */
export const TEMP_TOKEN_CONFIG = {
  /** Expiry duration in seconds for the temp token issued during 2FA login */
  EXPIRY_SECONDS: 300, // 5 minutes

  /** JWT subject claim for temp tokens to distinguish from regular auth tokens */
  SUBJECT: '2fa-pending',

  /** Length of the JWT expiry string */
  EXPIRY_STRING: '5m'
} as const;

/**
 * System settings keys for storing 2FA state
 * Admin 2FA state is stored in system_settings since
 * the admin user is env-based (not a row in clients table).
 */
export const TWO_FACTOR_SETTINGS_KEYS = {
  /** The encrypted TOTP secret */
  SECRET: 'admin.two_factor_secret',

  /** Whether 2FA is enabled (boolean stored as string) */
  ENABLED: 'admin.two_factor_enabled',

  /** JSON array of hashed backup codes */
  BACKUP_CODES: 'admin.two_factor_backup_codes'
} as const;

/**
 * Rate limiting configuration for 2FA endpoints
 */
export const TWO_FACTOR_RATE_LIMIT = {
  /** Max 2FA verification attempts per window */
  MAX_ATTEMPTS: 5,

  /** Rate limit window in milliseconds (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000
} as const;
