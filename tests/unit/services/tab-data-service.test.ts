/**
 * ===============================================
 * TAB DATA SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/tab-data-service.test.ts
 *
 * Unit tests for tab-data-service: fetcher dispatch,
 * role-based guards, caching, and table definitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDbAll = vi.fn().mockResolvedValue([]);
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({
    all: mockDbAll,
    get: vi.fn(),
    run: vi.fn()
  })
}));

// Mock cache service
const mockCacheGet = vi.fn().mockResolvedValue(null);
const mockCacheSet = vi.fn().mockResolvedValue(true);
const mockCacheInvalidateByPattern = vi.fn().mockResolvedValue(0);
const mockCacheInvalidateByTag = vi.fn().mockResolvedValue(0);

vi.mock('../../../server/services/cache-service', () => ({
  cacheService: {
    get: mockCacheGet,
    set: mockCacheSet,
    invalidateByPattern: mockCacheInvalidateByPattern,
    invalidateByTag: mockCacheInvalidateByTag
  }
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Tab Data Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockCacheGet.mockResolvedValue(null);
  });

  describe('hasTabDataFetcher', () => {
    it('should return true for registered tab IDs', async () => {
      const { hasTabDataFetcher } = await import('../../../server/services/tab-data-service');
      expect(hasTabDataFetcher('admin-clients')).toBe(true);
      expect(hasTabDataFetcher('admin-contacts')).toBe(true);
      expect(hasTabDataFetcher('portal-invoices')).toBe(true);
      expect(hasTabDataFetcher('admin-invoices')).toBe(true);
      expect(hasTabDataFetcher('admin-projects')).toBe(true);
      expect(hasTabDataFetcher('admin-leads')).toBe(true);
    });

    it('should return false for unknown tab IDs', async () => {
      const { hasTabDataFetcher } = await import('../../../server/services/tab-data-service');
      expect(hasTabDataFetcher('nonexistent')).toBe(false);
      expect(hasTabDataFetcher('')).toBe(false);
      expect(hasTabDataFetcher('portal-projects')).toBe(false);
    });
  });

  describe('getServerTableDef', () => {
    it('should return table definition for valid tab IDs', async () => {
      const { getServerTableDef } = await import('../../../server/services/tab-data-service');

      const clientsDef = getServerTableDef('admin-clients');
      expect(clientsDef).toBeDefined();
      expect(clientsDef?.id).toBe('admin-clients');
      expect(clientsDef?.title).toBe('Clients');
      expect(clientsDef?.portal).toBe('admin');
      expect(clientsDef?.columns).toBeDefined();
      expect(clientsDef?.columns.length).toBeGreaterThan(0);
    });

    it('should return undefined for unknown tab IDs', async () => {
      const { getServerTableDef } = await import('../../../server/services/tab-data-service');
      expect(getServerTableDef('nonexistent')).toBeUndefined();
    });

    it('should have correct portal assignments for role enforcement', async () => {
      const { getServerTableDef } = await import('../../../server/services/tab-data-service');

      expect(getServerTableDef('admin-clients')?.portal).toBe('admin');
      expect(getServerTableDef('admin-contacts')?.portal).toBe('admin');
      expect(getServerTableDef('admin-invoices')?.portal).toBe('admin');
      expect(getServerTableDef('admin-projects')?.portal).toBe('admin');
      expect(getServerTableDef('admin-leads')?.portal).toBe('admin');
      expect(getServerTableDef('portal-invoices')?.portal).toBe('client');
    });
  });

  describe('fetchTabData', () => {
    it('should return null for unknown tab IDs', async () => {
      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('nonexistent', 'admin', 1);
      expect(result).toBeNull();
    });

    it('should return cached data on cache hit', async () => {
      const cachedData = { rows: [{ id: 1, name: 'Cached' }], stats: { total: 1 } };
      mockCacheGet.mockResolvedValueOnce(cachedData);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('admin-clients', 'admin', 1);

      expect(result).toEqual(cachedData);
      expect(mockDbAll).not.toHaveBeenCalled();
    });

    it('should fetch from DB on cache miss and write to cache', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, company_name: 'Test Co', contact_name: 'John', email: 'john@test.com', status: 'active', client_type: 'business', created_at: '2024-01-01' }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('admin-clients', 'admin', 1);

      expect(result).toBeDefined();
      expect(result?.rows.length).toBe(1);
      expect(mockCacheSet).toHaveBeenCalled();
    });

    it('should throw when client role tries to fetch admin tab', async () => {
      mockCacheGet.mockResolvedValueOnce(null);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      await expect(fetchTabData('admin-clients', 'client', 42)).rejects.toThrow('Forbidden: admin-only data');
    });

    it('should throw when client role tries to fetch admin-contacts', async () => {
      mockCacheGet.mockResolvedValueOnce(null);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      await expect(fetchTabData('admin-contacts', 'client', 42)).rejects.toThrow('Forbidden: admin-only data');
    });

    it('should throw when client role tries to fetch admin-invoices', async () => {
      mockCacheGet.mockResolvedValueOnce(null);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      await expect(fetchTabData('admin-invoices', 'client', 42)).rejects.toThrow('Forbidden: admin-only data');
    });

    it('should throw when client role tries to fetch admin-projects', async () => {
      mockCacheGet.mockResolvedValueOnce(null);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      await expect(fetchTabData('admin-projects', 'client', 42)).rejects.toThrow('Forbidden: admin-only data');
    });

    it('should allow client role to fetch portal-invoices with userId scoping', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, invoice_number: 'INV-001', status: 'paid', amount: 500, due_date: '2024-02-01', created_at: '2024-01-01' }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('portal-invoices', 'client', 42);

      expect(result).toBeDefined();
      expect(result?.rows.length).toBe(1);
      // Verify userId was passed to the query
      expect(mockDbAll).toHaveBeenCalledWith(expect.any(String), [42]);
    });

    it('should use different cache keys for admin vs client tabs', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockDbAll.mockResolvedValue([]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');

      await fetchTabData('admin-clients', 'admin', 1);
      // Admin cache key should NOT include userId
      expect(mockCacheGet).toHaveBeenCalledWith('tab-data:admin-clients');

      vi.clearAllMocks();
      mockCacheGet.mockResolvedValue(null);
      mockDbAll.mockResolvedValue([]);

      await fetchTabData('portal-invoices', 'client', 42);
      // Client cache key SHOULD include userId
      expect(mockCacheGet).toHaveBeenCalledWith('tab-data:portal-invoices:42');
    });
  });

  describe('fetchAdminClients data transformation', () => {
    it('should use company_name for business clients', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, company_name: 'Acme Corp', contact_name: 'John', email: 'j@acme.com', status: 'active', client_type: 'business', created_at: '2024-01-01', projectCount: 2, invoiceCount: 3 }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('admin-clients', 'admin', 1);

      expect(result?.rows[0].name).toBe('Acme Corp');
    });

    it('should use contact_name for personal clients', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, company_name: '', contact_name: 'Jane Doe', email: 'j@test.com', status: 'active', client_type: 'personal', created_at: '2024-01-01', projectCount: 0, invoiceCount: 0 }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('admin-clients', 'admin', 1);

      expect(result?.rows[0].name).toBe('Jane Doe');
    });

    it('should compute correct stats', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, company_name: 'A', contact_name: '', status: 'active', client_type: 'business', created_at: '2024-01-01' },
        { id: 2, company_name: 'B', contact_name: '', status: 'inactive', client_type: 'business', created_at: '2024-01-02' },
        { id: 3, company_name: 'C', contact_name: '', status: 'active', client_type: 'business', created_at: '2024-01-03' }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('admin-clients', 'admin', 1);

      expect(result?.stats.total).toBe(3);
      expect(result?.stats.active).toBe(2);
      expect(result?.stats.inactive).toBe(1);
    });
  });

  describe('fetchPortalInvoices stats computation', () => {
    it('should compute outstanding and paid totals', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockDbAll.mockResolvedValueOnce([
        { id: 1, invoice_number: 'INV-001', status: 'paid', amount: 500 },
        { id: 2, invoice_number: 'INV-002', status: 'sent', amount: 300 },
        { id: 3, invoice_number: 'INV-003', status: 'overdue', amount: 200 }
      ]);

      const { fetchTabData } = await import('../../../server/services/tab-data-service');
      const result = await fetchTabData('portal-invoices', 'client', 1);

      expect(result?.stats.paid).toBe(500);
      expect(result?.stats.outstanding).toBe(500); // 300 + 200
      expect(result?.stats.total).toBe(3);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate by tab ID pattern', async () => {
      const { invalidateTabDataCache } = await import('../../../server/services/tab-data-service');
      await invalidateTabDataCache('admin-clients');
      expect(mockCacheInvalidateByPattern).toHaveBeenCalledWith('*tab-data:admin-clients*');
    });

    it('should invalidate all tab data by tag', async () => {
      const { invalidateAllTabDataCache } = await import('../../../server/services/tab-data-service');
      await invalidateAllTabDataCache();
      expect(mockCacheInvalidateByTag).toHaveBeenCalledWith('tab-data');
    });

    it('should invalidate user-specific cache', async () => {
      const { invalidateUserTabDataCache } = await import('../../../server/services/tab-data-service');
      await invalidateUserTabDataCache(42);
      expect(mockCacheInvalidateByPattern).toHaveBeenCalledWith('*tab-data:*:42');
    });
  });
});
