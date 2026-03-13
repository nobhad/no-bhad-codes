/**
 * ===============================================
 * UNIT TESTS - VALIDATION SERVICE
 * ===============================================
 * @file tests/unit/services/validation-service.test.ts
 *
 * Tests for input validation service including:
 * - Email validation
 * - Phone validation
 * - URL validation
 * - XSS detection
 * - SQL injection detection
 * - Text sanitization
 * - Input sanitization (comprehensive)
 * - File upload validation
 * - Object/form validation
 */

import { describe, it, expect } from 'vitest';

// No external dependencies to mock — validation-service is pure functions
import {
  validateEmail,
  validatePhone,
  validateUrl,
  sanitizeText,
  detectXSS,
  detectSQLInjection,
  sanitizeInput,
  validateFile,
  validateObject,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES
} from '../../../server/services/validation-service';

// =====================================================
// VALIDATE EMAIL
// =====================================================

describe('validateEmail', () => {
  it('validates a standard email address', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized).toBe('user@example.com');
  });

  it('trims and lowercases the email', () => {
    const result = validateEmail('  USER@EXAMPLE.COM  ');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('user@example.com');
  });

  it('returns error for empty string', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email is required');
  });

  it('returns error for whitespace-only string', () => {
    const result = validateEmail('   ');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email is required');
  });

  it('returns error for email exceeding 254 characters', () => {
    // Build an email that is definitely > 254 characters total
    // local(64) + '@'(1) + domain-label(63) + '.'(1) + 'com'(3) = 132 chars without padding
    // Use a long domain label to push total well past 254
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(190)  }.com`; // 64 + 1 + 190 + 4 = 259 chars total
    const email = `${local}@${domain}`;
    expect(email.length).toBeGreaterThan(254);
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    // The service accumulates errors; at minimum one error must be present
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for invalid email format (no @)', () => {
    const result = validateEmail('notanemail');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });

  it('returns error for email with consecutive dots', () => {
    const result = validateEmail('user..name@example.com');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email contains invalid consecutive dots');
  });

  it('returns error when local part exceeds 64 characters', () => {
    const local = 'a'.repeat(65);
    const result = validateEmail(`${local}@example.com`);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email local part is too long (max 64 characters)');
  });

  it('returns error when domain part exceeds 63 characters', () => {
    const longPart = 'a'.repeat(64);
    const result = validateEmail(`user@${longPart}.com`);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email domain part is too long');
  });

  it('returns error for domain without TLD', () => {
    const result = validateEmail('user@nodot');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email domain is invalid');
  });

  it('accepts email with subdomains', () => {
    const result = validateEmail('user@mail.example.co.uk');
    expect(result.valid).toBe(true);
  });

  it('accepts email with + in local part', () => {
    const result = validateEmail('user+tag@example.com');
    expect(result.valid).toBe(true);
  });
});

// =====================================================
// VALIDATE PHONE
// =====================================================

describe('validatePhone', () => {
  it('returns valid with empty value for optional phone', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('');
  });

  it('validates a standard US 10-digit number', () => {
    const result = validatePhone('5551234567');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('+1-555-123-4567');
  });

  it('validates a 11-digit number starting with 1', () => {
    const result = validatePhone('15551234567');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('+1-555-123-4567');
  });

  it('accepts formatted phone with dashes and spaces', () => {
    const result = validatePhone('555-123-4567');
    expect(result.valid).toBe(true);
  });

  it('returns error for phone too short', () => {
    const result = validatePhone('12345');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phone number is too short (minimum 7 digits)');
  });

  it('returns error for phone too long', () => {
    const result = validatePhone('1234567890123456'); // 16 digits
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phone number is too long (maximum 15 digits)');
  });

  it('returns error for phone with letters', () => {
    const result = validatePhone('555-ABC-1234');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phone number contains invalid characters');
  });

  it('accepts international format with + prefix', () => {
    const result = validatePhone('+447911123456');
    expect(result.valid).toBe(true);
  });

  it('keeps raw value for non-10/11 digit numbers (no formatting applied)', () => {
    // A valid 7-digit phone gets no special formatting
    const result = validatePhone('5551234');
    expect(result.sanitized).toBe('5551234');
  });
});

// =====================================================
// VALIDATE URL
// =====================================================

describe('validateUrl', () => {
  it('returns valid with empty value for optional URL', () => {
    const result = validateUrl('');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('');
  });

  it('validates a standard HTTPS URL', () => {
    const result = validateUrl('https://example.com');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('https://example.com');
  });

  it('adds https:// prefix when missing', () => {
    const result = validateUrl('example.com');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('https://example.com');
  });

  it('accepts HTTP URLs', () => {
    const result = validateUrl('http://example.com');
    expect(result.valid).toBe(true);
  });

  it('rejects localhost URLs', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Localhost URLs are not allowed');
  });

  it('rejects 127.0.0.1 URLs', () => {
    const result = validateUrl('http://127.0.0.1:8080');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Localhost URLs are not allowed');
  });

  it('returns error for completely invalid URL', () => {
    const result = validateUrl('not a url at all!!!');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts URL with a simple path (no query string)', () => {
    // The internal URL_REGEX does not match query strings, so test a plain path
    const result = validateUrl('https://example.com/path/to/page');
    expect(result.valid).toBe(true);
  });
});

// =====================================================
// SANITIZE TEXT
// =====================================================

describe('sanitizeText', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('encodes HTML entities', () => {
    const result = sanitizeText('<script>alert("xss")</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('encodes ampersands', () => {
    const result = sanitizeText('AT&T');
    expect(result).toContain('&amp;');
  });

  it('encodes double quotes', () => {
    const result = sanitizeText('Say "hello"');
    expect(result).toContain('&quot;');
  });

  it('encodes single quotes', () => {
    const result = sanitizeText('It\'s fine');
    expect(result).toContain('&#x27;');
  });

  it('encodes forward slashes', () => {
    const result = sanitizeText('path/to/file');
    expect(result).toContain('&#x2F;');
  });

  it('leaves clean text unchanged (except slash encoding)', () => {
    const result = sanitizeText('Hello World');
    expect(result).toBe('Hello World');
  });
});

// =====================================================
// DETECT XSS
// =====================================================

describe('detectXSS', () => {
  it('returns not detected for empty string', () => {
    const result = detectXSS('');
    expect(result.detected).toBe(false);
    expect(result.patterns).toHaveLength(0);
  });

  it('detects script tags', () => {
    const result = detectXSS('<script>alert("xss")</script>');
    expect(result.detected).toBe(true);
  });

  it('detects javascript: protocol', () => {
    const result = detectXSS('javascript:void(0)');
    expect(result.detected).toBe(true);
  });

  it('detects onerror event handlers', () => {
    const result = detectXSS('<img src=x onerror=alert(1)>');
    expect(result.detected).toBe(true);
  });

  it('detects iframe tags', () => {
    const result = detectXSS('<iframe src="evil.com"></iframe>');
    expect(result.detected).toBe(true);
  });

  it('detects object tags', () => {
    const result = detectXSS('<object data="file.swf"></object>');
    expect(result.detected).toBe(true);
  });

  it('detects embed tags', () => {
    const result = detectXSS('<embed src="evil.swf">');
    expect(result.detected).toBe(true);
  });

  it('detects link tags', () => {
    const result = detectXSS('<link rel="stylesheet" href="evil.css">');
    expect(result.detected).toBe(true);
  });

  it('detects meta tags', () => {
    const result = detectXSS('<meta http-equiv="refresh">');
    expect(result.detected).toBe(true);
  });

  it('detects HTML comments', () => {
    const result = detectXSS('<!-- comment -->');
    expect(result.detected).toBe(true);
  });

  it('returns not detected for safe text', () => {
    const result = detectXSS('Hello, this is a normal sentence.');
    expect(result.detected).toBe(false);
  });

  it('returns detected patterns as array', () => {
    const result = detectXSS('<script>bad</script>');
    expect(Array.isArray(result.patterns)).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });
});

// =====================================================
// DETECT SQL INJECTION
// =====================================================

describe('detectSQLInjection', () => {
  it('returns not detected for empty string', () => {
    const result = detectSQLInjection('');
    expect(result.detected).toBe(false);
  });

  it('detects SELECT keyword', () => {
    const result = detectSQLInjection('SELECT * FROM users');
    expect(result.detected).toBe(true);
  });

  it('detects DROP keyword', () => {
    const result = detectSQLInjection('DROP TABLE users;');
    expect(result.detected).toBe(true);
  });

  it('detects UNION keyword', () => {
    const result = detectSQLInjection('1 UNION SELECT id, password FROM users');
    expect(result.detected).toBe(true);
  });

  it('detects comment sequences (--)', () => {
    const result = detectSQLInjection('admin\'--');
    expect(result.detected).toBe(true);
  });

  it('detects OR-based injection patterns', () => {
    const result = detectSQLInjection('1 OR 1=1');
    expect(result.detected).toBe(true);
  });

  it('detects AND-based injection patterns', () => {
    const result = detectSQLInjection('1 AND 1=1');
    expect(result.detected).toBe(true);
  });

  it('returns not detected for safe text', () => {
    const result = detectSQLInjection('My project name');
    expect(result.detected).toBe(false);
  });

  it('returns detected patterns as array', () => {
    const result = detectSQLInjection('SELECT id FROM clients');
    expect(Array.isArray(result.patterns)).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });
});

// =====================================================
// SANITIZE INPUT
// =====================================================

describe('sanitizeInput', () => {
  it('returns clean text unchanged', () => {
    const result = sanitizeInput('Hello World');
    expect(result.value).toBe('Hello World');
    expect(result.wasModified).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('trims whitespace by default', () => {
    const result = sanitizeInput('  Hello World  ');
    expect(result.value).toBe('Hello World');
    expect(result.wasModified).toBe(true);
  });

  it('does not trim when trim=false', () => {
    const result = sanitizeInput('  hello  ', { trim: false });
    expect(result.value).toBe('  hello  ');
    expect(result.wasModified).toBe(false);
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(20);
    const result = sanitizeInput(long, { maxLength: 10 });
    expect(result.value).toHaveLength(10);
    expect(result.wasModified).toBe(true);
    expect(result.warnings).toContain('Input truncated to 10 characters');
  });

  it('does not truncate if under maxLength', () => {
    const result = sanitizeInput('short', { maxLength: 100 });
    expect(result.value).toBe('short');
    expect(result.warnings).toHaveLength(0);
  });

  it('sanitizes XSS content when allowHtml is false (default)', () => {
    const result = sanitizeInput('<script>alert(1)</script>');
    expect(result.wasModified).toBe(true);
    expect(result.warnings).toContain('Potentially malicious content detected');
    expect(result.value).not.toContain('<script>');
  });

  it('does not sanitize XSS content when allowHtml is true', () => {
    const input = '<script>alert(1)</script>';
    const result = sanitizeInput(input, { allowHtml: true });
    expect(result.warnings).toContain('Potentially malicious content detected');
    // Value should NOT be HTML-encoded when allowHtml is true
    expect(result.value).toContain('<script>');
  });

  it('warns about SQL patterns but does not remove them', () => {
    const result = sanitizeInput('SELECT * FROM users');
    expect(result.warnings).toContain('Potentially malicious SQL patterns detected');
    // SQL injection is warned but not removed
    expect(result.value).toContain('SELECT');
  });

  it('removes null bytes', () => {
    const result = sanitizeInput('hello\0world');
    expect(result.value).toBe('helloworld');
    expect(result.wasModified).toBe(true);
    expect(result.warnings).toContain('Null bytes removed');
  });

  it('normalizes unicode to NFC', () => {
    // Compose a string that would differ after NFC normalization
    // '\u00e9' (precomposed é) vs '\u0065\u0301' (decomposed e + combining accent)
    const decomposed = '\u0065\u0301'; // decomposed é
    const result = sanitizeInput(decomposed);
    expect(result.value).toBe('\u00e9'); // precomposed é
    expect(result.wasModified).toBe(true);
  });
});

// =====================================================
// VALIDATE FILE
// =====================================================

describe('validateFile', () => {
  it('validates a valid JPEG image', () => {
    const result = validateFile('photo.jpg', 'image/jpeg', 1024 * 1024, ['images']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.extension).toBe('.jpg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('validates a valid PDF document', () => {
    const result = validateFile('document.pdf', 'application/pdf', 2 * 1024 * 1024, ['documents']);
    expect(result.valid).toBe(true);
  });

  it('rejects disallowed file extension', () => {
    const result = validateFile('file.tiff', 'image/tiff', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.tiff'))).toBe(true);
  });

  it('rejects disallowed MIME type', () => {
    const result = validateFile('file.jpg', 'image/tiff', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('image/tiff'))).toBe(true);
  });

  it('rejects file exceeding size limit', () => {
    const overSize = MAX_FILE_SIZES.image + 1;
    const result = validateFile('photo.jpg', 'image/jpeg', overSize, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
  });

  it('accepts archive up to max archive size', () => {
    const result = validateFile('archive.zip', 'application/zip', MAX_FILE_SIZES.archive, ['archives']);
    expect(result.valid).toBe(true);
  });

  it('rejects archive exceeding archive size limit', () => {
    const result = validateFile('archive.zip', 'application/zip', MAX_FILE_SIZES.archive + 1, ['archives']);
    expect(result.valid).toBe(false);
  });

  it('uses largest size limit when multiple categories allowed', () => {
    // With both images and archives allowed, max size should be archive limit (50MB)
    const almostArchiveMax = MAX_FILE_SIZES.archive - 1;
    // Archive MIME type requires archive category
    const result = validateFile('archive.zip', 'application/zip', almostArchiveMax, ['images', 'archives']);
    expect(result.valid).toBe(true);
  });

  it('rejects filename with invalid characters', () => {
    const result = validateFile('file<name>.jpg', 'image/jpeg', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filename contains invalid characters');
  });

  it('rejects filename with path traversal', () => {
    const result = validateFile('../../../etc/passwd.jpg', 'image/jpeg', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filename contains path traversal characters');
  });

  it('rejects filename containing dangerous extension (.exe)', () => {
    const result = validateFile('malware.exe.jpg', 'image/jpeg', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filename contains potentially dangerous extension');
  });

  it('rejects filename containing .php extension', () => {
    const result = validateFile('shell.php.jpg', 'image/jpeg', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filename contains potentially dangerous extension');
  });

  it('rejects filename containing .sh extension', () => {
    const result = validateFile('script.sh.jpg', 'image/jpeg', 1024, ['images']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filename contains potentially dangerous extension');
  });

  it('uses default categories (images + documents) when none specified', () => {
    const result = validateFile('photo.png', 'image/png', 1024);
    expect(result.valid).toBe(true);
  });

  it('includes sizeBytes in result', () => {
    const result = validateFile('photo.jpg', 'image/jpeg', 512000, ['images']);
    expect(result.sizeBytes).toBe(512000);
  });

  it('accepts WebP images', () => {
    const result = validateFile('image.webp', 'image/webp', 1024, ['images']);
    expect(result.valid).toBe(true);
  });

  it('accepts CSV documents', () => {
    const result = validateFile('data.csv', 'text/csv', 1024, ['documents']);
    expect(result.valid).toBe(true);
  });
});

// =====================================================
// VALIDATE OBJECT
// =====================================================

describe('validateObject', () => {
  it('validates a valid object against a schema', () => {
    const data = { email: 'user@example.com', name: 'Alice' };
    const schema = {
      email: { type: 'email' as const, required: true },
      name: { type: 'text' as const, required: true, minLength: 2, maxLength: 100 }
    };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('returns error for missing required field', () => {
    const data = { name: 'Alice' };
    const schema = {
      email: { type: 'email' as const, required: true },
      name: { type: 'text' as const }
    };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.email).toContain('email is required');
  });

  it('allows optional fields to be absent', () => {
    const data = { name: 'Alice' };
    const schema = {
      name: { type: 'text' as const, required: true },
      phone: { type: 'phone' as const }
    };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
    expect(result.sanitized.phone).toBeUndefined();
  });

  it('validates email type fields', () => {
    const data = { email: 'invalid-email' };
    const schema = { email: { type: 'email' as const, required: true } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('validates phone type fields', () => {
    const data = { phone: '5551234567' };
    const schema = { phone: { type: 'phone' as const } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
    expect(result.sanitized.phone).toBe('+1-555-123-4567');
  });

  it('validates url type fields', () => {
    const data = { website: 'https://example.com' };
    const schema = { website: { type: 'url' as const } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
  });

  it('validates text minLength', () => {
    const data = { name: 'A' };
    const schema = { name: { type: 'text' as const, required: true, minLength: 3 } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.name).toContain('name must be at least 3 characters');
  });

  it('validates text maxLength', () => {
    const data = { name: 'A'.repeat(200) };
    const schema = { name: { type: 'text' as const, maxLength: 100 } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.name).toContain('name must be at most 100 characters');
  });

  it('validates text pattern', () => {
    const data = { code: 'ABC-123' };
    const schema = { code: { type: 'text' as const, pattern: /^\d+$/ } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.code).toContain('code format is invalid');
  });

  it('accepts text matching the pattern', () => {
    const data = { code: '12345' };
    const schema = { code: { type: 'text' as const, pattern: /^\d+$/ } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
  });

  it('validates number type fields', () => {
    const data = { age: 25 };
    const schema = { age: { type: 'number' as const, min: 0, max: 150 } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
    expect(result.sanitized.age).toBe(25);
  });

  it('returns error for NaN number', () => {
    const data = { age: 'not-a-number' };
    const schema = { age: { type: 'number' as const } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.age).toContain('age must be a number');
  });

  it('returns error for number below min', () => {
    const data = { age: -5 };
    const schema = { age: { type: 'number' as const, min: 0 } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.age).toContain('age must be at least 0');
  });

  it('returns error for number above max', () => {
    const data = { age: 200 };
    const schema = { age: { type: 'number' as const, max: 150 } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.age).toContain('age must be at most 150');
  });

  it('validates boolean type fields', () => {
    const data = { active: true };
    const schema = { active: { type: 'boolean' as const } };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
    expect(result.sanitized.active).toBe(true);
  });

  it('coerces truthy value to boolean', () => {
    const data = { active: 1 };
    const schema = { active: { type: 'boolean' as const } };

    const result = validateObject(data, schema);

    expect(result.sanitized.active).toBe(true);
  });

  it('returns empty errors for null optional field', () => {
    const data = { name: 'Alice', phone: null };
    const schema = {
      name: { type: 'text' as const, required: true },
      phone: { type: 'phone' as const }
    };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(true);
  });

  it('handles multiple fields with mixed validity', () => {
    const data = { email: 'invalid', phone: '5551234567', age: -1 };
    const schema = {
      email: { type: 'email' as const, required: true },
      phone: { type: 'phone' as const },
      age: { type: 'number' as const, min: 0 }
    };

    const result = validateObject(data, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
    expect(result.errors.age).toBeDefined();
    expect(result.errors.phone).toBeUndefined();
  });
});

// =====================================================
// EXPORTED CONSTANTS
// =====================================================

describe('ALLOWED_FILE_TYPES and MAX_FILE_SIZES', () => {
  it('exports ALLOWED_FILE_TYPES with images, documents, archives', () => {
    expect(ALLOWED_FILE_TYPES).toHaveProperty('images');
    expect(ALLOWED_FILE_TYPES).toHaveProperty('documents');
    expect(ALLOWED_FILE_TYPES).toHaveProperty('archives');
  });

  it('images category includes JPEG, PNG, GIF, WebP, SVG', () => {
    expect(ALLOWED_FILE_TYPES.images.mimeTypes).toContain('image/jpeg');
    expect(ALLOWED_FILE_TYPES.images.extensions).toContain('.jpg');
    expect(ALLOWED_FILE_TYPES.images.extensions).toContain('.png');
    expect(ALLOWED_FILE_TYPES.images.extensions).toContain('.gif');
    expect(ALLOWED_FILE_TYPES.images.extensions).toContain('.webp');
    expect(ALLOWED_FILE_TYPES.images.extensions).toContain('.svg');
  });

  it('documents category includes PDF', () => {
    expect(ALLOWED_FILE_TYPES.documents.mimeTypes).toContain('application/pdf');
    expect(ALLOWED_FILE_TYPES.documents.extensions).toContain('.pdf');
  });

  it('archives category includes ZIP', () => {
    expect(ALLOWED_FILE_TYPES.archives.mimeTypes).toContain('application/zip');
    expect(ALLOWED_FILE_TYPES.archives.extensions).toContain('.zip');
  });

  it('exports MAX_FILE_SIZES with expected values', () => {
    expect(MAX_FILE_SIZES.image).toBe(10 * 1024 * 1024);
    expect(MAX_FILE_SIZES.document).toBe(25 * 1024 * 1024);
    expect(MAX_FILE_SIZES.archive).toBe(50 * 1024 * 1024);
    expect(MAX_FILE_SIZES.default).toBe(10 * 1024 * 1024);
  });
});
