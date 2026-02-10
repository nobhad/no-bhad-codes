/**
 * ===============================================
 * VALIDATION SERVICE
 * ===============================================
 * @file server/services/validation-service.ts
 *
 * Comprehensive input validation for emails, phones,
 * URLs, and XSS/injection prevention.
 */

// Validation result type
export interface ValidationResult {
  valid: boolean;
  value: string;
  errors: string[];
  sanitized?: string;
}

// File validation result
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  mimeType?: string;
  extension?: string;
  sizeBytes?: number;
}

// Allowed file types configuration
export const ALLOWED_FILE_TYPES = {
  images: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  },
  documents: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv']
  },
  archives: {
    mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
    extensions: ['.zip', '.rar', '.7z']
  }
};

// Max file sizes (in bytes)
export const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024,      // 10MB
  document: 25 * 1024 * 1024,   // 25MB
  archive: 50 * 1024 * 1024,    // 50MB
  default: 10 * 1024 * 1024     // 10MB
};

// Email validation regex (RFC 5322 compliant, simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone validation regex (international format)
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

// URL validation regex
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

// XSS patterns to detect
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<meta/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /<!--/gi,
  /-->/gi
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|FETCH|DECLARE|OPEN)\b)/gi,
  /(--|;|\/\*|\*\/|@@|@|char\(|nchar\(|varchar\(|nvarchar\(|cast\(|convert\()/gi,
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
  /'\s*(OR|AND)\s+'[^']*'\s*=\s*'[^']*/gi
];

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, value: email, errors: ['Email is required'] };
  }

  if (trimmed.length > 254) {
    errors.push('Email address is too long (max 254 characters)');
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    errors.push('Invalid email format');
  }

  // Check for suspicious patterns
  if (trimmed.includes('..')) {
    errors.push('Email contains invalid consecutive dots');
  }

  // Check local part length
  const [localPart, domain] = trimmed.split('@');
  if (localPart && localPart.length > 64) {
    errors.push('Email local part is too long (max 64 characters)');
  }

  // Basic domain validation
  if (domain) {
    const domainParts = domain.split('.');
    if (domainParts.some(part => part.length > 63)) {
      errors.push('Email domain part is too long');
    }
    if (domainParts.length < 2) {
      errors.push('Email domain is invalid');
    }
  }

  return {
    valid: errors.length === 0,
    value: email,
    errors,
    sanitized: trimmed
  };
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];

  if (!phone) {
    return { valid: true, value: '', errors: [], sanitized: '' };
  }

  const trimmed = phone.trim();

  // Remove common formatting characters for validation
  const digitsOnly = trimmed.replace(/[\s\-.()+]/g, '');

  if (digitsOnly.length < 7) {
    errors.push('Phone number is too short (minimum 7 digits)');
  }

  if (digitsOnly.length > 15) {
    errors.push('Phone number is too long (maximum 15 digits)');
  }

  if (!/^\d+$/.test(digitsOnly)) {
    errors.push('Phone number contains invalid characters');
  }

  if (!PHONE_REGEX.test(trimmed)) {
    errors.push('Invalid phone number format');
  }

  // Sanitized format: +X-XXX-XXX-XXXX
  let sanitized = digitsOnly;
  if (digitsOnly.length === 10) {
    sanitized = `+1-${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    sanitized = `+${digitsOnly.slice(0, 1)}-${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  return {
    valid: errors.length === 0,
    value: phone,
    errors,
    sanitized
  };
}

/**
 * Validate URL
 */
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url) {
    return { valid: true, value: '', errors: [], sanitized: '' };
  }

  const trimmed = url.trim();

  // Add protocol if missing
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);

    // Check for valid protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }

    // Check for localhost in production
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      errors.push('Localhost URLs are not allowed');
    }

    // Check for IP address (optional - uncomment to block)
    // if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) {
    //   errors.push('IP addresses are not allowed');
    // }

  } catch {
    errors.push('Invalid URL format');
  }

  if (!URL_REGEX.test(normalized) && errors.length === 0) {
    errors.push('URL format is invalid');
  }

  return {
    valid: errors.length === 0,
    value: url,
    errors,
    sanitized: normalized
  };
}

/**
 * Sanitize text to prevent XSS
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // HTML entity encode special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * Check for XSS patterns in text
 */
export function detectXSS(input: string): { detected: boolean; patterns: string[] } {
  if (!input) return { detected: false, patterns: [] };

  const detectedPatterns: string[] = [];

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
      pattern.lastIndex = 0; // Reset regex
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  };
}

/**
 * Check for SQL injection patterns
 */
export function detectSQLInjection(input: string): { detected: boolean; patterns: string[] } {
  if (!input) return { detected: false, patterns: [] };

  const detectedPatterns: string[] = [];

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
      pattern.lastIndex = 0; // Reset regex
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  };
}

/**
 * Comprehensive input sanitization
 */
