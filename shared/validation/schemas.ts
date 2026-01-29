/**
 * ===============================================
 * VALIDATION SCHEMAS
 * ===============================================
 * @file shared/validation/schemas.ts
 *
 * Pre-defined validation schemas for common forms and data structures.
 */

import {
  validateRequired,
  validateEmail,
  validatePhone,
  validatePassword,
  validateName,
  validateLength,
  validateAllowedValues,
  validateMessageContent,
  validateUrl,
  validateDate,
  validateRange,
  validateArray,
  type ValidationResult,
  type FormValidationResult
} from './validators';

// ============================================
// Schema Types
// ============================================

export type FieldRule = (value: unknown, allValues?: Record<string, unknown>) => ValidationResult;

export interface FieldSchema {
  rules: FieldRule[];
  optional?: boolean;
}

export type FormSchema = Record<string, FieldSchema>;

// ============================================
// Schema Validation Runner
// ============================================

/**
 * Validate data against a schema
 */
export function validateSchema(
  data: Record<string, unknown>,
  schema: FormSchema
): FormValidationResult {
  const errors: Array<{ field: string; error: string }> = [];
  const sanitizedData: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = data[fieldName];

    // Skip optional fields that are empty
    if (fieldSchema.optional && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Run each rule
    for (const rule of fieldSchema.rules) {
      const result = rule(value, data);
      if (!result.isValid) {
        errors.push({
          field: fieldName,
          error: result.error || `${fieldName} is invalid`
        });
        break; // Stop at first error for this field
      }
      if (result.sanitizedValue !== undefined) {
        sanitizedData[fieldName] = result.sanitizedValue;
      }
    }

    // If no sanitized value yet, use original
    if (sanitizedData[fieldName] === undefined && value !== undefined) {
      sanitizedData[fieldName] = value;
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.map(e => ({
      isValid: false,
      field: e.field,
      error: e.error
    })),
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  };
}

// ============================================
// Rule Factories
// ============================================

/**
 * Create a required rule
 */
export function required(fieldDisplayName?: string): FieldRule {
  return (value) => validateRequired(value, fieldDisplayName);
}

/**
 * Create an email validation rule
 */
export function email(options?: { strict?: boolean; allowDisposable?: boolean }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Email must be a string' };
    }
    return validateEmail(value, options);
  };
}

/**
 * Create a phone validation rule
 */
export function phone(options?: { format?: 'e164' | 'us' | 'generic' }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Phone must be a string' };
    }
    return validatePhone(value, options);
  };
}

/**
 * Create a password validation rule
 */
export function password(options?: { strength?: 'basic' | 'medium' | 'strong' }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Password must be a string' };
    }
    return validatePassword(value, options);
  };
}

/**
 * Create a name validation rule
 */
export function name(options?: { type?: 'person' | 'single' | 'company'; minLength?: number; maxLength?: number }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Name must be a string' };
    }
    return validateName(value, options);
  };
}

/**
 * Create a string length rule
 */
export function stringLength(options: { min?: number; max?: number; exact?: number }, fieldDisplayName?: string): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: `${fieldDisplayName || 'Value'} must be a string` };
    }
    return validateLength(value, options, fieldDisplayName);
  };
}

/**
 * Create an allowed values rule
 */
export function allowedValues<T>(values: readonly T[], fieldDisplayName?: string): FieldRule {
  return (value) => validateAllowedValues(value as T, values, fieldDisplayName);
}

/**
 * Create a message content rule
 */
export function messageContent(options?: { minLength?: number; maxLength?: number; checkSpam?: boolean }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Message must be a string' };
    }
    return validateMessageContent(value, options);
  };
}

/**
 * Create a URL validation rule
 */
export function url(options?: { requireHttps?: boolean; allowAnyProtocol?: boolean }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'URL must be a string' };
    }
    return validateUrl(value, options);
  };
}

/**
 * Create a date validation rule
 */
export function date(options?: { format?: 'iso' | 'datetime'; minDate?: Date; maxDate?: Date }): FieldRule {
  return (value) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Date must be a string' };
    }
    return validateDate(value, options);
  };
}

