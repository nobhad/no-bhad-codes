/**
 * ===============================================
 * TWO-FACTOR AUTHENTICATION ROUTES
 * ===============================================
 * @file server/routes/two-factor.ts
 *
 * Endpoints for TOTP-based 2FA setup, verification,
 * login verification, and disabling.
 *
 * All setup/disable endpoints require an authenticated admin.
 * The login endpoint uses a short-lived temp token.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/security.js';
import { auditLogger } from '../services/audit-logger.js';
import { logger } from '../services/logger.js';
import {
  JWT_CONFIG,
  COOKIE_CONFIG,
  PASSWORD_CONFIG
} from '../utils/auth-constants.js';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
  ErrorCodes
} from '../utils/api-response.js';
import {
  generateTOTPSecret,
  verifyTOTP,
  buildProvisioningURI,
  generateBackupCodes
} from '../utils/totp.js';
import {
  TOTP_CONFIG,
  TEMP_TOKEN_CONFIG,
  TWO_FACTOR_SETTINGS_KEYS,
  TWO_FACTOR_RATE_LIMIT
} from '../utils/two-factor-constants.js';
import type { JWTAuthRequest } from '../types/request.js';

const router = express.Router();

// ============================================
// HELPERS
// ============================================

/**
 * Retrieve a system_settings value by key.
 */
async function getSettingValue(key: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.get(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [key]
  );
  if (!row) return null;
  return (row as { setting_value: string }).setting_value;
}

/**
 * Upsert a system_settings value.
 */
async function upsertSetting(
  key: string,
  value: string,
  settingType: string,
  description: string,
  isSensitive: boolean
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT OR REPLACE INTO system_settings
       (setting_key, setting_value, setting_type, description, is_sensitive, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [key, value, settingType, description, isSensitive ? 1 : 0]
  );
}

/**
 * Check if the requesting user is the admin (id === 0, type === 'admin').
 */
function isAdmin(req: JWTAuthRequest): boolean {
  return req.user?.type === 'admin' && req.user?.id === 0;
}

/**
 * Normalize a backup code for consistent hashing/comparison.
 * Strips hyphens and lowercases so the user can enter with or without formatting.
 */
function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/-/g, '');
}

/**
 * Hash a backup code for storage.
 * Always normalizes first so comparison is format-independent.
 */
async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeBackupCode(code), PASSWORD_CONFIG.SALT_ROUNDS);
}

/**
 * Check whether 2FA is currently enabled for the admin.
 */
async function isTwoFactorEnabled(): Promise<boolean> {
  const value = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.ENABLED);
  return value === 'true';
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /auth/2fa/setup
 * Generate a TOTP secret and provisioning URI for the admin.
 * Does NOT enable 2FA yet -- that requires verification.
 */
router.post(
  '/setup',
  authenticateToken,
  asyncHandler(async (req: JWTAuthRequest, res: express.Response) => {
    if (!isAdmin(req)) {
      return sendUnauthorized(res, 'Admin access required', ErrorCodes.ACCESS_DENIED);
    }

    // Prevent re-setup if already enabled
    const enabled = await isTwoFactorEnabled();
    if (enabled) {
      return sendBadRequest(
        res,
        'Two-factor authentication is already enabled. Disable it first to reconfigure.',
        ErrorCodes.TWO_FACTOR_ALREADY_ENABLED
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    // Generate and store the secret (not yet enabled)
    const secret = generateTOTPSecret();
    const provisioningURI = buildProvisioningURI(adminEmail, secret);

    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.SECRET,
      secret,
      'string',
      'Base32-encoded TOTP secret for admin 2FA',
      true
    );

    await auditLogger.log({
      action: '2fa_setup_initiated',
      entityType: 'session',
      entityId: '0',
      entityName: adminEmail,
      userId: 0,
      userEmail: adminEmail,
      userType: 'admin',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    return sendSuccess(
      res,
      {
        secret,
        provisioningURI,
        algorithm: TOTP_CONFIG.ALGORITHM,
        digits: TOTP_CONFIG.CODE_DIGITS,
        period: TOTP_CONFIG.TIME_STEP_SECONDS
      },
      'Two-factor setup initiated. Scan the QR code and verify with a code.'
    );
  })
);

/**
 * POST /auth/2fa/verify
 * Verify a TOTP code to enable 2FA. Generates backup codes on success.
 */
router.post(
  '/verify',
  authenticateToken,
  rateLimit({
    windowMs: TWO_FACTOR_RATE_LIMIT.WINDOW_MS,
    maxRequests: TWO_FACTOR_RATE_LIMIT.MAX_ATTEMPTS,
    message: 'Too many 2FA verification attempts. Please try again later.',
    keyGenerator: (req) => `2fa-verify:${req.ip}`
  }),
  asyncHandler(async (req: JWTAuthRequest, res: express.Response) => {
    if (!isAdmin(req)) {
      return sendUnauthorized(res, 'Admin access required', ErrorCodes.ACCESS_DENIED);
    }

    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return sendBadRequest(res, 'TOTP code is required', ErrorCodes.MISSING_FIELDS);
    }

    const enabled = await isTwoFactorEnabled();
    if (enabled) {
      return sendBadRequest(
        res,
        'Two-factor authentication is already enabled.',
        ErrorCodes.TWO_FACTOR_ALREADY_ENABLED
      );
    }

    // Retrieve the pending secret
    const secret = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.SECRET);
    if (!secret) {
      return sendBadRequest(
        res,
        'No 2FA setup in progress. Call /auth/2fa/setup first.',
        ErrorCodes.TWO_FACTOR_SETUP_REQUIRED
      );
    }

    // Verify the TOTP code
    const isValid = verifyTOTP(secret, code);
    if (!isValid) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin';
      await auditLogger.logLoginFailed(adminEmail, req, '2FA verification failed during setup');
      return sendBadRequest(
        res,
        'Invalid verification code. Please try again.',
        ErrorCodes.TWO_FACTOR_INVALID_CODE
      );
    }

    // Enable 2FA
    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.ENABLED,
      'true',
      'boolean',
      'Whether TOTP two-factor authentication is enabled for admin',
      false
    );

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.BACKUP_CODES,
      JSON.stringify(hashedCodes),
      'json',
      'JSON array of hashed single-use backup codes for admin 2FA',
      true
    );

    const adminEmail = process.env.ADMIN_EMAIL || 'admin';
    await auditLogger.log({
      action: '2fa_enabled',
      entityType: 'session',
      entityId: '0',
      entityName: adminEmail,
      userId: 0,
      userEmail: adminEmail,
      userType: 'admin',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    return sendSuccess(
      res,
      { backupCodes },
      'Two-factor authentication enabled. Save your backup codes securely -- they will not be shown again.'
    );
  })
);

