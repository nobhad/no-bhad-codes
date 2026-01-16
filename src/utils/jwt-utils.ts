/**
 * ===============================================
 * JWT UTILITIES
 * ===============================================
 * @file src/utils/jwt-utils.ts
 *
 * Centralized JWT token handling utilities.
 * Provides consistent token decoding and validation.
 */

/**
 * JWT payload structure (common fields)
 */
export interface JwtPayload {
  exp?: number;      // Expiration timestamp (seconds since epoch)
  iat?: number;      // Issued at timestamp
  sub?: string;      // Subject (user ID)
  isAdmin?: boolean; // Admin flag
  type?: string;     // User type ('admin', 'client', etc.)
  [key: string]: unknown; // Allow additional custom claims
}

/**
 * Decode a JWT token's payload
 * @param token - The JWT token string
 * @returns The decoded payload or null if invalid
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired
 * @param token - The JWT token string
 * @returns true if expired or invalid, false if still valid
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    return true;
  }
  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 <= Date.now();
}

/**
 * Check if a JWT payload indicates an admin user
 * @param payload - The decoded JWT payload
 * @returns true if user is admin
 */
export function isAdminPayload(payload: JwtPayload): boolean {
  return payload.isAdmin === true || payload.type === 'admin';
}

/**
 * Check if a JWT token belongs to an admin user
 * @param token - The JWT token string
 * @returns true if token is valid and user is admin
 */
export function isAdminToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return false;
  }
  return isAdminPayload(payload);
}

/**
 * Get the remaining time until token expiration
 * @param token - The JWT token string
 * @returns Milliseconds until expiration, or 0 if expired/invalid
 */
export function getTokenTimeRemaining(token: string): number {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    return 0;
  }
  const remaining = payload.exp * 1000 - Date.now();
  return Math.max(0, remaining);
}

/**
 * Validate and decode a JWT token in one call
 * @param token - The JWT token string
 * @returns Object with validity and payload, or null payload if invalid
 */
export function validateToken(token: string): {
  valid: boolean;
  expired: boolean;
  payload: JwtPayload | null;
} {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { valid: false, expired: true, payload: null };
  }
  const expired = payload.exp ? payload.exp * 1000 <= Date.now() : false;
  return { valid: !expired, expired, payload };
}
