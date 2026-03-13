/**
 * ===============================================
 * VALIDATION — ENGINE
 * ===============================================
 * Core ApiValidator class that validates data against schemas.
 * Handles type-specific validation, sanitization, and custom validators.
 */

import { logger } from '../../services/logger.js';
import { VALIDATION_PATTERNS } from '../../../shared/validation/patterns.js';
import type { ValidationError, ValidationRule, ValidationSchema, ValidationResult } from './types.js';

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
        logger.warn(`Custom sanitizer failed for ${field}`, {
          error: error instanceof Error ? error : undefined
        });
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

    const sanitized = value.trim();

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

    // NOTE: HTML/XSS sanitization is handled by the global sanitizeInputs middleware.
    // Do NOT apply sanitizeHtml here — it HTML-encodes characters like & ' / which
    // corrupts passwords and causes double-encoding for display fields (React/EJS
    // handle output escaping).

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
    _rule: ValidationRule,
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
    _rule: ValidationRule,
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
    _rule: ValidationRule,
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
