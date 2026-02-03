/**
 * ===============================================
 * REQUEST ID MIDDLEWARE
 * ===============================================
 * @file server/middleware/request-id.ts
 *
 * Adds X-Request-ID to all requests for tracing and correlation.
 * Uses incoming header if provided, otherwise generates a new UUID.
 * Echoes the ID in response headers for client-side correlation.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.get(REQUEST_ID_HEADER);
  const id = incomingId && incomingId.trim() ? incomingId.trim() : crypto.randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