/**
 * Create a number range rule
 */
export function numberRange(options: { min?: number; max?: number }, fieldDisplayName?: string): FieldRule {
  return (value) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) {
      return { isValid: false, error: `${fieldDisplayName || 'Value'} must be a number` };
    }
    return validateRange(num, options, fieldDisplayName);
  };
}

/**
 * Create an array validation rule
 */
export function array<T>(options?: { minLength?: number; maxLength?: number; itemValidator?: (item: T) => ValidationResult }, fieldDisplayName?: string): FieldRule {
  return (value) => {
    if (!Array.isArray(value)) {
      return { isValid: false, error: `${fieldDisplayName || 'Value'} must be an array` };
    }
    return validateArray(value, options || {}, fieldDisplayName);
  };
}

/**
 * Create a custom validation rule
 */
export function custom(validator: (value: unknown, allValues?: Record<string, unknown>) => boolean | string): FieldRule {
  return (value, allValues) => {
    const result = validator(value, allValues);
    if (result === true) {
      return { isValid: true, sanitizedValue: value };
    }
    return {
      isValid: false,
      error: typeof result === 'string' ? result : 'Validation failed'
    };
  };
}

// ============================================
// Pre-defined Schemas
// ============================================

/**
 * Contact form schema
 */
export const contactFormSchema: FormSchema = {
  name: {
    rules: [required('Name'), name({ type: 'person' })],
    optional: false
  },
  firstName: {
    rules: [name({ type: 'single', minLength: 1, maxLength: 50 })],
    optional: true
  },
  lastName: {
    rules: [name({ type: 'single', minLength: 1, maxLength: 50 })],
    optional: true
  },
  email: {
    rules: [required('Email'), email()],
    optional: false
  },
  subject: {
    rules: [stringLength({ max: 200 }, 'Subject')],
    optional: true
  },
  inquiryType: {
    rules: [stringLength({ max: 200 }, 'Inquiry type')],
    optional: true
  },
  companyName: {
    rules: [name({ type: 'company' })],
    optional: true
  },
  message: {
    rules: [required('Message'), messageContent({ minLength: 10, maxLength: 5000 })],
    optional: false
  }
};

/**
 * Client intake form schema
 */
export const clientIntakeSchema: FormSchema = {
  name: {
    rules: [required('Name'), name({ type: 'person', minLength: 2, maxLength: 100 })],
    optional: false
  },
  email: {
    rules: [required('Email'), email()],
    optional: false
  },
  companyName: {
    rules: [name({ type: 'company' })],
    optional: true
  },
  phone: {
    rules: [phone({ format: 'generic' })],
    optional: true
  },
  projectType: {
    rules: [
      required('Project type'),
      allowedValues([
        'simple-site',
        'business-site',
        'portfolio',
        'e-commerce',
        'web-app',
        'browser-extension',
        'other'
      ], 'Project type')
    ],
    optional: false
  },
  budgetRange: {
    rules: [
      required('Budget range'),
      allowedValues([
        'under-2k',
        '2k-5k',
        '5k-10k',
        '10k-plus',
        'discuss'
      ], 'Budget range')
    ],
    optional: false
  },
  timeline: {
    rules: [
      required('Timeline'),
      allowedValues([
        'asap',
        '1-3-months',
        '3-6-months',
        'flexible'
      ], 'Timeline')
    ],
    optional: false
  },
  description: {
    rules: [
      required('Project description'),
      messageContent({ minLength: 20, maxLength: 2000, checkSpam: true })
    ],
    optional: false
  },
  features: {
    rules: [
      array<string>({
        maxLength: 20,
        itemValidator: (item) => {
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
          if (!validFeatures.includes(item)) {
            return { isValid: false, error: `Invalid feature: ${item}` };
          }
          return { isValid: true };
        }
      }, 'Features')
    ],
    optional: true
  }
};

/**
 * User registration schema
 */