/**
 * POST /auth/2fa/login
 * Complete the 2FA step during admin login.
 * Accepts a short-lived temp token + TOTP code (or backup code).
 */
router.post(
  '/login',
  rateLimit({
    windowMs: TWO_FACTOR_RATE_LIMIT.WINDOW_MS,
    maxRequests: TWO_FACTOR_RATE_LIMIT.MAX_ATTEMPTS,
    message: 'Too many 2FA login attempts. Please try again later.',
    keyGenerator: (req) => `2fa-login:${req.ip}`
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { tempToken, code } = req.body as { tempToken?: string; code?: string };

    if (!tempToken || !code) {
      return sendBadRequest(
        res,
        'Temporary token and verification code are required',
        ErrorCodes.MISSING_FIELDS
      );
    }

    // Verify the temp token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    let tempPayload: { email: string; sub: string };
    try {
      tempPayload = jwt.verify(tempToken, jwtSecret) as { email: string; sub: string };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return sendUnauthorized(
          res,
          'Two-factor verification session has expired. Please log in again.',
          ErrorCodes.TWO_FACTOR_TEMP_TOKEN_EXPIRED
        );
      }
      return sendUnauthorized(
        res,
        'Invalid verification session. Please log in again.',
        ErrorCodes.INVALID_TOKEN
      );
    }

    // Ensure this is a 2FA temp token
    if (tempPayload.sub !== TEMP_TOKEN_CONFIG.SUBJECT) {
      return sendUnauthorized(
        res,
        'Invalid verification session.',
        ErrorCodes.INVALID_TOKEN
      );
    }

    // Retrieve the secret
    const secret = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.SECRET);
    if (!secret) {
      return sendServerError(
        res,
        'Two-factor configuration error',
        ErrorCodes.CONFIG_ERROR
      );
    }

    // Try TOTP verification first
    let codeValid = verifyTOTP(secret, code);

    // If TOTP failed, try backup codes
    let usedBackupCode = false;
    if (!codeValid) {
      const backupCodesJson = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.BACKUP_CODES);
      if (backupCodesJson) {
        const hashedCodes: string[] = JSON.parse(backupCodesJson);
        const normalizedInput = normalizeBackupCode(code);

        for (let i = 0; i < hashedCodes.length; i++) {
          const matches = await bcrypt.compare(normalizedInput, hashedCodes[i]);
          if (matches) {
            codeValid = true;
            usedBackupCode = true;
            // Remove the used backup code
            hashedCodes.splice(i, 1);
            await upsertSetting(
              TWO_FACTOR_SETTINGS_KEYS.BACKUP_CODES,
              JSON.stringify(hashedCodes),
              'json',
              'JSON array of hashed single-use backup codes for admin 2FA',
              true
            );
            break;
          }
        }
      }
    }

    if (!codeValid) {
      await auditLogger.logLoginFailed(
        tempPayload.email,
        req,
        '2FA login verification failed'
      );
      return sendUnauthorized(
        res,
        'Invalid verification code.',
        ErrorCodes.TWO_FACTOR_INVALID_CODE
      );
    }

    // Issue the real admin JWT
    const adminEmail = tempPayload.email;
    const token = jwt.sign(
      { id: 0, email: adminEmail, type: 'admin' },
      jwtSecret,
      { expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY } as SignOptions
    );

    await auditLogger.logLogin(0, adminEmail, 'admin', req);
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.ADMIN_OPTIONS);

    const logAction = usedBackupCode ? '2fa_login_backup_code' : '2fa_login_success';
    await auditLogger.log({
      action: logAction,
      entityType: 'session',
      entityId: '0',
      entityName: adminEmail,
      userId: 0,
      userEmail: adminEmail,
      userType: 'admin',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    return sendSuccess(
      res,
      {
        user: {
          id: 0,
          email: adminEmail,
          name: 'Admin',
          isAdmin: true,
          role: 'admin'
        },
        expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY,
        usedBackupCode
      },
      'Admin login successful'
    );
  })
);

