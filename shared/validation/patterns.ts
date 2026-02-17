/**
 * ===============================================
 * VALIDATION PATTERNS
 * ===============================================
 * @file shared/validation/patterns.ts
 *
 * Centralized regex patterns for validation.
 * These patterns are shared between client and server.
 */

/**
 * Validation patterns for common data types
 */
export const VALIDATION_PATTERNS = {
  // ============================================
  // Email Patterns
  // ============================================

  /**
   * Standard email validation
   * - Allows alphanumeric characters
   * - Allows dots, plus signs, hyphens, underscores in local part
   * - Requires valid domain with TLD of 2+ characters
   * - Case insensitive
   */
  EMAIL: /^[a-zA-Z0-9]+(?:[._+-][a-zA-Z0-9]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,

  /**
   * Strict email validation (more restrictive)
   * - No consecutive dots
   * - No leading/trailing dots in local part
   * - TLD must be 2-6 characters
   */
  EMAIL_STRICT: /^[a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,6}$/,

  // ============================================
  // Phone Patterns
  // ============================================

  /**
   * E.164 international phone format
   * - Must start with +
   * - Country code 1-3 digits
   * - Total 7-15 digits
   */
  PHONE_E164: /^\+[1-9]\d{6,14}$/,

  /**
   * US phone number (flexible format)
   * - Allows various formats: (123) 456-7890, 123-456-7890, 1234567890
   * - With or without country code
   */
  PHONE_US: /^(?:\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,

  /**
   * Generic phone number (international)
   * - Allows digits, spaces, hyphens, parentheses
   * - 10-17 characters total
   */
  PHONE_GENERIC: /^[\d\s\-().+]{10,17}$/,

  // ============================================
  // Password Patterns
  // ============================================

  /**
   * Strong password validation
   * - Minimum 12 characters
   * - At least one lowercase letter
   * - At least one uppercase letter
   * - At least one digit
   * - At least one special character
   * - Maximum 128 characters
   */
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:,.<>]{12,128}$/,

  /**
   * Medium password validation
   * - Minimum 8 characters
   * - At least one letter
   * - At least one digit
   */
  PASSWORD_MEDIUM: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:,.<>]{8,128}$/,

  /**
   * Basic password (minimum requirements)
   * - Minimum 8 characters
   * - Any characters allowed
   */
  PASSWORD_BASIC: /^.{8,128}$/,

  // ============================================
  // Name Patterns
  // ============================================

  /**
   * Person name validation
   * - Allows Unicode letters (international names)
   * - Allows spaces, apostrophes, hyphens
   * - 1-100 characters
   */
  NAME: /^[\p{L}\p{M}][\p{L}\p{M}\s'\-]{0,99}$/u,

  /**
   * First/Last name validation (stricter)
   * - Allows Unicode letters
   * - Allows apostrophes, hyphens
   * - No spaces (single name only)
   * - 1-50 characters
   */
  NAME_SINGLE: /^[\p{L}\p{M}][\p{L}\p{M}'\-]{0,49}$/u,

  /**
   * Company name validation
   * - Allows alphanumeric
   * - Allows common punctuation
   * - 1-200 characters
   */
  COMPANY_NAME: /^[\p{L}\p{N}\s.,&'\-()]{1,200}$/u,

  // ============================================
  // Username Patterns
  // ============================================

  /**
   * Username validation
   * - Alphanumeric with underscores and hyphens
   * - Must start with a letter
   * - 3-30 characters
   */
  USERNAME: /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/,

  /**
   * Username with dots (email-style)
   * - Alphanumeric with dots, underscores, hyphens
   * - Must start with a letter
   * - 3-50 characters
   */
  USERNAME_EXTENDED: /^[a-zA-Z][a-zA-Z0-9._-]{2,49}$/,

  // ============================================
  // URL Patterns
  // ============================================

  /**
   * HTTP/HTTPS URL validation
   * - Must start with http:// or https://
   * - Valid domain or IP
   * - Optional port, path, query, fragment
   */
  URL_HTTP: /^https?:\/\/(?:[\w-]+\.)+[\w-]+(?::\d{1,5})?(?:\/[^\s]*)?$/,

  /**
  * Generic URL validation (includes ftp, mailto, etc.)
  * Use for broad URL matching, not strict HTTP/HTTPS
  */
  URL_GENERIC: /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[\w-]+\.)+[\w-]+(?::\d{1,5})?(?:\/[^\s]*)?$/,

  /**
   * Domain name validation
   * - Valid hostname
   * - No protocol
   */
  DOMAIN: /^(?:[\w-]+\.)+[\w-]+$/,

  // ============================================
  // Date/Time Patterns
  // ============================================

  /**
   * ISO 8601 date (YYYY-MM-DD)
   */
  DATE_ISO: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,

  /**
   * ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss)
   */
  DATETIME_ISO: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/,

  /**
   * Time (HH:mm or HH:mm:ss)
   */
  TIME_24H: /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/,

  // ============================================
  // Numeric Patterns
  // ============================================

  /**
   * Integer (positive or negative)
   */
  INTEGER: /^-?\d+$/,

  /**
   * Positive integer
   */
  POSITIVE_INTEGER: /^\d+$/,

  /**
   * Decimal number
   */
  DECIMAL: /^-?\d+(?:\.\d+)?$/,

  /**
   * Currency amount (2 decimal places)
   */
  CURRENCY: /^\d+(?:\.\d{1,2})?$/,

  /**
   * Percentage (0-100 with optional decimals)
   */
  PERCENTAGE: /^(?:100(?:\.0{1,2})?|[1-9]?\d(?:\.\d{1,2})?)$/,

  // ============================================
  // ID/Code Patterns
  // ============================================

  /**
   * UUID v4 validation
   */
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  /**
   * Alphanumeric code (for tokens, IDs)
   */
  ALPHANUMERIC_CODE: /^[a-zA-Z0-9]+$/,

  /**
   * Hex color code
   */
  HEX_COLOR: /^#(?:[0-9a-fA-F]{3}){1,2}$/,

  /**
   * Slug (URL-friendly string)
   */
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  // ============================================
  // File Patterns
  // ============================================

  /**
   * Safe filename (no path traversal)
   */
  FILENAME_SAFE: /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/,

  /**
   * File extension
   */
  FILE_EXTENSION: /^\.[a-zA-Z0-9]{1,10}$/,

  /**
   * Image file extension
   */
  IMAGE_EXTENSION: /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i,

  /**
   * Document file extension
   */
  DOCUMENT_EXTENSION: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|odt|ods|odp)$/i,

  // ============================================
  // Security Patterns
  // ============================================

  /**
   * SQL injection detection (basic)
   * Used to detect potential SQL injection attempts
   */
  SQL_INJECTION: /('|"|;|--|\/\*|\*\/|xp_|exec\s|execute\s|select\s|insert\s|update\s|delete\s|drop\s|union\s|create\s|alter\s)/i,

  /**
   * XSS detection (basic)
   * Used to detect potential XSS attempts
   */
  XSS_DETECTION: /<\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*link|<\s*style|<\s*meta/i,

  /**
   * Path traversal detection
   */
  PATH_TRAVERSAL: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|%2e%2e%5c)/i,

  // ============================================
  // Content Patterns
  // ============================================

  /**
   * No HTML tags
   */
  NO_HTML: /^[^<>]*$/,

  /**
   * Whitespace only
   */
  WHITESPACE_ONLY: /^\s*$/,

  /**
   * Contains only printable ASCII
   */
  PRINTABLE_ASCII: /^[\x20-\x7E]*$/,

  /**
   * Spam patterns (for message validation)
   */
  SPAM_PATTERNS: /\b(buy now|click here|limited time|act fast|urgent|winner|congratulations|viagra|casino|loan|mortgage|weight loss|get rich|free money|earn cash|make money fast)\b/gi

} as const;

/**
 * Pattern descriptions for error messages
 */
export const PATTERN_DESCRIPTIONS: Record<keyof typeof VALIDATION_PATTERNS, string> = {
  EMAIL: 'a valid email address',
  EMAIL_STRICT: 'a valid email address',
  PHONE_E164: 'a valid international phone number (e.g., +15551234567)',
  PHONE_US: 'a valid US phone number',
  PHONE_GENERIC: 'a valid phone number',
  PASSWORD_STRONG: 'at least 12 characters with uppercase, lowercase, number, and special character',
  PASSWORD_MEDIUM: 'at least 8 characters with letters and numbers',
  PASSWORD_BASIC: 'at least 8 characters',
  NAME: 'a valid name (letters, spaces, apostrophes, hyphens)',
  NAME_SINGLE: 'a valid single name (no spaces)',
  COMPANY_NAME: 'a valid company name',
  USERNAME: 'a valid username (3-30 alphanumeric characters, starting with a letter)',
  USERNAME_EXTENDED: 'a valid username',
  URL_HTTP: 'a valid HTTP/HTTPS URL',
  URL_GENERIC: 'a valid generic URL',
  DOMAIN: 'a valid domain name',
  DATE_ISO: 'a valid date (YYYY-MM-DD)',
  DATETIME_ISO: 'a valid datetime',
  TIME_24H: 'a valid time (HH:mm)',
  INTEGER: 'a valid integer',
  POSITIVE_INTEGER: 'a positive integer',
  DECIMAL: 'a valid decimal number',
  CURRENCY: 'a valid currency amount',
  PERCENTAGE: 'a percentage between 0 and 100',
  UUID: 'a valid UUID',
  ALPHANUMERIC_CODE: 'alphanumeric characters only',
  HEX_COLOR: 'a valid hex color code',
  SLUG: 'a valid URL slug (lowercase letters, numbers, hyphens)',
  FILENAME_SAFE: 'a safe filename',
  FILE_EXTENSION: 'a valid file extension',
  IMAGE_EXTENSION: 'an image file (jpg, png, gif, webp)',
  DOCUMENT_EXTENSION: 'a document file (pdf, doc, xls, etc.)',
  SQL_INJECTION: 'no SQL injection patterns',
  XSS_DETECTION: 'no potentially malicious content',
  PATH_TRAVERSAL: 'no path traversal patterns',
  NO_HTML: 'no HTML tags',
  WHITESPACE_ONLY: 'not empty or whitespace only',
  PRINTABLE_ASCII: 'printable ASCII characters only',
  SPAM_PATTERNS: 'no spam-like content'
};

/**
 * Export pattern type for type safety
 */
export type ValidationPatternKey = keyof typeof VALIDATION_PATTERNS;
