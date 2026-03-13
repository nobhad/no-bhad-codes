/**
 * ===============================================
 * VALIDATION — SHARED TYPES
 * ===============================================
 * Interfaces and type definitions used across
 * the validation engine, schemas, and middleware.
 */

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: Record<string, unknown>;
}

export type ValidationRule = {
  type: 'required' | 'email' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'custom';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: unknown) => boolean | string;
  customSanitizer?: (value: unknown) => unknown;
  allowedValues?: unknown[];
  description?: string;
};

export type ValidationSchema = {
  [field: string]: ValidationRule | ValidationRule[];
};
