/**
 * ===============================================
 * TOKEN UTILITY FUNCTIONS
 * ===============================================
 * @file server/utils/token-utils.ts
 *
 * Secure token generation utilities for email
 * verification, password resets, and similar flows.
 */

import crypto from 'crypto';
import { EMAIL_VERIFICATION_CONFIG } from './auth-constants.js';

/**
 * Generate a cryptographically secure random hex token.
 * Uses crypto.randomBytes for true randomness.
 * @param byteLength - Number of random bytes (output hex string is 2x this length)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(
  byteLength: number = EMAIL_VERIFICATION_CONFIG.TOKEN_BYTE_LENGTH
): string {
  return crypto.randomBytes(byteLength).toString('hex');
}
