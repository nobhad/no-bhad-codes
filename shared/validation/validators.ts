/**
 * ===============================================
 * VALIDATION FUNCTIONS
 * ===============================================
 * @file shared/validation/validators.ts
 *
 * Reusable validation functions shared between client and server.
 */

import { VALIDATION_PATTERNS, PATTERN_DESCRIPTIONS, type ValidationPatternKey } from './patterns';

// ============================================
// Validation Result Types
// ============================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: unknown;
}

export interface FieldValidationResult extends ValidationResult {
  field: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: FieldValidationResult[];
  sanitizedData?: Record<string, unknown>;
}

// ============================================
// Core Validators
// ============================================

/**
 * Validate a value against a regex pattern
 */
export function validatePattern(
  value: string,
  pattern: RegExp,
  errorMessage?: string
): ValidationResult {
  if (!pattern.test(value)) {
    return {
      isValid: false,
      error: errorMessage || 'Invalid format'
    };
  }
  return { isValid: true, sanitizedValue: value };
}

/**
 * Validate using a named pattern
 */
export function validateWithPattern(
  value: string,
  patternKey: ValidationPatternKey,
  customError?: string
): ValidationResult {
  const pattern = VALIDATION_PATTERNS[patternKey];
  const description = PATTERN_DESCRIPTIONS[patternKey];
  return validatePattern(
    value,
    pattern,
    customError || `Must be ${description}`
  );
}

/**
 * Validate required field
 */
export function validateRequired(
  value: unknown,
  fieldName: string = 'Field'
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }
  if (typeof value === 'string' && VALIDATION_PATTERNS.WHITESPACE_ONLY.test(value)) {
    return {
      isValid: false,
      error: `${fieldName} cannot be empty`
    };
  }
  return { isValid: true, sanitizedValue: value };
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  options: { min?: number; max?: number; exact?: number },
  fieldName: string = 'Field'
): ValidationResult {
  const length = value.length;

  if (options.exact !== undefined && length !== options.exact) {
    return {
      isValid: false,
      error: `${fieldName} must be exactly ${options.exact} characters`
    };
  }

  if (options.min !== undefined && length < options.min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${options.min} characters`
    };
  }

  if (options.max !== undefined && length > options.max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${options.max} characters`
    };
  }

  return { isValid: true, sanitizedValue: value };
}

/**
 * Validate numeric range
 */
export function validateRange(
  value: number,
  options: { min?: number; max?: number },
  fieldName: string = 'Value'
): ValidationResult {
  if (options.min !== undefined && value < options.min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${options.min}`
    };
  }

  if (options.max !== undefined && value > options.max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${options.max}`
    };
  }

  return { isValid: true, sanitizedValue: value };
}

/**
 * Validate value is in allowed list
 */
