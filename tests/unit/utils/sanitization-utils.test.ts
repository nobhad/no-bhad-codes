/**
 * ===============================================
 * SANITIZATION UTILS TESTS
 * ===============================================
 * @file tests/unit/utils/sanitization-utils.test.ts
 *
 * Unit tests for SanitizationUtils class and SanitizationPresets.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SanitizationUtils, SanitizationPresets } from '../../../src/utils/sanitization-utils';

vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })
}));

// ============================================
// SanitizationUtils
// ============================================

describe('SanitizationUtils', () => {

  // ----------------------------------------
  // escapeHtml
  // ----------------------------------------

  describe('escapeHtml', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.escapeHtml('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.escapeHtml(null as unknown as string)).toBe('');
      expect(SanitizationUtils.escapeHtml(undefined as unknown as string)).toBe('');
      expect(SanitizationUtils.escapeHtml(42 as unknown as string)).toBe('');
    });

    it('escapes ampersand', () => {
      expect(SanitizationUtils.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less-than and greater-than', () => {
      expect(SanitizationUtils.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes double quotes', () => {
      expect(SanitizationUtils.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(SanitizationUtils.escapeHtml("it's")).toBe('it&#x27;s');
    });

    it('escapes backticks', () => {
      expect(SanitizationUtils.escapeHtml('`code`')).toBe('&#96;code&#96;');
    });

    it('escapes all dangerous characters in one string', () => {
      const result = SanitizationUtils.escapeHtml('&<>"\' `');
      expect(result).toBe('&amp;&lt;&gt;&quot;&#x27; &#96;');
    });

    it('leaves normal text unchanged', () => {
      expect(SanitizationUtils.escapeHtml('Hello World')).toBe('Hello World');
    });

    it('leaves alphanumeric and punctuation unchanged', () => {
      expect(SanitizationUtils.escapeHtml('abc 123 !@#')).toBe('abc 123 !@#');
    });
  });

  // ----------------------------------------
  // decodeHtmlEntities
  // ----------------------------------------

  describe('decodeHtmlEntities', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.decodeHtmlEntities('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.decodeHtmlEntities(null as unknown as string)).toBe('');
      expect(SanitizationUtils.decodeHtmlEntities(undefined as unknown as string)).toBe('');
    });

    it('decodes &amp; back to &', () => {
      expect(SanitizationUtils.decodeHtmlEntities('&amp;')).toBe('&');
    });

    it('decodes &lt;script&gt; back to <script>', () => {
      expect(SanitizationUtils.decodeHtmlEntities('&lt;script&gt;')).toBe('<script>');
    });

    it('decodes &quot; back to double quote', () => {
      expect(SanitizationUtils.decodeHtmlEntities('&quot;')).toBe('"');
    });

    it('decodes multiple entities in one string', () => {
      const result = SanitizationUtils.decodeHtmlEntities('&lt;p&gt;Hello &amp; World&lt;/p&gt;');
      expect(result).toBe('<p>Hello & World</p>');
    });

    it('leaves plain text unchanged', () => {
      expect(SanitizationUtils.decodeHtmlEntities('Hello World')).toBe('Hello World');
    });
  });

  // ----------------------------------------
  // capitalizeName
  // ----------------------------------------

  describe('capitalizeName', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.capitalizeName('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.capitalizeName(null as unknown as string)).toBe('');
      expect(SanitizationUtils.capitalizeName(undefined as unknown as string)).toBe('');
    });

    it('capitalizes a lowercase first and last name', () => {
      expect(SanitizationUtils.capitalizeName('john doe')).toBe('John Doe');
    });

    it('lowercases then capitalizes an ALL CAPS name', () => {
      expect(SanitizationUtils.capitalizeName('JANE SMITH')).toBe('Jane Smith');
    });

    it('handles a single word', () => {
      expect(SanitizationUtils.capitalizeName('alice')).toBe('Alice');
    });

    it('handles mixed-case input', () => {
      expect(SanitizationUtils.capitalizeName('bOb mARTIN')).toBe('Bob Martin');
    });

    it('preserves spacing between words', () => {
      expect(SanitizationUtils.capitalizeName('a b c')).toBe('A B C');
    });
  });

  // ----------------------------------------
  // stripHtml
  // ----------------------------------------

  describe('stripHtml', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.stripHtml('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.stripHtml(null as unknown as string)).toBe('');
      expect(SanitizationUtils.stripHtml(undefined as unknown as string)).toBe('');
    });

    it('strips a simple paragraph tag', () => {
      expect(SanitizationUtils.stripHtml('<p>hello</p>')).toBe('hello');
    });

    it('removes script open/close tags, leaving inner content and surrounding text', () => {
      // stripHtml removes tag markup only — inner content remains
      const result = SanitizationUtils.stripHtml('<script>alert(1)</script>text');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('text');
    });

    it('strips multiple different tags', () => {
      expect(SanitizationUtils.stripHtml('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
    });

    it('leaves plain text unchanged', () => {
      expect(SanitizationUtils.stripHtml('Hello World')).toBe('Hello World');
    });
  });

  // ----------------------------------------
  // sanitizeText
  // ----------------------------------------

  describe('sanitizeText', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.sanitizeText('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.sanitizeText(null as unknown as string)).toBe('');
    });

    it('strips HTML and escapes entities', () => {
      expect(SanitizationUtils.sanitizeText('<b>hello</b>')).toBe('hello');
    });

    it('trims surrounding whitespace', () => {
      expect(SanitizationUtils.sanitizeText('  spaces  ')).toBe('spaces');
    });

    it('strips HTML and trims', () => {
      expect(SanitizationUtils.sanitizeText('  <p>test</p>  ')).toBe('test');
    });

    it('escapes HTML entities that remain after stripping', () => {
      // Bare ampersand in plain text should be escaped
      expect(SanitizationUtils.sanitizeText('a & b')).toBe('a &amp; b');
    });
  });

  // ----------------------------------------
  // sanitizeEmail
  // ----------------------------------------

  describe('sanitizeEmail', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.sanitizeEmail('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.sanitizeEmail(null as unknown as string)).toBe('');
    });

    it('lowercases a valid uppercase email', () => {
      expect(SanitizationUtils.sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('accepts a valid lowercase email unchanged', () => {
      expect(SanitizationUtils.sanitizeEmail('user@example.com')).toBe('user@example.com');
    });

    it('returns empty string for an invalid email format', () => {
      expect(SanitizationUtils.sanitizeEmail('not-an-email')).toBe('');
    });

    it('returns empty string when input contains script injection', () => {
      expect(SanitizationUtils.sanitizeEmail('<script>@evil.com')).toBe('');
    });

    it('trims whitespace before validating', () => {
      expect(SanitizationUtils.sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('returns empty string for a plain invalid string', () => {
      expect(SanitizationUtils.sanitizeEmail('invalid')).toBe('');
    });
  });

  // ----------------------------------------
  // sanitizeMessage
  // ----------------------------------------

  describe('sanitizeMessage', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.sanitizeMessage('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.sanitizeMessage(null as unknown as string)).toBe('');
    });

    it('removes script tags', () => {
      const result = SanitizationUtils.sanitizeMessage('<script>alert(1)</script>hello');
      expect(result).not.toContain('<script>');
      expect(result).toContain('hello');
    });

    it('removes onclick event attributes', () => {
      const result = SanitizationUtils.sanitizeMessage('<div onclick=evil()>text</div>');
      expect(result).not.toContain('onclick');
    });

    it('removes javascript: protocol', () => {
      const result = SanitizationUtils.sanitizeMessage('javascript:alert(1)');
      expect(result).not.toContain('javascript:');
    });

    it('removes data: URLs', () => {
      const result = SanitizationUtils.sanitizeMessage('data:text/html,<h1>test</h1>');
      expect(result).not.toContain('data:');
    });

    it('removes vbscript: protocol', () => {
      const result = SanitizationUtils.sanitizeMessage('vbscript:msgbox(1)');
      expect(result).not.toContain('vbscript:');
    });

    it('escapes remaining HTML entities', () => {
      const result = SanitizationUtils.sanitizeMessage('hello & world');
      expect(result).toContain('&amp;');
    });

    it('preserves normal message text', () => {
      const result = SanitizationUtils.sanitizeMessage('Hello, this is a normal message.');
      expect(result).toContain('Hello');
    });
  });

  // ----------------------------------------
  // sanitizeUrl
  // ----------------------------------------

  describe('sanitizeUrl', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.sanitizeUrl('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.sanitizeUrl(null as unknown as string)).toBe('');
    });

    it('returns empty string for javascript: URL', () => {
      expect(SanitizationUtils.sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('returns empty string for data: URL', () => {
      expect(SanitizationUtils.sanitizeUrl('data:text/html,<h1>xss</h1>')).toBe('');
    });

    it('accepts an https URL', () => {
      expect(SanitizationUtils.sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('accepts an http URL', () => {
      expect(SanitizationUtils.sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('accepts a mailto URL', () => {
      expect(SanitizationUtils.sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('returns empty string for ftp:// protocol', () => {
      expect(SanitizationUtils.sanitizeUrl('ftp://evil.com')).toBe('');
    });

    it('trims whitespace before processing', () => {
      expect(SanitizationUtils.sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
    });
  });

  // ----------------------------------------
  // sanitizePhone
  // ----------------------------------------

  describe('sanitizePhone', () => {
    it('returns empty string for empty input', () => {
      expect(SanitizationUtils.sanitizePhone('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(SanitizationUtils.sanitizePhone(null as unknown as string)).toBe('');
    });

    it('strips HTML tags from phone input', () => {
      const result = SanitizationUtils.sanitizePhone('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
    });

    it('keeps digits', () => {
      const result = SanitizationUtils.sanitizePhone('1234567890');
      expect(result).toContain('1234567890');
    });

    it('keeps spaces, dashes, parentheses, and plus sign', () => {
      const result = SanitizationUtils.sanitizePhone('+1 (555) 123-4567');
      expect(result).toContain('+1');
      expect(result).toContain('(555)');
      expect(result).toContain('123-4567');
    });

    it('removes # characters which are not in the allowed set', () => {
      const result = SanitizationUtils.sanitizePhone('555###0000');
      // # is not in the allowed character set and should be stripped
      expect(result).not.toContain('#');
      // Digits are always preserved
      expect(result).toContain('5550000');
    });
  });

  // ----------------------------------------
  // formatPhone
  // ----------------------------------------

  describe('formatPhone', () => {
    it('returns dash for empty input', () => {
      expect(SanitizationUtils.formatPhone('')).toBe('-');
    });

    it('returns dash for non-string input', () => {
      expect(SanitizationUtils.formatPhone(null as unknown as string)).toBe('-');
    });

    it('formats a 10-digit number as (XXX) XXX-XXXX', () => {
      expect(SanitizationUtils.formatPhone('1234567890')).toBe('(123) 456-7890');
    });

    it('formats an 11-digit US number (country code 1) as (XXX) XXX-XXXX', () => {
      expect(SanitizationUtils.formatPhone('11234567890')).toBe('(123) 456-7890');
    });

    it('returns original input for non-standard length', () => {
      expect(SanitizationUtils.formatPhone('123')).toBe('123');
    });

    it('formats a formatted input string by extracting digits', () => {
      expect(SanitizationUtils.formatPhone('(123) 456-7890')).toBe('(123) 456-7890');
    });
  });

  // ----------------------------------------
  // sanitizeFormData
  // ----------------------------------------

  describe('sanitizeFormData', () => {
    it('routes email field through sanitizeEmail', () => {
      const result = SanitizationUtils.sanitizeFormData({ email: 'USER@EXAMPLE.COM' });
      expect(result['email']).toBe('user@example.com');
    });

    it('routes phone field through sanitizePhone', () => {
      const result = SanitizationUtils.sanitizeFormData({ phone: '+1 (555) 000-0000' });
      expect(result['phone']).toContain('+1');
    });

    it('routes telephone field through sanitizePhone', () => {
      const result = SanitizationUtils.sanitizeFormData({ telephone: '5550000000' });
      expect(result['telephone']).toContain('5550000000');
    });

    it('routes mobile field through sanitizePhone', () => {
      const result = SanitizationUtils.sanitizeFormData({ mobile: '5550001111' });
      expect(result['mobile']).toContain('5550001111');
    });

    it('routes url field through sanitizeUrl', () => {
      const result = SanitizationUtils.sanitizeFormData({ url: 'https://example.com' });
      expect(result['url']).toBe('https://example.com');
    });

    it('routes website field through sanitizeUrl', () => {
      const result = SanitizationUtils.sanitizeFormData({ website: 'https://example.com' });
      expect(result['website']).toBe('https://example.com');
    });

    it('routes link field through sanitizeUrl', () => {
      const result = SanitizationUtils.sanitizeFormData({ link: 'https://example.com' });
      expect(result['link']).toBe('https://example.com');
    });

    it('routes message field through sanitizeMessage', () => {
      const result = SanitizationUtils.sanitizeFormData({ message: '<script>evil</script>hello' });
      expect(result['message']).not.toContain('<script>');
      expect(result['message']).toContain('hello');
    });

    it('routes comment field through sanitizeMessage', () => {
      const result = SanitizationUtils.sanitizeFormData({ comment: 'javascript:alert(1)' });
      expect(result['comment']).not.toContain('javascript:');
    });

    it('routes description field through sanitizeMessage', () => {
      const result = SanitizationUtils.sanitizeFormData({ description: 'vbscript:evil' });
      expect(result['description']).not.toContain('vbscript:');
    });

    it('routes notes field through sanitizeMessage', () => {
      const result = SanitizationUtils.sanitizeFormData({ notes: 'Safe note.' });
      expect(result['notes']).toContain('Safe note.');
    });

    it('routes unknown fields through sanitizeText', () => {
      const result = SanitizationUtils.sanitizeFormData({ name: '<b>Alice</b>' });
      expect(result['name']).toBe('Alice');
    });

    it('converts null values to empty string', () => {
      const result = SanitizationUtils.sanitizeFormData({ field: null });
      expect(result['field']).toBe('');
    });

    it('converts undefined values to empty string', () => {
      const result = SanitizationUtils.sanitizeFormData({ field: undefined });
      expect(result['field']).toBe('');
    });

    it('handles multiple fields at once', () => {
      const result = SanitizationUtils.sanitizeFormData({
        email: 'USER@EXAMPLE.COM',
        name: '<b>Alice</b>'
      });
      expect(result['email']).toBe('user@example.com');
      expect(result['name']).toBe('Alice');
    });
  });

  // ----------------------------------------
  // detectXss
  // ----------------------------------------

  describe('detectXss', () => {
    it('returns false for empty string', () => {
      expect(SanitizationUtils.detectXss('')).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(SanitizationUtils.detectXss(null as unknown as string)).toBe(false);
    });

    it('detects <script opening tag', () => {
      expect(SanitizationUtils.detectXss('<script>alert(1)</script>')).toBe(true);
    });

    it('detects javascript: protocol', () => {
      expect(SanitizationUtils.detectXss('javascript:void(0)')).toBe(true);
    });

    it('detects vbscript: protocol', () => {
      expect(SanitizationUtils.detectXss('vbscript:msgbox(1)')).toBe(true);
    });

    it('detects onload= event handler', () => {
      expect(SanitizationUtils.detectXss('<img onload=evil()>')).toBe(true);
    });

    it('detects <iframe tag', () => {
      expect(SanitizationUtils.detectXss('<iframe src="evil.com">')).toBe(true);
    });

    it('returns false for normal text', () => {
      expect(SanitizationUtils.detectXss('Hello, this is a normal message.')).toBe(false);
    });

    it('returns false for plain URL without dangerous protocol', () => {
      expect(SanitizationUtils.detectXss('https://example.com')).toBe(false);
    });

    it('is case-insensitive for detection', () => {
      expect(SanitizationUtils.detectXss('JAVASCRIPT:alert(1)')).toBe(true);
      expect(SanitizationUtils.detectXss('<SCRIPT>evil</SCRIPT>')).toBe(true);
    });
  });

  // ----------------------------------------
  // checkRateLimit
  // ----------------------------------------

  describe('checkRateLimit', () => {
    // Use unique identifiers per test to avoid cross-test state pollution
    // since submissionAttempts is a module-level static Map.
    let testId: number;

    beforeEach(() => {
      testId = Date.now() + Math.floor(Math.random() * 1_000_000);
    });

    it('returns true on the first call', () => {
      const id = `test-first-${testId}`;
      expect(SanitizationUtils.checkRateLimit(id, 3, 60000)).toBe(true);
    });

    it('returns true while within the attempt limit', () => {
      const id = `test-within-${testId}`;
      expect(SanitizationUtils.checkRateLimit(id, 3, 60000)).toBe(true); // 1
      expect(SanitizationUtils.checkRateLimit(id, 3, 60000)).toBe(true); // 2
      expect(SanitizationUtils.checkRateLimit(id, 3, 60000)).toBe(true); // 3
    });

    it('returns false when the attempt limit is exceeded', () => {
      const id = `test-exceed-${testId}`;
      SanitizationUtils.checkRateLimit(id, 3, 60000); // 1
      SanitizationUtils.checkRateLimit(id, 3, 60000); // 2
      SanitizationUtils.checkRateLimit(id, 3, 60000); // 3 – at limit
      expect(SanitizationUtils.checkRateLimit(id, 3, 60000)).toBe(false); // 4 – over limit
    });

    it('resets and allows calls again after the window has expired', async () => {
      const id = `test-reset-${testId}`;
      // Fill to limit with a 1 ms window
      SanitizationUtils.checkRateLimit(id, 2, 1);
      SanitizationUtils.checkRateLimit(id, 2, 1);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should reset and allow again
      expect(SanitizationUtils.checkRateLimit(id, 2, 1)).toBe(true);
    });
  });

  // ----------------------------------------
  // generateNonce
  // ----------------------------------------

  describe('generateNonce', () => {
    it('returns a 32-character hex string', () => {
      const nonce = SanitizationUtils.generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(nonce)).toBe(true);
    });

    it('returns a different value on each call', () => {
      const nonce1 = SanitizationUtils.generateNonce();
      const nonce2 = SanitizationUtils.generateNonce();
      // Statistically safe to assert uniqueness for 16-byte random nonces
      expect(nonce1).not.toBe(nonce2);
    });
  });
});

// ============================================
// SanitizationPresets
// ============================================

describe('SanitizationPresets', () => {
  describe('strict', () => {
    it('delegates to sanitizeText — strips HTML and trims', () => {
      expect(SanitizationPresets.strict('<b>hello</b>')).toBe('hello');
      expect(SanitizationPresets.strict('  spaces  ')).toBe('spaces');
    });

    it('returns empty string for empty input', () => {
      expect(SanitizationPresets.strict('')).toBe('');
    });
  });

  describe('email', () => {
    it('delegates to sanitizeEmail — lowercases and validates', () => {
      expect(SanitizationPresets.email('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('returns empty string for invalid email', () => {
      expect(SanitizationPresets.email('not-valid')).toBe('');
    });
  });

  describe('message', () => {
    it('delegates to sanitizeMessage — removes dangerous content', () => {
      const result = SanitizationPresets.message('<script>evil</script>hello');
      expect(result).not.toContain('<script>');
      expect(result).toContain('hello');
    });

    it('returns empty string for empty input', () => {
      expect(SanitizationPresets.message('')).toBe('');
    });
  });

  describe('url', () => {
    it('delegates to sanitizeUrl — accepts safe URLs', () => {
      expect(SanitizationPresets.url('https://example.com')).toBe('https://example.com');
    });

    it('rejects dangerous protocols', () => {
      expect(SanitizationPresets.url('javascript:alert(1)')).toBe('');
    });
  });

  describe('phone', () => {
    it('delegates to sanitizePhone — strips HTML and keeps phone chars', () => {
      const result = SanitizationPresets.phone('+1 (555) 000-0000');
      expect(result).toContain('+1');
    });

    it('returns empty string for empty input', () => {
      expect(SanitizationPresets.phone('')).toBe('');
    });
  });
});