/**
 * POST /auth/2fa/disable
 * Disable 2FA for the admin. Requires current TOTP code for confirmation.
 */
router.post(
  '/disable',
  authenticateToken,
  rateLimit({
    windowMs: TWO_FACTOR_RATE_LIMIT.WINDOW_MS,
    maxRequests: TWO_FACTOR_RATE_LIMIT.MAX_ATTEMPTS,
    message: 'Too many attempts. Please try again later.',
    keyGenerator: (req) => `2fa-disable:${req.ip}`
  }),
  asyncHandler(async (req: JWTAuthRequest, res: express.Response) => {
    if (!isAdmin(req)) {
      return sendUnauthorized(res, 'Admin access required', ErrorCodes.ACCESS_DENIED);
    }

    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return sendBadRequest(res, 'Current TOTP code is required to disable 2FA', ErrorCodes.MISSING_FIELDS);
    }

    const enabled = await isTwoFactorEnabled();
    if (!enabled) {
      return sendBadRequest(
        res,
        'Two-factor authentication is not currently enabled.',
        ErrorCodes.TWO_FACTOR_NOT_ENABLED
      );
    }

    const secret = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.SECRET);
    if (!secret) {
      return sendServerError(res, 'Two-factor configuration error', ErrorCodes.CONFIG_ERROR);
    }

    const isValid = verifyTOTP(secret, code);
    if (!isValid) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin';
      await auditLogger.logLoginFailed(adminEmail, req, '2FA disable verification failed');
      return sendBadRequest(
        res,
        'Invalid verification code.',
        ErrorCodes.TWO_FACTOR_INVALID_CODE
      );
    }

    // Disable 2FA and clear stored data
    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.ENABLED,
      'false',
      'boolean',
      'Whether TOTP two-factor authentication is enabled for admin',
      false
    );
    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.SECRET,
      '',
      'string',
      'Base32-encoded TOTP secret for admin 2FA',
      true
    );
    await upsertSetting(
      TWO_FACTOR_SETTINGS_KEYS.BACKUP_CODES,
      '[]',
      'json',
      'JSON array of hashed single-use backup codes for admin 2FA',
      true
    );

    const adminEmail = process.env.ADMIN_EMAIL || 'admin';
    await auditLogger.log({
      action: '2fa_disabled',
      entityType: 'session',
      entityId: '0',
      entityName: adminEmail,
      userId: 0,
      userEmail: adminEmail,
      userType: 'admin',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    await logger.info('Two-factor authentication disabled for admin', { category: 'AUTH' });

    return sendSuccess(res, undefined, 'Two-factor authentication has been disabled.');
  })
);

/**
 * GET /auth/2fa/status
 * Check whether 2FA is enabled for the admin account.
 */
router.get(
  '/status',
  authenticateToken,
  asyncHandler(async (req: JWTAuthRequest, res: express.Response) => {
    if (!isAdmin(req)) {
      return sendUnauthorized(res, 'Admin access required', ErrorCodes.ACCESS_DENIED);
    }

    const enabled = await isTwoFactorEnabled();

    // Count remaining backup codes
    let remainingBackupCodes = 0;
    if (enabled) {
      const backupCodesJson = await getSettingValue(TWO_FACTOR_SETTINGS_KEYS.BACKUP_CODES);
      if (backupCodesJson) {
        const codes: string[] = JSON.parse(backupCodesJson);
        remainingBackupCodes = codes.length;
      }
    }

    return sendSuccess(res, {
      enabled,
      remainingBackupCodes
    });
  })
);

export { router as twoFactorRouter };
export default router;
