/**
 * ===============================================
 * TYPED APPLICATION ERRORS
 * ===============================================
 * @file server/utils/app-errors.ts
 *
 * Small hierarchy of named errors that carry their HTTP status + code
 * so the central errorHandler doesn't have to string-match message
 * text to figure out the right response.
 *
 * Pattern:
 *   throw new NotFoundError('client', id);
 *   throw new AuthorizationError();
 *   throw new ValidationError('email is required');
 *   throw new ConflictError('invoice already paid');
 *   throw new RateLimitedError();
 *
 * errorHandler recognises any `instanceof AppError` and lifts its
 * statusCode / code / message directly into the response. Everything
 * else falls through to the legacy string-based mappings (still there
 * for SQLite constraint errors, which don't go through this hierarchy).
 */

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  /**
   * Optional machine-readable details object included in the response
   * body under `details`. Useful for validation errors that want to
   * expose a field list; don't put PII or stack traces here.
   */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Keep the native stack and make instanceof work after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'RESOURCE_NOT_FOUND';

  constructor(entity: string, id?: string | number, details?: Record<string, unknown>) {
    const label = id !== undefined ? `${entity} ${id}` : entity;
    super(`${label} not found`, details);
  }
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'ACCESS_DENIED';

  constructor(message = 'Access denied', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message = 'Invalid request', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';

  constructor(message = 'Conflicts with current state', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class RateLimitedError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';

  constructor(message = 'Too many requests', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';

  constructor(message = 'Service temporarily unavailable', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
