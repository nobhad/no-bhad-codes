/**
 * ===============================================
 * AUTH SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/auth-service.test.ts
 *
 * Unit tests for client-side authentication service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from '../../../src/services/auth-service';

// Mock fetch
global.fetch = vi.fn();

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
    sessionStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test Company',
        contactName: 'Test User',
        status: 'active',
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: 'Login successful',
          user: mockUser,
          expiresIn: '7d',
        }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );
      expect(sessionStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle login failure', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Logged out' }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // Set user first
      authService['user'] = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test',
        contactName: 'Test',
        status: 'active',
      };
      authService['isAuth'] = true;

      await authService.logout();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
      expect(sessionStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('should return user when authenticated', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test Company',
        contactName: 'Test User',
        status: 'active',
      };

      // Access private properties using bracket notation
      (authService as any).user = mockUser;
      (authService as any).isAuth = true;

      expect(authService.getUser()).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      (authService as any).user = null;
      (authService as any).isAuth = false;

      expect(authService.getUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', () => {
      authService['isAuth'] = true;
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      authService['isAuth'] = false;
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('loadStoredUser', () => {
    it('should load user from sessionStorage', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test Company',
        contactName: 'Test User',
        status: 'active',
      };

      sessionStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

      const newService = new AuthService();

      expect(newService.getUser()).toEqual(mockUser);
      expect(newService.isAuthenticated()).toBe(true);
    });

    it('should handle invalid stored user data', () => {
      sessionStorageMock.getItem.mockReturnValue('invalid-json');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const newService = new AuthService();

      expect(newService.getUser()).toBeNull();
      expect(newService.isAuthenticated()).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
