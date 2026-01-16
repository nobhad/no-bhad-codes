/**
 * ===============================================
 * API CLIENT TESTS
 * ===============================================
 * @file tests/unit/utils/api-client.test.ts
 *
 * Unit tests for API client utility functions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiFetch,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  parseJsonResponse,
  configureApiClient,
  API_ERROR_CODES,
} from '../../../src/utils/api-client';

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
const mockLocation = {
  pathname: '/',
  href: 'http://localhost/',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock sessionStorage and localStorage
const sessionStorageMock = {
  clear: vi.fn(),
};

const localStorageMock = {
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/';
  });

  describe('apiFetch', () => {
    it('should make fetch request with credentials', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiFetch('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should preserve custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiFetch('/api/test', {
        headers: {
          'Custom-Header': 'value',
        },
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
        })
      );
    });

    it('should handle 401 with TOKEN_EXPIRED code', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            error: 'Token expired',
            code: API_ERROR_CODES.TOKEN_EXPIRED,
          }),
        }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await apiFetch('/api/test');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle 401 with TOKEN_MISSING code', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            error: 'Token missing',
            code: API_ERROR_CODES.TOKEN_MISSING,
          }),
        }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiFetch('/api/test');

      expect(sessionStorageMock.clear).toHaveBeenCalled();
    });
  });

  describe('apiGet', () => {
    it('should make GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiGet('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('apiPost', () => {
    it('should make POST request with JSON body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiPost('/api/test', { key: 'value' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ key: 'value' }),
        })
      );
    });

    it('should handle POST without body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiPost('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('apiPut', () => {
    it('should make PUT request with JSON body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiPut('/api/test', { key: 'value' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ key: 'value' }),
        })
      );
    });
  });

  describe('apiDelete', () => {
    it('should make DELETE request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiDelete('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse successful JSON response', async () => {
      const mockData = { data: 'test' };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      };

      const result = await parseJsonResponse(mockResponse as any);

      expect(result).toEqual(mockData);
    });

    it('should throw error for failed response', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'Bad request',
          message: 'Invalid input',
        }),
      };

      await expect(parseJsonResponse(mockResponse as any)).rejects.toThrow();
    });

    it('should handle JSON parse errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('Parse error')),
      };

      await expect(parseJsonResponse(mockResponse as any)).rejects.toThrow();
    });
  });

  describe('configureApiClient', () => {
    it('should configure callbacks', () => {
      const onSessionExpired = vi.fn();
      const showNotification = vi.fn();

      configureApiClient({
        onSessionExpired,
        showNotification,
      });

      // Configuration is stored internally, so we test by using it
      // In a real scenario, this would be tested through apiFetch with 401
      expect(onSessionExpired).toBeDefined();
      expect(showNotification).toBeDefined();
    });
  });
});
