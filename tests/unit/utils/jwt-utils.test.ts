/**
 * ===============================================
 * JWT UTILS TESTS
 * ===============================================
 * @file tests/unit/utils/jwt-utils.test.ts
 *
 * Unit tests for JWT utility functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  decodeJwtPayload,
  isTokenExpired,
  isAdminPayload,
  isAdminToken,
  getTokenTimeRemaining,
  validateToken,
  JwtPayload,
} from '../../../src/utils/jwt-utils';

describe('JWT Utils', () => {
  describe('decodeJwtPayload', () => {
    it('should decode valid JWT token', () => {
      // Create a valid JWT token (header.payload.signature)
      const payload = { id: 1, email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const result = decodeJwtPayload(token);

      expect(result).toEqual(payload);
    });

    it('should return null for invalid token format', () => {
      expect(decodeJwtPayload('invalid-token')).toBeNull();
      expect(decodeJwtPayload('only.two.parts')).toBeNull();
      expect(decodeJwtPayload('one')).toBeNull();
    });

    it('should return null for invalid base64 payload', () => {
      const token = 'header.invalid-base64!.signature';
      expect(decodeJwtPayload(token)).toBeNull();
    });

    it('should return null for invalid JSON in payload', () => {
      const invalidJson = btoa('not valid json');
      const token = `header.${invalidJson}.signature`;
      expect(decodeJwtPayload(token)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const payload = { id: 1 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });
  });

  describe('isAdminPayload', () => {
    it('should return true when isAdmin is true', () => {
      const payload: JwtPayload = { isAdmin: true };
      expect(isAdminPayload(payload)).toBe(true);
    });

    it('should return true when type is admin', () => {
      const payload: JwtPayload = { type: 'admin' };
      expect(isAdminPayload(payload)).toBe(true);
    });

    it('should return false for non-admin payload', () => {
      const payload: JwtPayload = { type: 'client', isAdmin: false };
      expect(isAdminPayload(payload)).toBe(false);
    });

    it('should return false when neither isAdmin nor type is set', () => {
      const payload: JwtPayload = { id: 1 };
      expect(isAdminPayload(payload)).toBe(false);
    });
  });

  describe('isAdminToken', () => {
    it('should return true for admin token', () => {
      const payload = { isAdmin: true, exp: Math.floor(Date.now() / 1000) + 3600 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(isAdminToken(token)).toBe(true);
    });

    it('should return false for non-admin token', () => {
      const payload = { type: 'client', exp: Math.floor(Date.now() / 1000) + 3600 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(isAdminToken(token)).toBe(false);
    });

    it('should return false for invalid token', () => {
      expect(isAdminToken('invalid-token')).toBe(false);
    });
  });

  describe('getTokenTimeRemaining', () => {
    it('should return remaining time for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const remaining = getTokenTimeRemaining(token);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(3600 * 1000); // Less than or equal to 1 hour
    });

    it('should return 0 for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const payload = { exp: pastExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(getTokenTimeRemaining(token)).toBe(0);
    });

    it('should return 0 for token without exp claim', () => {
      const payload = { id: 1 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(getTokenTimeRemaining(token)).toBe(0);
    });

    it('should return 0 for invalid token', () => {
      expect(getTokenTimeRemaining('invalid-token')).toBe(0);
    });
  });

  describe('validateToken', () => {
    it('should return valid for non-expired token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { id: 1, exp: futureExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const result = validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.payload).toEqual(payload);
    });

    it('should return invalid for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const payload = { id: 1, exp: pastExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const result = validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it('should return invalid for token without exp', () => {
      const payload = { id: 1 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const result = validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it('should return invalid for malformed token', () => {
      const result = validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.payload).toBeNull();
    });
  });
});
