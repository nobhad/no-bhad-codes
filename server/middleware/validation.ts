/**
 * ===============================================
 * API VALIDATION MIDDLEWARE — BARREL
 * ===============================================
 * Composes sub-modules and provides the Express middleware.
 *
 * Sub-modules:
 *   validation/types.ts   — Shared type definitions
 *   validation/engine.ts  — ApiValidator class (core validation logic)
 *   validation/schemas.ts — Common validation schemas
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';
import { errorResponseWithPayload } from '../utils/api-response.js';
import { ApiValidator } from './validation/engine.js';
import type { ValidationError, ValidationResult, ValidationSchema } from './validation/types.js';

// Re-export everything for consumers
export type { ValidationError, ValidationResult, ValidationRule, ValidationSchema } from './validation/types.js';
export { ApiValidator } from './validation/engine.js';
export { ValidationSchemas } from './validation/schemas.js';

/**
 * Express middleware factory for validation
 */
export function validateRequest(
  schema: ValidationSchema,
  options: {
    validateBody?: boolean;
    validateQuery?: boolean;
    validateParams?: boolean;
    allowUnknownFields?: boolean;
    stripUnknownFields?: boolean;
  } = {}
) {
  const {
    validateBody = true,
    validateQuery = false,
    validateParams = false,
    allowUnknownFields = false,
    stripUnknownFields = true
  } = options;

  const validator = ApiValidator.getInstance();
  const schemaFields = new Set(Object.keys(schema));

  /**
   * Check for unknown fields in the data
   */
  const checkUnknownFields = (data: Record<string, unknown>, source: string): ValidationError[] => {
    if (allowUnknownFields) return [];

    const unknownFields = Object.keys(data).filter((field) => !schemaFields.has(field));
    return unknownFields.map((field) => ({
      field,
      message: `Unknown field '${field}' in ${source}`,
      code: 'UNKNOWN_FIELD',
      value: data[field]
    }));
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResults: ValidationResult[] = [];
      const unknownFieldErrors: ValidationError[] = [];

      // Validate request body
      if (validateBody && req.body) {
        unknownFieldErrors.push(...checkUnknownFields(req.body, 'request body'));

        const result = validator.validate(req.body, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          if (stripUnknownFields) {
            req.body = result.sanitizedData;
          } else {
            // Apply sanitized data property-by-property to prevent prototype pollution
            for (const key of Object.keys(result.sanitizedData)) {
              if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
              req.body[key] = result.sanitizedData[key];
            }
          }
        }
      }

      // Validate query parameters
      if (validateQuery && req.query) {
        unknownFieldErrors.push(
          ...checkUnknownFields(req.query as Record<string, unknown>, 'query parameters')
        );

        const result = validator.validate(req.query, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          for (const key of Object.keys(result.sanitizedData)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            (req.query as Record<string, unknown>)[key] = result.sanitizedData[key];
          }
        }
      }

      // Validate route parameters
      if (validateParams && req.params) {
        unknownFieldErrors.push(...checkUnknownFields(req.params, 'route parameters'));

        const result = validator.validate(req.params, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          for (const key of Object.keys(result.sanitizedData)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            req.params[key] = String(result.sanitizedData[key]);
          }
        }
      }

      // Check for validation errors (including unknown field errors, unless stripping them)
      const allErrors = [
        ...(stripUnknownFields ? [] : unknownFieldErrors),
        ...validationResults.flatMap((result) => result.errors)
      ];

      if (allErrors.length > 0) {
        await logger.error('Request validation failed');
        return errorResponseWithPayload(res, 'Validation failed', 400, 'VALIDATION_ERROR', {
          details: allErrors
        });
      }

      // Log successful validation
      await logger.info('Request validation passed');

      next();
    } catch (_error) {
      await logger.error('Validation middleware error');
      errorResponseWithPayload(res, 'Internal validation error', 500, 'VALIDATION_SYSTEM_ERROR');
    }
  };
}
