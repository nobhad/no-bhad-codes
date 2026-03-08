/**
 * ===============================================
 * TOTP (RFC 6238) IMPLEMENTATION
 * ===============================================
 * @file server/utils/totp.ts
 *
 * Pure Node.js crypto-based TOTP implementation.
 * No external OTP libraries required.
 *
 * References:
 * - RFC 6238: TOTP (Time-Based One-Time Password)
 * - RFC 4226: HOTP (HMAC-Based One-Time Password)
 */

import crypto from 'crypto';
import {
  TOTP_CONFIG,
  BACKUP_CODE_CONFIG
} from './two-factor-constants.js';

/**
 * Base32 character set (RFC 4648)
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Buffer to a Base32 string (RFC 4648).
 * Used for encoding the TOTP secret for provisioning URIs.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let encoded = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5);
    if (chunk.length < 5) {
      // Pad remaining bits with zeros
      const padded = chunk.padEnd(5, '0');
      encoded += BASE32_CHARS[parseInt(padded, 2)];
    } else {
      encoded += BASE32_CHARS[parseInt(chunk, 2)];
    }
  }

  return encoded;
}

/**
 * Decode a Base32 string back to a Buffer (RFC 4648).
 * Used for decoding the stored TOTP secret for verification.
 */
export function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[=\s]/g, '').toUpperCase();
  let bits = '';

  for (const char of cleaned) {
    const index = BASE32_CHARS.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    bits += index.toString(2).padStart(5, '0');
  }

  // Convert bits to bytes (truncate any trailing incomplete byte)
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure TOTP secret.
 * Returns the secret as a Base32-encoded string.
 */
export function generateTOTPSecret(): string {
  const secretBuffer = crypto.randomBytes(TOTP_CONFIG.SECRET_LENGTH_BYTES);
  return base32Encode(secretBuffer);
}

/**
 * Generate an HMAC-based OTP value for a given counter (RFC 4226).
 * This is the core HOTP algorithm used by TOTP.
 */
function generateHOTP(secret: Buffer, counter: bigint): string {
  // Convert counter to 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  // Compute HMAC-SHA1
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226, Section 5.4)
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  // Truncate to the configured number of digits
  const otp = binary % Math.pow(10, TOTP_CONFIG.CODE_DIGITS);

  return otp.toString().padStart(TOTP_CONFIG.CODE_DIGITS, '0');
}

/**
 * Generate the current TOTP code for a given secret.
 * Optionally accepts a timestamp for testing.
 */
export function generateTOTP(base32Secret: string, timestampMs?: number): string {
  const secret = base32Decode(base32Secret);
  const now = timestampMs !== undefined ? timestampMs : Date.now();
  const counter = BigInt(Math.floor(now / 1000 / TOTP_CONFIG.TIME_STEP_SECONDS));

  return generateHOTP(secret, counter);
}

/**
 * Verify a TOTP code against a secret, allowing for clock drift.
 * Checks the current time step and +/- WINDOW steps.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyTOTP(base32Secret: string, code: string, timestampMs?: number): boolean {
  if (!code || code.length !== TOTP_CONFIG.CODE_DIGITS) {
    return false;
  }

  const secret = base32Decode(base32Secret);
  const now = timestampMs !== undefined ? timestampMs : Date.now();
  const currentCounter = BigInt(Math.floor(now / 1000 / TOTP_CONFIG.TIME_STEP_SECONDS));

  // Check current step and surrounding window for clock drift tolerance
  for (let i = -TOTP_CONFIG.WINDOW; i <= TOTP_CONFIG.WINDOW; i++) {
    const counter = currentCounter + BigInt(i);
    const expected = generateHOTP(secret, counter);

    // Constant-time comparison to prevent timing attacks
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Build a provisioning URI for QR code generation.
 * Format: otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm={algo}&digits={digits}&period={period}
 */
export function buildProvisioningURI(
  accountEmail: string,
  base32Secret: string
): string {
  const issuer = encodeURIComponent(TOTP_CONFIG.ISSUER);
  const account = encodeURIComponent(accountEmail);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer: TOTP_CONFIG.ISSUER,
    algorithm: TOTP_CONFIG.ALGORITHM,
    digits: TOTP_CONFIG.CODE_DIGITS.toString(),
    period: TOTP_CONFIG.TIME_STEP_SECONDS.toString()
  });

  return `otpauth://totp/${issuer}:${account}?${params.toString()}`;
}

/**
 * Generate a set of single-use backup codes.
 * Returns the codes in human-readable format (e.g., "a1b2-c3d4-e5f6").
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_CONFIG.COUNT; i++) {
    const rawHex = crypto.randomBytes(BACKUP_CODE_CONFIG.CODE_LENGTH_BYTES).toString('hex');

    // Format into groups for readability
    const groups: string[] = [];
    for (let j = 0; j < rawHex.length; j += BACKUP_CODE_CONFIG.GROUP_SIZE) {
      groups.push(rawHex.substring(j, j + BACKUP_CODE_CONFIG.GROUP_SIZE));
    }

    codes.push(groups.join(BACKUP_CODE_CONFIG.SEPARATOR));
  }

  return codes;
}