export const userRegistrationSchema: FormSchema = {
  name: {
    rules: [required('Name'), name({ type: 'person', minLength: 2, maxLength: 100 })],
    optional: false
  },
  email: {
    rules: [required('Email'), email({ strict: true })],
    optional: false
  },
  password: {
    rules: [required('Password'), password({ strength: 'strong' })],
    optional: false
  },
  confirmPassword: {
    rules: [
      required('Password confirmation'),
      custom((value, allValues) => {
        if (value !== allValues?.password) {
          return 'Passwords do not match';
        }
        return true;
      })
    ],
    optional: false
  }
};

/**
 * Admin login schema
 */
export const adminLoginSchema: FormSchema = {
  password: {
    rules: [required('Password'), stringLength({ min: 1 }, 'Password')],
    optional: false
  }
};

/**
 * Client login schema
 */
export const clientLoginSchema: FormSchema = {
  email: {
    rules: [required('Email'), email()],
    optional: false
  },
  password: {
    rules: [required('Password'), stringLength({ min: 1 }, 'Password')],
    optional: false
  }
};

/**
 * Message send schema
 */
export const messageSendSchema: FormSchema = {
  message: {
    rules: [required('Message'), messageContent({ minLength: 1, maxLength: 10000, checkSpam: false })],
    optional: false
  }
};

/**
 * Project update schema
 */
export const projectUpdateSchema: FormSchema = {
  name: {
    rules: [stringLength({ min: 1, max: 200 }, 'Project name')],
    optional: true
  },
  status: {
    rules: [
      allowedValues([
        'planning',
        'in-progress',
        'in_progress', // Legacy support
        'review',
        'completed',
        'on-hold',
        'on_hold' // Legacy support
      ], 'Status')
    ],
    optional: true
  },
  description: {
    rules: [stringLength({ max: 5000 }, 'Description')],
    optional: true
  },
  progress: {
    rules: [numberRange({ min: 0, max: 100 }, 'Progress')],
    optional: true
  }
};

/**
 * Lead status update schema
 */
export const leadStatusSchema: FormSchema = {
  status: {
    rules: [
      required('Status'),
      allowedValues([
        'new',
        'contacted',
        'qualified',
        'converted',
        'lost',
        'pending',
        'active',
        'in-progress',
        'in_progress', // Legacy support
        'on-hold',
        'on_hold', // Legacy support
        'completed',
        'cancelled'
      ], 'Status')
    ],
    optional: false
  },
  notes: {
    rules: [stringLength({ max: 2000 }, 'Notes')],
    optional: true
  }
};

/**
 * File upload schema
 */
export const fileUploadSchema: FormSchema = {
  filename: {
    rules: [
      required('Filename'),
      stringLength({ max: 255 }, 'Filename'),
      custom((value) => {
        if (typeof value !== 'string') return false;
        // Check for path traversal
        if (value.includes('..') || value.includes('/') || value.includes('\\')) {
          return 'Invalid filename';
        }
        // Check for safe characters
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
          return 'Filename contains invalid characters';
        }
        return true;
      })
    ],
    optional: false
  },
  fileType: {
    rules: [
      required('File type'),
      allowedValues([
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain'
      ], 'File type')
    ],
    optional: false
  },
  fileSize: {
    rules: [
      required('File size'),
      numberRange({ min: 1, max: 10 * 1024 * 1024 }, 'File size') // 10MB max
    ],
    optional: false
  }
};

/**
 * Pagination query schema
 */
export const paginationSchema: FormSchema = {
  page: {
    rules: [numberRange({ min: 1, max: 1000 }, 'Page')],
    optional: true
  },
  limit: {
    rules: [numberRange({ min: 1, max: 100 }, 'Limit')],
    optional: true
  },
  sortBy: {
    rules: [stringLength({ max: 50 }, 'Sort field')],
    optional: true
  },
  sortOrder: {
    rules: [allowedValues(['asc', 'desc'], 'Sort order')],
    optional: true
  },
  search: {
    rules: [stringLength({ max: 200 }, 'Search')],
    optional: true
  }
};
