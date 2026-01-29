/**
 * ===============================================
 * API VALIDATION MIDDLEWARE
 * ===============================================
 * @file server/middleware/validation.ts
 *
 * Comprehensive API validation middleware for all endpoints.
 * Provides request validation, sanitization, and error handling.
 * Uses shared validation patterns from /shared/validation.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';
import { VALIDATION_PATTERNS } from '../../shared/validation/patterns.js';

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: Record<string, unknown>;
}

// Validation rule types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationRule = {
  type: 'required' | 'email' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'custom';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  // Using any for customValidator to allow strongly-typed validators from calling code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customValidator?: (value: any) => boolean | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customSanitizer?: (value: any) => unknown;
  allowedValues?: unknown[];
  description?: string;
};

// Schema definition
export type ValidationSchema = {
  [field: string]: ValidationRule | ValidationRule[];
};

/**
 * Core validation engine
 */
export class ApiValidator {
  private static instance: ApiValidator;

  public static getInstance(): ApiValidator {
    if (!ApiValidator.instance) {
      ApiValidator.instance = new ApiValidator();
    }
    return ApiValidator.instance;
  }

  /**
   * Validate data against schema
   */
  public validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: Record<string, unknown> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const fieldRules = Array.isArray(rules) ? rules : [rules];
      const fieldValue = data[field];

      for (const rule of fieldRules) {
        const fieldValidation = this.validateField(field, fieldValue, rule);

        if (!fieldValidation.isValid) {
          errors.push(...fieldValidation.errors);
        } else if (fieldValidation.sanitizedValue !== undefined) {
          sanitizedData[field] = fieldValidation.sanitizedValue;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate individual field
   */
  private validateField(
    field: string,
    value: unknown,
    rule: ValidationRule
  ): {
    isValid: boolean;
    errors: ValidationError[];
    sanitizedValue?: unknown;
  } {
    const errors: ValidationError[] = [];
    let sanitizedValue = value;

    // Required validation
    if (rule.type === 'required') {
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED'
        });
        return { isValid: false, errors };
      }
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return { isValid: true, errors: [], sanitizedValue: value };
    }

    // Type-specific validation
    switch (rule.type) {
    case 'string':
      sanitizedValue = this.validateString(field, value, rule, errors);
      break;
    case 'number':
      sanitizedValue = this.validateNumber(field, value, rule, errors);
      break;
    case 'boolean':
      sanitizedValue = this.validateBoolean(field, value, rule, errors);
      break;
    case 'email':
      sanitizedValue = this.validateEmail(field, value, rule, errors);
      break;
    case 'array':
      sanitizedValue = this.validateArray(field, value, rule, errors);
      break;
    case 'object':
      sanitizedValue = this.validateObject(field, value, rule, errors);
      break;
    case 'custom':
      sanitizedValue = this.validateCustom(field, value, rule, errors);
      break;
    }

    // Apply custom validator if present (works for all types, not just 'custom')
    if (rule.customValidator && errors.length === 0) {
      try {
        const result = rule.customValidator(sanitizedValue);

        if (result === false) {
          errors.push({
            field,
            message: `${field} failed custom validation`,
            code: 'CUSTOM_VALIDATION_FAILED',
            value
          });
        } else if (typeof result === 'string') {
          errors.push({
            field,
            message: result,
            code: 'CUSTOM_VALIDATION_FAILED',
            value
          });
        }
      } catch (error) {
        errors.push({
          field,
          message: `${field} custom validation error: ${(error as Error).message}`,
          code: 'CUSTOM_VALIDATION_ERROR',
          value
        });
      }
    }

