/**
 * ===============================================
 * AUTHENTICATION MIDDLEWARE
 * ===============================================
 * JWT token verification and user authentication
 * Supports both HttpOnly cookies and Authorization header
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import {
  COOKIE_CONFIG,
  JWT_CONFIG,
  TOKEN_ROTATION,
  parseExpiryToSeconds
} from '../utils/auth-constants.js';
import { errorResponse } from '../utils/api-response.js';
import { logger } from '../services/logger.js';
import type { JWTAuthRequest } from '../types/request.js';

/** JWT payload structure for user authentication tokens */
interface JWTPayload {
  id?: number;
  clientId?: number;
  email: string;
  type: 'admin' | 'client';
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export const authenticateToken = (req: JWTAuthRequest, res: Response, next: NextFunction) => {
  // Try Authorization header first (for API consumers), then HttpOnly cookie
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const cookieToken = req.cookies?.[COOKIE_CONFIG.AUTH_TOKEN_NAME];

  const token = headerToken || cookieToken;

  if (!token) {
    return errorResponse(res, 'Access token required', 401, 'TOKEN_MISSING');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('JWT_SECRET not configured');
    return errorResponse(res, 'Server configuration error', 500, 'CONFIG_ERROR');
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    const userId = decoded.id ?? decoded.clientId;
    if (userId === undefined) {
      return errorResponse(res, 'Invalid token: missing user ID', 403, 'TOKEN_INVALID');
    }
    req.user = {
      id: userId,
      email: decoded.email,
      type: decoded.type
    };

    // Silent token rotation: if the token has passed the rotation threshold
    // of its total lifetime, issue a fresh token with the same payload.
    // Only rotate cookie-based tokens (not Authorization header tokens).
    if (cookieToken && decoded.iat && decoded.exp) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const totalLifetime = decoded.exp - decoded.iat;
      const elapsed = nowSeconds - decoded.iat;

      if (totalLifetime > 0 && elapsed / totalLifetime >= TOKEN_ROTATION.THRESHOLD) {
        const isAdmin = decoded.type === 'admin';
        const expiry = isAdmin ? JWT_CONFIG.ADMIN_TOKEN_EXPIRY : JWT_CONFIG.USER_TOKEN_EXPIRY;
        const cookieOptions = isAdmin ? COOKIE_CONFIG.ADMIN_OPTIONS : COOKIE_CONFIG.USER_OPTIONS;

        // Build the same payload shape used at login (omit iat/exp -- jwt.sign sets them)
        const refreshedPayload: Record<string, unknown> = {
          id: userId,
          email: decoded.email,
          type: decoded.type
        };
        if (decoded.isAdmin !== undefined) {
          refreshedPayload.isAdmin = decoded.isAdmin;
        }

        // Convert the expiry string to seconds for a clean numeric value;
        // fall back to the raw string with a cast (matching existing codebase pattern).
        const expirySeconds = parseExpiryToSeconds(expiry);
        const signOptions = (
          expirySeconds !== undefined
            ? { expiresIn: expirySeconds }
            : { expiresIn: expiry }
        ) as SignOptions;

        const rotatedToken = jwt.sign(refreshedPayload, secret, signOptions);
        res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, rotatedToken, cookieOptions);
      }
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse(res, 'Invalid token', 403, 'TOKEN_INVALID');
    }

    logger.error('Token verification error', { error: error instanceof Error ? error : undefined });
    return errorResponse(res, 'Token verification failed', 403, 'TOKEN_ERROR');
  }
};

export const requireAdmin = (req: JWTAuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.type !== 'admin') {
    return errorResponse(res, 'Admin access required', 403, 'ADMIN_REQUIRED');
  }

  next();
};

export const requireClient = (req: JWTAuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.type !== 'client') {
    return errorResponse(res, 'Client access required', 403, 'CLIENT_REQUIRED');
  }

  next();
};

// Re-export for backward compatibility - use JWTAuthRequest from types/request.ts for new code
export type { JWTAuthRequest as AuthenticatedRequest };
