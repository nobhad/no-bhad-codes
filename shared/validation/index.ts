/**
 * ===============================================
 * SHARED VALIDATION MODULE
 * ===============================================
 * @file shared/validation/index.ts
 *
 * Central export point for validation patterns, validators, and schemas.
 * This module is shared between client and server.
 */

// Export all patterns
export {
  VALIDATION_PATTERNS,
  PATTERN_DESCRIPTIONS,
  type ValidationPatternKey
} from './patterns';

// Export all validators
export {
  // Result types
  type ValidationResult,
  type FieldValidationResult,
  type FormValidationResult,

  // Core validators
  validatePattern,
  validateWithPattern,
  validateRequired,
  validateLength,
  validateRange,
  validateAllowedValues,

  // Type-specific validators
  validateEmail,
  validatePhone,
  validatePassword,
  validateName,
  validateUrl,
  validateDate,
  validateMessageContent,

  // Security validators
  checkSqlInjection,
  checkXss,
  checkPathTraversal,

  // Sanitization functions
  escapeHtml,
  sanitizeHtml,
  stripHtmlTags,
  escapeHtmlAttribute,
  sanitizeUrl,

  // Array validators
  validateArray,

  // Composite validators
  validateAll,
  validateField
} from './validators';

// Export schemas and schema utilities
export {
  // Schema types
  type FieldRule,
  type FieldSchema,
  type FormSchema,

  // Schema validation
  validateSchema,

  // Rule factories
  required,
  email,
  phone,
  password,
  name,
  stringLength,
  allowedValues,
  messageContent,
  url,
  date,
  numberRange,
  array,
  custom,

  // Pre-defined schemas
  contactFormSchema,
  clientIntakeSchema,
  userRegistrationSchema,
  adminLoginSchema,
  clientLoginSchema,
  messageSendSchema,
  projectUpdateSchema,
  leadStatusSchema,
  fileUploadSchema,
  paginationSchema
} from './schemas';