    // Apply custom sanitizer if present
    if (rule.customSanitizer) {
      try {
        sanitizedValue = rule.customSanitizer(sanitizedValue);
      } catch (error) {
        // If sanitizer fails, log but don't fail validation
        console.warn(`Custom sanitizer failed for ${field}:`, error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  private validateString(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): string {
    if (typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string`,
        code: 'INVALID_TYPE',
        value
      });
      return String(value);
    }

    let sanitized = value.trim();

    // Length validation
    if (rule.minLength !== undefined && sanitized.length < rule.minLength) {
      errors.push({
        field,
        message: `${field} must be at least ${rule.minLength} characters`,
        code: 'MIN_LENGTH',
        value
      });
    }

    if (rule.maxLength !== undefined && sanitized.length > rule.maxLength) {
      errors.push({
        field,
        message: `${field} must be at most ${rule.maxLength} characters`,
        code: 'MAX_LENGTH',
        value
      });
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(sanitized)) {
      errors.push({
        field,
        message: `${field} format is invalid`,
        code: 'INVALID_PATTERN',
        value
      });
    }

    // Allowed values
    if (rule.allowedValues && !rule.allowedValues.includes(sanitized)) {
      errors.push({
        field,
        message: `${field} must be one of: ${rule.allowedValues.join(', ')}`,
        code: 'INVALID_VALUE',
        value
      });
    }

    // Sanitize HTML/XSS
    sanitized = this.sanitizeHtml(sanitized);

    return sanitized;
  }

  private validateNumber(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): number {
    const num = Number(value);

    if (isNaN(num)) {
      errors.push({
        field,
        message: `${field} must be a valid number`,
        code: 'INVALID_NUMBER',
        value
      });
      return 0;
    }

    if (rule.min !== undefined && num < rule.min) {
      errors.push({
        field,
        message: `${field} must be at least ${rule.min}`,
        code: 'MIN_VALUE',
        value
      });
    }

    if (rule.max !== undefined && num > rule.max) {
      errors.push({
        field,
        message: `${field} must be at most ${rule.max}`,
        code: 'MAX_VALUE',
        value
      });
    }

    return num;
  }

  private validateBoolean(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    // Convert string representations
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }

    // Convert numbers
    if (typeof value === 'number') {
      return Boolean(value);
    }

    errors.push({
      field,
      message: `${field} must be a boolean value`,
      code: 'INVALID_BOOLEAN',
      value
    });

    return false;
  }

  private validateEmail(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): string {
    if (typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string`,
        code: 'INVALID_TYPE',
        value
      });
      return String(value);
    }

    const email = value.trim().toLowerCase();

    // Use shared email pattern for validation
    if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
      errors.push({
        field,
        message: `${field} must be a valid email address`,
        code: 'INVALID_EMAIL',
        value
      });
      return value;
    }

    // Additional email validation
    if (email.length > 254) {
      errors.push({
        field,
        message: `${field} email address is too long`,
        code: 'EMAIL_TOO_LONG',
        value
      });
    }

    // Check for disposable email domains (basic check)
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email'
    ];

    const domain = email.split('@')[1];
    if (disposableDomains.includes(domain)) {
      errors.push({
        field,
        message: `${field} temporary email addresses are not allowed`,
        code: 'DISPOSABLE_EMAIL',
        value
      });
    }

    return email;
  }

  private validateArray(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): unknown[] {
    if (!Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an array`,
        code: 'INVALID_ARRAY',
        value
      });
      return [];
    }

    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push({
        field,
        message: `${field} must have at least ${rule.minLength} items`,
        code: 'MIN_ARRAY_LENGTH',
        value
      });
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push({
        field,
        message: `${field} must have at most ${rule.maxLength} items`,
        code: 'MAX_ARRAY_LENGTH',
        value
      });
    }

    return value;
  }

  private validateObject(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an object`,
        code: 'INVALID_OBJECT',
        value
      });
      return {};
    }

    return value as Record<string, unknown>;
  }

  private validateCustom(
    field: string,
    value: unknown,
    rule: ValidationRule,
    errors: ValidationError[]
  ): unknown {
    if (!rule.customValidator) {
      return value;
    }

    try {
      const result = rule.customValidator(value);

      if (result === false) {
        errors.push({
          field,
          message: `${field} failed custom validation`,
          code: 'CUSTOM_VALIDATION_FAILED',
          value
        });
      } else if (typeof result === 'string') {
        errors.push({
          field,
          message: result,
          code: 'CUSTOM_VALIDATION_FAILED',
          value
        });
      }

      // Apply custom sanitizer if provided
      if (rule.customSanitizer) {
        return rule.customSanitizer(value);
      }
    } catch (error) {
      const err = error as Error;
      errors.push({
        field,
        message: `${field} custom validation error: ${err.message}`,
        code: 'CUSTOM_VALIDATION_ERROR',
        value
      });
    }

    return value;
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  private sanitizeHtml(input: string): string {
    // Basic HTML entity encoding
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

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
  const checkUnknownFields = (data: Record<string, any>, source: string): ValidationError[] => {
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
        // Check for unknown fields
        unknownFieldErrors.push(...checkUnknownFields(req.body, 'request body'));

        const result = validator.validate(req.body, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          req.body = stripUnknownFields
            ? result.sanitizedData
            : { ...req.body, ...result.sanitizedData };
        }
      }

      // Validate query parameters
      if (validateQuery && req.query) {
        // Check for unknown fields
        unknownFieldErrors.push(...checkUnknownFields(req.query as Record<string, any>, 'query parameters'));

        const result = validator.validate(req.query, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          // Cast sanitizedData to preserve Express types
          Object.assign(req.query, result.sanitizedData);
        }
      }

      // Validate route parameters
      if (validateParams && req.params) {
        // Check for unknown fields
        unknownFieldErrors.push(...checkUnknownFields(req.params, 'route parameters'));

        const result = validator.validate(req.params, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          // Cast sanitizedData to preserve Express types
          Object.assign(req.params, result.sanitizedData);
        }
      }

      // Check for validation errors (including unknown field errors, unless stripping them)
      const allErrors = [
        ...(stripUnknownFields ? [] : unknownFieldErrors),
        ...validationResults.flatMap((result) => result.errors)
      ];

      if (allErrors.length > 0) {
        await logger.error('Request validation failed');

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: allErrors,
          code: 'VALIDATION_ERROR'
        });
      }

      // Log successful validation
      await logger.info('Request validation passed');

      next();
    } catch (_error) {
      await logger.error('Validation middleware error');

      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_SYSTEM_ERROR'
      });
    }
  };
}

