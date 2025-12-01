/**
 * ===============================================
 * API VALIDATION MIDDLEWARE
 * ===============================================
 * @file server/middleware/validation.ts
 *
 * Comprehensive API validation middleware for all endpoints.
 * Provides request validation, sanitization, and error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

// Validation rule types
export type ValidationRule = {
  type: 'required' | 'email' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'custom';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
  customSanitizer?: (value: any) => any;
  allowedValues?: any[];
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
  public validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: any = {};

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
    value: any,
    rule: ValidationRule
  ): {
    isValid: boolean;
    errors: ValidationError[];
    sanitizedValue?: any;
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
    value: any,
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
      return value;
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
    value: any,
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
      return value;
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
    value: any,
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

    return value;
  }

  private validateEmail(
    field: string,
    value: any,
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
      return value;
    }

    const email = value.trim().toLowerCase();
    // Email regex: allows dots, hyphens, plus signs; requires valid TLD
    const emailRegex = /^[a-z0-9]+([._+-]?[a-z0-9]+)*@[a-z0-9]+([.-]?[a-z0-9]+)*(\.[a-z]{2,})+$/;

    if (!emailRegex.test(email)) {
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
    value: any,
    rule: ValidationRule,
    errors: ValidationError[]
  ): any[] {
    if (!Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an array`,
        code: 'INVALID_ARRAY',
        value
      });
      return value;
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
    value: any,
    rule: ValidationRule,
    errors: ValidationError[]
  ): any {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an object`,
        code: 'INVALID_OBJECT',
        value
      });
      return value;
    }

    return value;
  }

  private validateCustom(
    field: string,
    value: any,
    rule: ValidationRule,
    errors: ValidationError[]
  ): any {
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

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResults: ValidationResult[] = [];
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';

      // Validate request body
      if (validateBody && req.body) {
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
        const result = validator.validate(req.query, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          req.query = stripUnknownFields
            ? result.sanitizedData
            : { ...req.query, ...result.sanitizedData };
        }
      }

      // Validate route parameters
      if (validateParams && req.params) {
        const result = validator.validate(req.params, schema);
        validationResults.push(result);

        if (result.isValid && result.sanitizedData) {
          req.params = stripUnknownFields
            ? result.sanitizedData
            : { ...req.params, ...result.sanitizedData };
        }
      }

      // Check for validation errors
      const allErrors = validationResults.flatMap((result) => result.errors);

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
    } catch (error) {
      const err = error as Error;
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
 */
export const ValidationSchemas = {
  // User registration/login
  user: {
    name: { type: 'string' as const, minLength: 2, maxLength: 100 },
    email: { type: 'email' as const },
    password: {
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      description:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },

  // Contact form
  contact: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 100 }
    ],
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    subject: { type: 'string' as const, maxLength: 200 },
    message: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        minLength: 10,
        maxLength: 5000,
        customValidator: (value: string) => {
          // Check for spam patterns
          const spamPatterns = [
            /\b(buy now|click here|limited time|act fast|urgent|winner|congratulations)\b/gi,
            /\b(viagra|casino|loan|mortgage|weight loss|get rich)\b/gi,
            /https?:\/\/[^\s]+/gi // URLs in message
          ];

          return (
            !spamPatterns.some((pattern) => pattern.test(value)) ||
            'Message appears to contain spam'
          );
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
        pattern: /^[a-zA-Z0-9._-]+$/,
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
