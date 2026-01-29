/**
 * ===============================================
 * AUTH SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/auth-service.test.ts
 *
 * Unit tests for client-side authentication service.
 * AuthService delegates to authStore; we mock authStore.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from '../../../src/services/auth-service';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockIsAuthenticated = vi.fn();

vi.mock('../../../src/auth', () => ({
  authStore: {
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    getCurrentUser: () => mockGetCurrentUser(),
    isAuthenticated: () => mockIsAuthenticated(),
    refreshSession: vi.fn().mockResolvedValue(true),
    validateSession: vi.fn().mockResolvedValue(true),
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    subscribe: vi.fn(),
    getSessionTimeRemaining: vi.fn(),
    extendSession: vi.fn(),
    clearError: vi.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
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
        role: 'client' as const,
      };
      mockLogin.mockResolvedValueOnce({ success: true, data: mockUser });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle login failure', async () => {
      mockLogin.mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle network errors', async () => {
      mockLogin.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

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
      mockLogout.mockResolvedValueOnce(undefined);

      await authService.logout();

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when authenticated', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test Company',
        contactName: 'Test User',
        status: 'active',
      };
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockIsAuthenticated.mockReturnValue(true);

      expect(authService.getCurrentUser()).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      mockGetCurrentUser.mockReturnValue(null);
      mockIsAuthenticated.mockReturnValue(false);

      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', () => {
      mockIsAuthenticated.mockReturnValue(true);

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      mockIsAuthenticated.mockReturnValue(false);

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('loadStoredUser', () => {
    it('should reflect user when authStore has user', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        companyName: 'Test Company',
        contactName: 'Test User',
        status: 'active',
      };
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockIsAuthenticated.mockReturnValue(true);

      const service = new AuthService();

      expect(service.getCurrentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should reflect unauthenticated when authStore has no user', () => {
      mockGetCurrentUser.mockReturnValue(null);
      mockIsAuthenticated.mockReturnValue(false);

      const service = new AuthService();

      expect(service.getCurrentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