export function validateAllowedValues<T>(
  value: T,
  allowedValues: readonly T[],
  fieldName: string = 'Value'
): ValidationResult {
  if (!allowedValues.includes(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}`
    };
  }
  return { isValid: true, sanitizedValue: value };
}

// ============================================
// Type-Specific Validators
// ============================================

/**
 * Validate email address
 */
export function validateEmail(
  email: string,
  options: { strict?: boolean; allowDisposable?: boolean } = {}
): ValidationResult {
  const trimmed = email.trim().toLowerCase();

  // Basic format check
  const pattern = options.strict
    ? VALIDATION_PATTERNS.EMAIL_STRICT
    : VALIDATION_PATTERNS.EMAIL;

  if (!pattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address'
    };
  }

  // Length check
  if (trimmed.length > 254) {
    return {
      isValid: false,
      error: 'Email address is too long'
    };
  }

  // Disposable email check
  if (!options.allowDisposable) {
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
      'temp-mail.org',
      'fakeinbox.com',
      'trashmail.com'
    ];

    const domain = trimmed.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return {
        isValid: false,
        error: 'Temporary email addresses are not allowed'
      };
    }
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate phone number
 */
export function validatePhone(
  phone: string,
  options: { format?: 'e164' | 'us' | 'generic' } = {}
): ValidationResult {
  const trimmed = phone.trim().replace(/\s+/g, '');
  const format = options.format || 'generic';

  const patterns = {
    e164: VALIDATION_PATTERNS.PHONE_E164,
    us: VALIDATION_PATTERNS.PHONE_US,
    generic: VALIDATION_PATTERNS.PHONE_GENERIC
  };

  if (!patterns[format].test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid phone number'
    };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  options: { strength?: 'basic' | 'medium' | 'strong' } = {}
): ValidationResult {
  const strength = options.strength || 'strong';

  const patterns = {
    basic: VALIDATION_PATTERNS.PASSWORD_BASIC,
    medium: VALIDATION_PATTERNS.PASSWORD_MEDIUM,
    strong: VALIDATION_PATTERNS.PASSWORD_STRONG
  };

  const descriptions = {
    basic: 'at least 8 characters',
    medium: 'at least 8 characters with letters and numbers',
    strong: 'at least 12 characters with uppercase, lowercase, number, and special character'
  };

  if (!patterns[strength].test(password)) {
    return {
      isValid: false,
      error: `Password must be ${descriptions[strength]}`
    };
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password123',
    '123456789012',
    'qwertyuiop',
    'admin12345'
  ];

  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    return {
      isValid: false,
      error: 'Password is too common, please choose a stronger one'
    };
  }

  return { isValid: true, sanitizedValue: password };
}

/**
 * Validate name (person or company)
 */
export function validateName(
  name: string,
  options: { type?: 'person' | 'single' | 'company'; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const trimmed = name.trim();
  const type = options.type || 'person';
  const minLength = options.minLength || (type === 'company' ? 1 : 2);
  const maxLength = options.maxLength || (type === 'company' ? 200 : 100);

  // Length check
  const lengthResult = validateLength(trimmed, { min: minLength, max: maxLength }, 'Name');
  if (!lengthResult.isValid) {
    return lengthResult;
  }

  // Pattern check
  const patterns = {
    person: VALIDATION_PATTERNS.NAME,
    single: VALIDATION_PATTERNS.NAME_SINGLE,
    company: VALIDATION_PATTERNS.COMPANY_NAME
  };

  if (!patterns[type].test(trimmed)) {
    return {
      isValid: false,
      error: 'Name contains invalid characters'
    };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate URL
 */
export function validateUrl(
  url: string,
  options: { requireHttps?: boolean; allowAnyProtocol?: boolean } = {}
): ValidationResult {
  const trimmed = url.trim();

  if (options.allowAnyProtocol) {
    if (!VALIDATION_PATTERNS.URL_ANY.test(trimmed)) {
      return {
        isValid: false,
        error: 'Please enter a valid URL'
      };
    }
  } else {
    if (!VALIDATION_PATTERNS.URL_HTTP.test(trimmed)) {
      return {
        isValid: false,
        error: 'Please enter a valid HTTP/HTTPS URL'
      };
    }

    if (options.requireHttps && !trimmed.startsWith('https://')) {
      return {
        isValid: false,
        error: 'URL must use HTTPS'
      };
    }
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate date string
 */
export function validateDate(
  dateStr: string,
  options: { format?: 'iso' | 'datetime'; minDate?: Date; maxDate?: Date } = {}
): ValidationResult {
  const format = options.format || 'iso';

  const pattern = format === 'datetime'
    ? VALIDATION_PATTERNS.DATETIME_ISO
    : VALIDATION_PATTERNS.DATE_ISO;

  if (!pattern.test(dateStr)) {
    return {
      isValid: false,
      error: format === 'datetime'
        ? 'Please enter a valid datetime (YYYY-MM-DDTHH:mm:ss)'
        : 'Please enter a valid date (YYYY-MM-DD)'
    };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: 'Invalid date value'
    };
  }

  if (options.minDate && date < options.minDate) {
    return {
      isValid: false,
      error: `Date must be after ${options.minDate.toISOString().split('T')[0]}`
    };
  }

  if (options.maxDate && date > options.maxDate) {
    return {
      isValid: false,
      error: `Date must be before ${options.maxDate.toISOString().split('T')[0]}`
    };
  }

  return { isValid: true, sanitizedValue: dateStr };
}

// ============================================
// Security Validators
// ============================================

/**
 * Check for SQL injection patterns
 */
export function checkSqlInjection(value: string): ValidationResult {
  if (VALIDATION_PATTERNS.SQL_INJECTION.test(value)) {
    return {
      isValid: false,
      error: 'Input contains potentially dangerous characters'
    };
  }
  return { isValid: true, sanitizedValue: value };
}

/**
 * Check for XSS patterns
 */
export function checkXss(value: string): ValidationResult {
  if (VALIDATION_PATTERNS.XSS_DETECTION.test(value)) {
    return {
      isValid: false,
      error: 'Input contains potentially malicious content'
    };
  }
  return { isValid: true, sanitizedValue: value };
}

/**
 * Check for path traversal
 */
export function checkPathTraversal(value: string): ValidationResult {
  if (VALIDATION_PATTERNS.PATH_TRAVERSAL.test(value)) {
    return {
      isValid: false,
      error: 'Invalid path'
    };
  }
  return { isValid: true, sanitizedValue: value };
}

/**
 * Validate message content (for forms)
 */
export function validateMessageContent(
  message: string,
  options: { minLength?: number; maxLength?: number; checkSpam?: boolean } = {}
): ValidationResult {
  const trimmed = message.trim();
  const minLength = options.minLength || 10;
  const maxLength = options.maxLength || 5000;

  // Length check
  const lengthResult = validateLength(trimmed, { min: minLength, max: maxLength }, 'Message');
  if (!lengthResult.isValid) {
    return lengthResult;
  }

  // XSS check
  const xssResult = checkXss(trimmed);
  if (!xssResult.isValid) {
    return xssResult;
  }

  // Spam check
  if (options.checkSpam !== false) {
    if (VALIDATION_PATTERNS.SPAM_PATTERNS.test(trimmed)) {
      return {
        isValid: false,
        error: 'Message appears to contain spam content'
      };
    }

    // Check for excessive URLs
    const urlMatches = trimmed.match(/https?:\/\//gi);
    if (urlMatches && urlMatches.length > 3) {
      return {
        isValid: false,
        error: 'Message contains too many links'
      };
    }
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ============================================
// Array Validators
// ============================================

/**
 * Validate array
 */
export function validateArray<T>(
  value: T[],
  options: { minLength?: number; maxLength?: number; itemValidator?: (item: T) => ValidationResult },
  fieldName: string = 'Array'
): ValidationResult {
  if (!Array.isArray(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be an array`
    };
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    return {
      isValid: false,
      error: `${fieldName} must have at least ${options.minLength} items`
    };
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must have at most ${options.maxLength} items`
    };
  }

  if (options.itemValidator) {
    for (let i = 0; i < value.length; i++) {
      const itemResult = options.itemValidator(value[i]);
      if (!itemResult.isValid) {
        return {
          isValid: false,
          error: `${fieldName}[${i}]: ${itemResult.error}`
        };
      }
    }
  }

  return { isValid: true, sanitizedValue: value };
}

// ============================================
// Composite Validators
// ============================================

/**
 * Run multiple validators and return first error
 */
export function validateAll(
  ...results: ValidationResult[]
): ValidationResult {
  for (const result of results) {
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true };
}

/**
 * Validate a field with multiple rules
 */
export function validateField(
  value: unknown,
  fieldName: string,
  rules: Array<(value: unknown) => ValidationResult>
): FieldValidationResult {
  for (const rule of rules) {
    const result = rule(value);
    if (!result.isValid) {
      return {
        isValid: false,
        field: fieldName,
        error: result.error
      };
    }
  }
  return {
    isValid: true,
    field: fieldName,
    sanitizedValue: value
  };
}
