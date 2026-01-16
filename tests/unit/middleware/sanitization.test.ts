/**
 * ===============================================
 * SANITIZATION MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/sanitization.test.ts
 *
 * Unit tests for input sanitization middleware.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  sanitizeString,
  sanitizeObject,
  sanitizeInputs,
  sanitize,
  stripDangerousPatterns,
} from '../../../server/middleware/sanitization';

describe('Sanitization Functions', () => {
  describe('sanitizeString', () => {
    it('should encode HTML entities', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should handle ampersands', () => {
      expect(sanitizeString('A & B')).toBe('A &amp; B');
    });

    it('should handle quotes', () => {
      expect(sanitizeString('"quoted"')).toBe('&quot;quoted&quot;');
      expect(sanitizeString("'single'")).toBe('&#x27;single&#x27;');
    });

    it('should handle equals signs', () => {
      expect(sanitizeString('key=value')).toBe('key&#x3D;value');
    });

    it('should return non-string values as-is', () => {
      expect(sanitizeString(null as any)).toBe(null);
      expect(sanitizeString(123 as any)).toBe(123);
      expect(sanitizeString(undefined as any)).toBe(undefined);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in objects', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
      };
      const result = sanitizeObject(input);
      expect(result.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
      expect(result.email).toBe('test@example.com');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>', 'normal', '<img>'];
      const result = sanitizeObject(input);
      expect(result).toEqual(['&lt;script&gt;', 'normal', '&lt;img&gt;']);
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<script>',
          profile: {
            bio: '<img src=x>',
          },
        },
      };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('&lt;script&gt;');
      expect(result.user.profile.bio).toBe('&lt;img src&#x3D;x&gt;');
    });

    it('should skip password fields', () => {
      const input = {
        password: '<script>alert("xss")</script>',
        password_hash: '<hash>',
        token: '<token>',
        normal: '<script>',
      };
      const result = sanitizeObject(input);
      expect(result.password).toBe('<script>alert("xss")</script>');
      expect(result.password_hash).toBe('<hash>');
      expect(result.token).toBe('<token>');
      expect(result.normal).toBe('&lt;script&gt;');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should preserve numbers and booleans', () => {
      const input = {
        count: 42,
        active: true,
        name: '<script>',
      };
      const result = sanitizeObject(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.name).toBe('&lt;script&gt;');
    });
  });

  describe('sanitizeInputs middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        body: {},
        query: {},
        params: {},
        path: '/test',
      };
      mockRes = {};
      mockNext = vi.fn() as unknown as NextFunction;
    });

    it('should sanitize request body', () => {
      mockReq.body = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
      };

      const middleware = sanitizeInputs();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        search: '<script>',
        page: '1',
      };

      const middleware = sanitizeInputs();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query.search).toBe('&lt;script&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize URL parameters', () => {
      mockReq.params = {
        id: '<script>',
      };

      const middleware = sanitizeInputs();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params.id).toBe('&lt;script&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip sanitization for specified paths', () => {
      mockReq.path = '/api/upload';
      mockReq.body = {
        name: '<script>',
      };

      const middleware = sanitizeInputs({ skipPaths: ['/api/upload'] });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('<script>');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockReq.body = null;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const middleware = sanitizeInputs();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('sanitize', () => {
    it('should sanitize any value', () => {
      expect(sanitize('<script>')).toBe('&lt;script&gt;');
      expect(sanitize({ name: '<script>' })).toEqual({ name: '&lt;script&gt;' });
      expect(sanitize(['<script>'])).toEqual(['&lt;script&gt;']);
    });
  });

  describe('stripDangerousPatterns', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      expect(stripDangerousPatterns(input)).toBe('Hello');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click</div>';
      expect(stripDangerousPatterns(input)).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      expect(stripDangerousPatterns(input)).not.toContain('javascript:');
    });

    it('should remove data: URLs', () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">';
      expect(stripDangerousPatterns(input)).not.toContain('data:text/html');
    });

    it('should apply standard sanitization after stripping', () => {
      const input = '<div>Hello</div>';
      const result = stripDangerousPatterns(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should handle non-string input', () => {
      expect(stripDangerousPatterns(null as any)).toBe(null);
      expect(stripDangerousPatterns(123 as any)).toBe(123);
    });
  });
});