/**
 * Common validation schemas
 * Uses shared patterns from /shared/validation/patterns.ts
 */
export const ValidationSchemas = {
  // User registration/login
  user: {
    name: { type: 'string' as const, minLength: 2, maxLength: 100 },
    email: { type: 'email' as const },
    password: {
      type: 'string' as const,
      minLength: 12,
      maxLength: 128,
      pattern: VALIDATION_PATTERNS.PASSWORD_STRONG,
      description:
        'Password must be 12+ characters with at least one uppercase, lowercase, number, and special character'
    }
  },

  // Contact form - accepts both name OR firstName/lastName
  contact: {
    name: { type: 'string' as const, minLength: 2, maxLength: 100 },
    firstName: { type: 'string' as const, minLength: 1, maxLength: 50 },
    lastName: { type: 'string' as const, minLength: 1, maxLength: 50 },
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    subject: { type: 'string' as const, maxLength: 200 },
    inquiryType: { type: 'string' as const, maxLength: 200 },
    companyName: { type: 'string' as const, maxLength: 200 },
    message: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        minLength: 10,
        maxLength: 5000,
        customValidator: (value: string) => {
          // Check for spam patterns using shared pattern
          if (VALIDATION_PATTERNS.SPAM_PATTERNS.test(value)) {
            return 'Message appears to contain spam';
          }
          // Also check for URLs in message
          if (VALIDATION_PATTERNS.URL_HTTP.test(value)) {
            return 'Message appears to contain spam';
          }
          return true;
        }
      }
    ]
  },

  // Client intake
  clientIntake: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 100 }
    ],
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    companyName: { type: 'string' as const, maxLength: 200 },
    projectType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'simple-site',
          'business-site',
          'portfolio',
          'e-commerce',
          'web-app',
          'browser-extension',
          'other'
        ]
      }
    ],
    budgetRange: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['under-2k', '2k-5k', '5k-10k', '10k-plus', 'discuss']
      }
    ],
    timeline: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['asap', '1-3-months', '3-6-months', 'flexible']
      }
    ],
    description: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 20, maxLength: 2000 }
    ],
    features: {
      type: 'array' as const,
      maxLength: 20,
      customValidator: (features: string[]) => {
        const validFeatures = [
          'contact-form',
          'user-auth',
          'payment',
          'cms',
          'analytics',
          'api-integration',
          'e-commerce',
          'blog',
          'gallery',
          'booking'
        ];
        return (
          features.every((feature) => validFeatures.includes(feature)) || 'Invalid feature selected'
        );
      }
    }
  },

  // File upload
  fileUpload: {
    filename: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        pattern: VALIDATION_PATTERNS.FILENAME_SAFE,
        maxLength: 255
      }
    ],
    fileType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'text/plain'
        ]
      }
    ],
    fileSize: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1, max: 10 * 1024 * 1024 } // 10MB max
    ]
  },

  // API pagination
  pagination: {
    page: { type: 'number' as const, min: 1, max: 1000 },
    limit: { type: 'number' as const, min: 1, max: 100 },
    sortBy: { type: 'string' as const, maxLength: 50 },
    sortOrder: { type: 'string' as const, allowedValues: ['asc', 'desc'] },
    search: { type: 'string' as const, maxLength: 200 }
  }
};
