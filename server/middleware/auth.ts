/**
 * ===============================================
 * AUTHENTICATION MIDDLEWARE
 * ===============================================
 * JWT token verification and user authentication
 * Supports both HttpOnly cookies and Authorization header
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { COOKIE_CONFIG } from '../utils/auth-constants.js';
import { errorResponse } from '../utils/api-response.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    type: 'client' | 'admin';
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    console.error('JWT_SECRET not configured');
    return errorResponse(res, 'Server configuration error', 500, 'CONFIG_ERROR');
  }

  try {
    const decoded = jwt.verify(token, secret) as any;
    req.user = {
      id: decoded.id || decoded.clientId, // Support both id and clientId from tokens
      email: decoded.email,
      type: decoded.type
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse(res, 'Invalid token', 403, 'TOKEN_INVALID');
    }

    console.error('Token verification error:', error);
    return errorResponse(res, 'Token verification failed', 403, 'TOKEN_ERROR');
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.type !== 'admin') {
    return errorResponse(res, 'Admin access required', 403, 'ADMIN_REQUIRED');
  }

  next();
};

export const requireClient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.type !== 'client') {
    return errorResponse(res, 'Client access required', 403, 'CLIENT_REQUIRED');
  }

  next();
};

export type { AuthenticatedRequest };