export function sanitizeInput(input: string, options: {
  allowHtml?: boolean;
  maxLength?: number;
  trim?: boolean;
} = {}): { value: string; wasModified: boolean; warnings: string[] } {
  const { allowHtml = false, maxLength = 10000, trim = true } = options;
  const warnings: string[] = [];
  let value = input;
  let wasModified = false;

  // Trim whitespace
  if (trim && value !== value.trim()) {
    value = value.trim();
    wasModified = true;
  }

  // Check and truncate length
  if (value.length > maxLength) {
    value = value.substring(0, maxLength);
    wasModified = true;
    warnings.push(`Input truncated to ${maxLength} characters`);
  }

  // Check for XSS
  const xssCheck = detectXSS(value);
  if (xssCheck.detected) {
    warnings.push('Potentially malicious content detected');
    if (!allowHtml) {
      value = sanitizeText(value);
      wasModified = true;
    }
  }

  // Check for SQL injection
  const sqlCheck = detectSQLInjection(value);
  if (sqlCheck.detected) {
    warnings.push('Potentially malicious SQL patterns detected');
  }

  // Remove null bytes
  if (value.includes('\0')) {
    value = value.replace(/\0/g, '');
    wasModified = true;
    warnings.push('Null bytes removed');
  }

  // Normalize unicode
  if (value !== value.normalize('NFC')) {
    value = value.normalize('NFC');
    wasModified = true;
  }

  return { value, wasModified, warnings };
}

/**
 * Validate file upload
 */
export function validateFile(
  filename: string,
  mimeType: string,
  sizeBytes: number,
  allowedCategories: ('images' | 'documents' | 'archives')[] = ['images', 'documents']
): FileValidationResult {
  const errors: string[] = [];

  // Get file extension
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  // Collect allowed types
  const allowedMimeTypes: string[] = [];
  const allowedExtensions: string[] = [];
  let maxSize = MAX_FILE_SIZES.default;

  for (const category of allowedCategories) {
    const config = ALLOWED_FILE_TYPES[category];
    allowedMimeTypes.push(...config.mimeTypes);
    allowedExtensions.push(...config.extensions);

    // Use largest max size from allowed categories
    const categoryMaxSize = category === 'archives'
      ? MAX_FILE_SIZES.archive
      : category === 'documents'
        ? MAX_FILE_SIZES.document
        : MAX_FILE_SIZES.image;
    maxSize = Math.max(maxSize, categoryMaxSize);
  }

  // Validate extension
  if (!allowedExtensions.includes(extension)) {
    errors.push(`File extension "${extension}" is not allowed. Allowed: ${allowedExtensions.join(', ')}`);
  }

  // Validate MIME type
  if (!allowedMimeTypes.includes(mimeType)) {
    errors.push(`File type "${mimeType}" is not allowed`);
  }

  // Validate size
  if (sizeBytes > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const actualSizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    errors.push(`File size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`);
  }

  // Check for dangerous patterns in filename
  if (/[<>:"/\\|?*\x00-\x1f]/.test(filename)) {
    errors.push('Filename contains invalid characters');
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename contains path traversal characters');
  }

  // Check for executable extensions disguised
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.vbs', '.ps1'];
  for (const dangerous of dangerousExtensions) {
    if (filename.toLowerCase().includes(dangerous)) {
      errors.push('Filename contains potentially dangerous extension');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    mimeType,
    extension,
    sizeBytes
  };
}

/**
 * Validate a complete form/object
 */
export function validateObject(
  data: Record<string, unknown>,
  schema: Record<string, {
    type: 'email' | 'phone' | 'url' | 'text' | 'number' | 'boolean';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
  }>
): { valid: boolean; errors: Record<string, string[]>; sanitized: Record<string, unknown> } {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, unknown> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors: string[] = [];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field} is required`);
      errors[field] = fieldErrors;
      continue;
    }

    if (value === undefined || value === null || value === '') {
      sanitized[field] = value;
      continue;
    }

    // Type-specific validation
    switch (rules.type) {
      case 'email': {
        const result = validateEmail(String(value));
        if (!result.valid) fieldErrors.push(...result.errors);
        sanitized[field] = result.sanitized;
        break;
      }
      case 'phone': {
        const result = validatePhone(String(value));
        if (!result.valid) fieldErrors.push(...result.errors);
        sanitized[field] = result.sanitized;
        break;
      }
      case 'url': {
        const result = validateUrl(String(value));
        if (!result.valid) fieldErrors.push(...result.errors);
        sanitized[field] = result.sanitized;
        break;
      }
      case 'text': {
        const strValue = String(value);
        const sanitizeResult = sanitizeInput(strValue, { maxLength: rules.maxLength });
        if (rules.minLength && strValue.length < rules.minLength) {
          fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && strValue.length > rules.maxLength) {
          fieldErrors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(strValue)) {
          fieldErrors.push(`${field} format is invalid`);
        }
        sanitized[field] = sanitizeResult.value;
        break;
      }
      case 'number': {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          fieldErrors.push(`${field} must be a number`);
        } else {
          if (rules.min !== undefined && numValue < rules.min) {
            fieldErrors.push(`${field} must be at least ${rules.min}`);
          }
          if (rules.max !== undefined && numValue > rules.max) {
            fieldErrors.push(`${field} must be at most ${rules.max}`);
          }
          sanitized[field] = numValue;
        }
        break;
      }
      case 'boolean': {
        sanitized[field] = Boolean(value);
        break;
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized
  };
}

export default {
  validateEmail,
  validatePhone,
  validateUrl,
  sanitizeText,
  sanitizeInput,
  detectXSS,
  detectSQLInjection,
  validateFile,
  validateObject,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES
};
