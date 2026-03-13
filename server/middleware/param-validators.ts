/**
 * ===============================================
 * ROUTE PARAMETER VALIDATION MIDDLEWARE
 * ===============================================
 * Reusable middleware for validating URL params like :id, :projectId, etc.
 * Eliminates the repeated parseInt/isNaN/<=0 boilerplate across routes.
 *
 * Usage:
 *   router.get('/:id', requireValidId('id'), asyncHandler(async (req, res) => {
 *     const id = req.validatedParams.id; // guaranteed positive integer
 *   }));
 *
 *   router.get('/projects/:projectId/files', requireValidId('projectId'), ...)
 */

import { Request, Response, NextFunction } from 'express';
import { errorResponse, ErrorCodes } from '../utils/api-response.js';

// Extend Express Request to carry validated params
declare global {
  namespace Express {
    interface Request {
      validatedParams: Record<string, number>;
    }
  }
}

/**
 * Middleware factory that validates a URL param is a positive integer.
 * Stores the parsed value on `req.validatedParams[paramName]`.
 *
 * @param paramName - The route parameter name (e.g., 'id', 'projectId')
 * @param label     - Optional human-readable label for the error message.
 *                    Defaults to paramName formatted as "param name ID".
 */
export function requireValidId(paramName: string, label?: string) {
  const displayLabel = label || formatParamLabel(paramName);

  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.params[paramName];
    const parsed = parseInt(raw, 10);

    if (isNaN(parsed) || parsed <= 0) {
      return errorResponse(res, `Invalid ${displayLabel}`, 400, ErrorCodes.INVALID_ID);
    }

    // Initialize if needed, then store
    if (!req.validatedParams) {
      req.validatedParams = {};
    }
    req.validatedParams[paramName] = parsed;

    next();
  };
}

/**
 * Validates multiple params at once.
 *
 * Usage:
 *   router.get('/:projectId/deliverables/:deliverableId',
 *     requireValidIds(['projectId', 'deliverableId']),
 *     asyncHandler(async (req, res) => { ... })
 *   );
 */
export function requireValidIds(paramNames: string[]) {
  const validators = paramNames.map((name) => requireValidId(name));

  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const runNext = (): void => {
      if (index >= validators.length) {
        return next();
      }
      const validator = validators[index++];
      validator(req, res, runNext);
    };

    runNext();
  };
}

/**
 * Converts 'projectId' → 'project ID', 'id' → 'ID'
 */
function formatParamLabel(paramName: string): string {
  if (paramName === 'id') return 'ID';

  // Convert camelCase to spaced: 'projectId' → 'project Id' → 'project ID'
  return paramName
    .replace(/Id$/, ' ID')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\bid\b/g, 'ID');
}
