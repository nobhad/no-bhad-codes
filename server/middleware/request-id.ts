/**
 * ===============================================
 * REQUEST ID + CONTEXT MIDDLEWARE
 * ===============================================
 * @file server/middleware/request-id.ts
 *
 * Adds X-Request-ID to all requests for tracing and correlation, and
 * opens an AsyncLocalStorage scope so every function downstream —
 * logger, services, handlers — can read requestId / userId / traceId
 * without the caller passing them through.
 *
 * Must run before any middleware that emits logs or needs attribution.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { trace } from '@opentelemetry/api';
import { runWithRequestContext } from '../observability/request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.get(REQUEST_ID_HEADER);
  const id = incomingId && incomingId.trim() ? incomingId.trim() : crypto.randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  // Snapshot whatever OTel has at request entry — auto-instrumented
  // HTTP spans are usually active by now thanks to the HTTP
  // instrumentation that ran upstream. Populated if present.
  const activeSpan = trace.getActiveSpan();
  const spanCtx = activeSpan?.spanContext();

  runWithRequestContext(
    {
      requestId: id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      traceId: spanCtx?.traceId,
      spanId: spanCtx?.spanId,
      userId: null,
      userType: null
    },
    () => next()
  );
}
