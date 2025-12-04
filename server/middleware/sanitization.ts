/**
 * ===============================================
 * INPUT SANITIZATION MIDDLEWARE
 * ===============================================
 * @file server/middleware/sanitization.ts
 *
 * Global input sanitization to prevent XSS and script injection
 * attacks across all API endpoints.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize a string to prevent XSS attacks
 * Encodes HTML entities to prevent script injection
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Recursively sanitize all string values in an object or array
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't sanitize certain fields that might need special handling
      // (e.g., password hashes, tokens that shouldn't be modified)
      const skipFields = ['password', 'password_hash', 'token', 'accessToken', 'refreshToken'];
      if (skipFields.includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  // Return primitives (numbers, booleans) as-is
  return obj;
}

/**
 * Express middleware to sanitize request body, query params, and URL params
 * Apply this middleware before route handlers to ensure all inputs are sanitized
 */
export function sanitizeInputs(
  options: {
    sanitizeBody?: boolean;
    sanitizeQuery?: boolean;
    sanitizeParams?: boolean;
    skipPaths?: string[];
  } = {}
) {
  const {
    sanitizeBody = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    skipPaths = [],
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip sanitization for certain paths if needed
      if (skipPaths.some((path) => req.path.includes(path))) {
        return next();
      }

      // Sanitize request body
      if (sanitizeBody && req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (sanitizeQuery && req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (sanitizeParams && req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      console.error('Sanitization middleware error:', error);
      // Don't block the request on sanitization error, but log it
      next();
    }
  };
}

/**
 * Sanitize a single value (can be used directly in route handlers)
 */
export function sanitize(value: any): any {
  return sanitizeObject(value);
}

/**
 * Strip dangerous patterns that could be used for injection attacks
 * More aggressive sanitization for high-risk fields
 */
export function stripDangerousPatterns(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  return (
    input
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: URLs
      .replace(/javascript:/gi, '')
      // Remove data: URLs that could contain scripts
      .replace(/data:\s*text\/html/gi, '')
      // Remove vbscript: URLs
      .replace(/vbscript:/gi, '')
      // Remove expression() CSS
      .replace(/expression\s*\(/gi, '')
      // Then apply standard sanitization
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  );
}

export default sanitizeInputs;
