/**
 * ===============================================
 * SANITIZATION UTILITIES
 * ===============================================
 * @file src/utils/sanitization-utils.ts
 *
 * Security utilities for sanitizing user input and preventing XSS attacks.
 */

export class SanitizationUtils {
  /**
   * HTML entities that need to be escaped
   */
  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#x27;',
    '`': '&#96;'
  };

  /**
   * Dangerous HTML tags to remove completely
   */
  private static readonly DANGEROUS_TAGS = [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'textarea',
    'button',
    'select',
    'option',
    'link',
    'meta',
    'style',
    'title',
    'base',
    'svg',
    'math'
  ];

  /**
   * JavaScript event attributes to remove
   */
  private static readonly JS_EVENT_ATTRIBUTES = [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onmouseout',
    'onkeydown',
    'onkeyup',
    'onkeypress',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onreset',
    'onselect',
    'onabort',
    'onunload',
    'onresize',
    'onscroll'
  ];

  /**
   * Escape HTML entities to prevent XSS
   */
  static escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input.replace(/[&<>"'`]/g, (match) => SanitizationUtils.HTML_ENTITIES[match] || match);
  }

  /**
   * Capitalize each word in a string (Title Case)
   * Handles names like "john doe" -> "John Doe"
   */
  static capitalizeName(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Remove all HTML tags from input
   */
  static stripHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Clean and sanitize text input (most restrictive)
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return SanitizationUtils.escapeHtml(SanitizationUtils.stripHtml(input.trim()));
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';

    // Remove HTML and escape entities
    const cleaned = SanitizationUtils.stripHtml(email.trim().toLowerCase());

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(cleaned) ? cleaned : '';
  }

  /**
   * Sanitize textarea/message input (allow some formatting)
   */
  static sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') return '';

    let cleaned = message.trim();

    // Remove dangerous HTML tags
    SanitizationUtils.DANGEROUS_TAGS.forEach((tag) => {
      const regex = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });

    // Remove JavaScript event attributes
    SanitizationUtils.JS_EVENT_ATTRIBUTES.forEach((attr) => {
      const regex = new RegExp(`${attr}\\s*=\\s*[^\\s>]*`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });

    // Remove javascript: and data: URLs
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/data:/gi, '');
    cleaned = cleaned.replace(/vbscript:/gi, '');

    // Escape remaining HTML entities
    return SanitizationUtils.escapeHtml(cleaned);
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';

    const cleaned = url.trim();

    // Only allow http, https, and mailto protocols
    const allowedProtocols = /^(https?|mailto):/i;
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(cleaned);

    if (hasProtocol && !allowedProtocols.test(cleaned)) {
      return ''; // Reject dangerous protocols
    }

    // Remove HTML and escape
    return SanitizationUtils.escapeHtml(SanitizationUtils.stripHtml(cleaned));
  }

  /**
   * Sanitize phone number
   */
  static sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';

    // Remove HTML and keep only numbers, spaces, dashes, parentheses, plus
    const cleaned = SanitizationUtils.stripHtml(phone.trim()).replace(/[^0-9\s\-()+ ext.]/g, '');

    return SanitizationUtils.escapeHtml(cleaned);
  }

  /**
   * Sanitize form data object
   */
  static sanitizeFormData(data: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        sanitized[key] = '';
        continue;
      }

      const stringValue = String(value);
      const sanitizedKey = SanitizationUtils.sanitizeText(key);

      // Apply specific sanitization based on field type/name
      switch (key.toLowerCase()) {
      case 'email':
        sanitized[sanitizedKey] = SanitizationUtils.sanitizeEmail(stringValue);
        break;
      case 'phone':
      case 'telephone':
      case 'mobile':
        sanitized[sanitizedKey] = SanitizationUtils.sanitizePhone(stringValue);
        break;
      case 'website':
      case 'url':
      case 'link':
        sanitized[sanitizedKey] = SanitizationUtils.sanitizeUrl(stringValue);
        break;
      case 'message':
      case 'comment':
      case 'description':
      case 'notes':
        sanitized[sanitizedKey] = SanitizationUtils.sanitizeMessage(stringValue);
        break;
      default:
        sanitized[sanitizedKey] = SanitizationUtils.sanitizeText(stringValue);
      }
    }

    return sanitized;
  }

  /**
   * Validate that input doesn't contain common XSS patterns
   */
  static detectXss(input: string): boolean {
    if (!input || typeof input !== 'string') return false;

    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /expression\(/i,
      /url\(/i,
      /@import/i,
      /behavior:/i
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Rate limiting helper - track submission attempts
   */
  private static submissionAttempts = new Map<string, { count: number; firstAttempt: number }>();

  static checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 300000): boolean {
    const now = Date.now();
    const attempts = SanitizationUtils.submissionAttempts.get(identifier);

    if (!attempts) {
      SanitizationUtils.submissionAttempts.set(identifier, { count: 1, firstAttempt: now });
      return true;
    }

    // Reset if window has passed
    if (now - attempts.firstAttempt > windowMs) {
      SanitizationUtils.submissionAttempts.set(identifier, { count: 1, firstAttempt: now });
      return true;
    }

    // Check if limit exceeded
    if (attempts.count >= maxAttempts) {
      return false;
    }

    // Increment counter
    attempts.count++;
    return true;
  }

  /**
   * Generate CSP nonce for inline scripts (if needed)
   */
  static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Log security violations
   */
  static logSecurityViolation(type: string, data: any, userAgent?: string): void {
    const violation = {
      type,
      timestamp: new Date().toISOString(),
      data: SanitizationUtils.sanitizeText(JSON.stringify(data)),
      userAgent: userAgent ? SanitizationUtils.sanitizeText(userAgent) : 'unknown',
      url: window.location.href
    };

    console.warn('🚨 Security violation detected:', violation);

    // In production, you might want to send this to your monitoring service
    // fetch('/api/security-violation', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(violation)
    // }).catch(() => {}); // Ignore errors
  }
}

/**
 * Sanitization presets for common use cases
 */
export const SanitizationPresets = {
  /**
   * Strict sanitization for names, titles, etc.
   */
  strict: (input: string): string => SanitizationUtils.sanitizeText(input),

  /**
   * Email sanitization
   */
  email: (input: string): string => SanitizationUtils.sanitizeEmail(input),

  /**
   * Message/textarea sanitization (allows some formatting)
   */
  message: (input: string): string => SanitizationUtils.sanitizeMessage(input),

  /**
   * URL sanitization
   */
  url: (input: string): string => SanitizationUtils.sanitizeUrl(input),

  /**
   * Phone number sanitization
   */
  phone: (input: string): string => SanitizationUtils.sanitizePhone(input)
};
