/**
 * ===============================================
 * UNIT TESTS - AD HOC REQUEST SERVICE
 * ===============================================
 * @file tests/unit/services/ad-hoc-request-service.test.ts
 *
 * Tests for ad hoc request service including:
 * - CRUD operations (getRequests, getRequest, createRequest, updateRequest, softDeleteRequest)
 * - Filter logic in getRequests
 * - Status/type/priority/urgency validation
 * - convertedBy user lookup
 * - Validator methods (isValidStatus, isValidType, isValidPriority, isValidUrgency)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(42)
  }
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the entity mapper so toAdHocRequest is a simple pass-through
vi.mock('../../../server/database/entities/index', () => ({
  toAdHocRequest: vi.fn((row) => ({
    id: row.id,
    projectId: row.project_id,
    clientId: row.client_id,
    title: row.title,
    description: row.description,
    status: row.status,
    requestType: row.request_type,
    priority: row.priority,
    urgency: row.urgency,
    estimatedHours: row.estimated_hours ?? null,
    flatRate: row.flat_rate ?? null,
    hourlyRate: row.hourly_rate ?? null,
    quotedPrice: row.quoted_price ?? null,
    attachmentFileId: row.attachment_file_id ?? null,
    taskId: row.task_id ?? null,
    convertedAt: row.converted_at ?? null,
    convertedBy: row.converted_by ?? null,
    clientName: row.client_name ?? null,
    clientEmail: row.client_email ?? null,
    projectName: row.project_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null
  }))
}));

// Import after mocks
import { adHocRequestService } from '../../../server/services/ad-hoc-request-service';
import { userService } from '../../../server/services/user-service';

// ============================================
// FIXTURES
// ============================================

const baseRow = {
  id: 1,
  project_id: 10,
  client_id: 20,
  title: 'Fix the login bug',
  description: 'Users cannot log in on mobile',
  status: 'submitted',
  request_type: 'bug_fix',
  priority: 'high',
  urgency: 'urgent',
  estimated_hours: 4,
  flat_rate: null,
  hourly_rate: null,
  quoted_price: null,
  attachment_file_id: null,
  task_id: null,
  converted_at: null,
  converted_by: null,
  client_name: 'Acme Corp',
  client_email: 'client@acme.com',
  project_name: 'Acme Portal',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  deleted_by: null
};

// ============================================
// TESTS
// ============================================

describe('AdHocRequestService', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(42);
  });

  // ============================================
  // getRequests
  // ============================================

  describe('getRequests', () => {
    it('returns all non-deleted requests with no filters', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      const results = await adHocRequestService.getRequests();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fix the login bug');
      expect(mockDb.all).toHaveBeenCalledOnce();

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('deleted_at IS NULL');
    });

    it('includes deleted records when includeDeleted is true', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ includeDeleted: true });

      const [query] = mockDb.all.mock.calls[0];
      // The WHERE clause should not filter by ad_hoc_requests.deleted_at (JOIN conditions still use deleted_at)
      expect(query).not.toContain('ad_hoc_requests.deleted_at IS NULL');
    });

    it('filters by projectId', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ projectId: 10 });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('project_id = ?');
      expect(params).toContain(10);
    });

    it('filters by clientId', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ clientId: 20 });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('client_id = ?');
      expect(params).toContain(20);
    });

    it('filters by status', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ status: 'reviewing' });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('status = ?');
      expect(params).toContain('reviewing');
    });

    it('filters by requestType', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ requestType: 'feature' });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('request_type = ?');
      expect(params).toContain('feature');
    });

    it('filters by priority', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ priority: 'urgent' });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('priority = ?');
      expect(params).toContain('urgent');
    });

    it('filters by urgency', async () => {
      mockDb.all.mockResolvedValueOnce([baseRow]);

      await adHocRequestService.getRequests({ urgency: 'emergency' });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('urgency = ?');
      expect(params).toContain('emergency');
    });

    it('combines multiple filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await adHocRequestService.getRequests({ projectId: 10, status: 'approved', priority: 'high' });

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('project_id = ?');
      expect(query).toContain('status = ?');
      expect(query).toContain('priority = ?');
      expect(params).toEqual(expect.arrayContaining([10, 'approved', 'high']));
    });

    it('returns empty array when no records found', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const results = await adHocRequestService.getRequests();

      expect(results).toHaveLength(0);
    });
  });

  // ============================================
  // getRequest
  // ============================================

  describe('getRequest', () => {
    it('returns a request by id', async () => {
      mockDb.get.mockResolvedValueOnce(baseRow);

      const result = await adHocRequestService.getRequest(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Fix the login bug');

      const [query] = mockDb.get.mock.calls[0];
      expect(query).toContain('deleted_at IS NULL');
    });

    it('includes deleted records when includeDeleted is true', async () => {
      mockDb.get.mockResolvedValueOnce({ ...baseRow, deleted_at: '2026-02-01T00:00:00Z' });

      const result = await adHocRequestService.getRequest(1, true);

      expect(result.id).toBe(1);
      const [query] = mockDb.get.mock.calls[0];
      // When includeDeleted=true, WHERE clause ends with just the id param (no AND deleted_at IS NULL)
      expect(query).not.toMatch(/id = \? AND deleted_at IS NULL/);
    });

    it('throws when request is not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(adHocRequestService.getRequest(999)).rejects.toThrow('Ad hoc request not found');
    });
  });

  // ============================================
  // createRequest
  // ============================================

  describe('createRequest', () => {
    const validCreateData = {
      projectId: 10,
      clientId: 20,
      title: 'New Feature',
      description: 'Add dark mode',
      requestType: 'feature' as const,
      priority: 'normal' as const,
      urgency: 'normal' as const
    };

    it('creates a request with valid data and defaults', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 5 });
      mockDb.get.mockResolvedValueOnce({ ...baseRow, id: 5, title: 'New Feature' });

      const result = await adHocRequestService.createRequest(validCreateData);

      expect(result.id).toBe(5);
      expect(mockDb.run).toHaveBeenCalledOnce();

      const [, params] = mockDb.run.mock.calls[0];
      expect(params).toContain('submitted'); // default status
      expect(params).toContain('normal');    // priority
      expect(params).toContain('normal');    // urgency
    });

    it('uses provided status, priority, urgency when given', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 6 });
      mockDb.get.mockResolvedValueOnce({ ...baseRow, id: 6 });

      await adHocRequestService.createRequest({
        ...validCreateData,
        status: 'reviewing',
        priority: 'high',
        urgency: 'urgent'
      });

      const [, params] = mockDb.run.mock.calls[0];
      expect(params).toContain('reviewing');
      expect(params).toContain('high');
      expect(params).toContain('urgent');
    });

    it('throws on invalid status', async () => {
      await expect(
        adHocRequestService.createRequest({ ...validCreateData, status: 'invalid_status' as never })
      ).rejects.toThrow('Invalid ad hoc request status');
    });

    it('throws on invalid requestType', async () => {
      await expect(
        adHocRequestService.createRequest({ ...validCreateData, requestType: 'bad_type' as never })
      ).rejects.toThrow('Invalid ad hoc request type');
    });

    it('throws on invalid priority', async () => {
      await expect(
        adHocRequestService.createRequest({ ...validCreateData, priority: 'critical' as never })
      ).rejects.toThrow('Invalid ad hoc request priority');
    });

    it('throws on invalid urgency', async () => {
      await expect(
        adHocRequestService.createRequest({ ...validCreateData, urgency: 'super_urgent' as never })
      ).rejects.toThrow('Invalid ad hoc request urgency');
    });

    it('passes nullable optional fields as null', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 7 });
      mockDb.get.mockResolvedValueOnce({ ...baseRow, id: 7 });

      await adHocRequestService.createRequest(validCreateData);

      const [, params] = mockDb.run.mock.calls[0];
      // estimatedHours, flatRate, hourlyRate, quotedPrice, attachmentFileId all null
      expect(params[8]).toBeNull();
      expect(params[9]).toBeNull();
      expect(params[10]).toBeNull();
      expect(params[11]).toBeNull();
      expect(params[12]).toBeNull();
    });

    it('accepts all valid status values', async () => {
      const statuses = ['submitted', 'reviewing', 'quoted', 'approved', 'in_progress', 'completed', 'declined'] as const;

      for (const status of statuses) {
        mockDb.run.mockResolvedValueOnce({ lastID: 1 });
        mockDb.get.mockResolvedValueOnce(baseRow);

        await expect(
          adHocRequestService.createRequest({ ...validCreateData, status })
        ).resolves.toBeDefined();
      }
    });
  });

  // ============================================
  // updateRequest
  // ============================================

  describe('updateRequest', () => {
    it('returns existing request without db update when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(baseRow);

      const result = await adHocRequestService.updateRequest(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('updates title and description', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce({ ...baseRow, title: 'Updated Title' });

      const result = await adHocRequestService.updateRequest(1, {
        title: 'Updated Title',
        description: 'New desc'
      });

      expect(mockDb.run).toHaveBeenCalledOnce();
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('title = ?');
      expect(query).toContain('description = ?');
      expect(params).toContain('Updated Title');
      expect(params).toContain('New desc');
      expect(result.title).toBe('Updated Title');
    });

    it('updates projectId and clientId', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, { projectId: 99, clientId: 88 });

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('project_id = ?');
      expect(query).toContain('client_id = ?');
      expect(params).toContain(99);
      expect(params).toContain(88);
    });

    it('throws on invalid status in update', async () => {
      await expect(
        adHocRequestService.updateRequest(1, { status: 'bad_status' as never })
      ).rejects.toThrow('Invalid ad hoc request status');
    });

    it('throws on invalid requestType in update', async () => {
      await expect(
        adHocRequestService.updateRequest(1, { requestType: 'bad_type' as never })
      ).rejects.toThrow('Invalid ad hoc request type');
    });

    it('throws on invalid priority in update', async () => {
      await expect(
        adHocRequestService.updateRequest(1, { priority: 'critical' as never })
      ).rejects.toThrow('Invalid ad hoc request priority');
    });

    it('throws on invalid urgency in update', async () => {
      await expect(
        adHocRequestService.updateRequest(1, { urgency: 'flash' as never })
      ).rejects.toThrow('Invalid ad hoc request urgency');
    });

    it('updates convertedBy and looks up userId when value is truthy', async () => {
      vi.mocked(userService.getUserIdByEmail).mockResolvedValueOnce(42);
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, { convertedBy: 'admin@example.com' });

      expect(userService.getUserIdByEmail).toHaveBeenCalledWith('admin@example.com');
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('converted_by = ?');
      expect(query).toContain('converted_by_user_id = ?');
      expect(params).toContain('admin@example.com');
      expect(params).toContain(42);
    });

    it('sets converted_by_user_id to null when convertedBy is null', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, { convertedBy: null });

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('converted_by_user_id = ?');
      expect(params).toContain(null);
      expect(userService.getUserIdByEmail).not.toHaveBeenCalled();
    });

    it('updates nullable numeric fields', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, {
        estimatedHours: null,
        flatRate: 500,
        hourlyRate: null,
        quotedPrice: 750
      });

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('estimated_hours = ?');
      expect(query).toContain('flat_rate = ?');
      expect(query).toContain('hourly_rate = ?');
      expect(query).toContain('quoted_price = ?');
      expect(params).toContain(500);
      expect(params).toContain(750);
    });

    it('updates taskId, convertedAt, and attachmentFileId', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, {
        taskId: 99,
        convertedAt: '2026-01-15T00:00:00Z',
        attachmentFileId: 7
      });

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('task_id = ?');
      expect(query).toContain('converted_at = ?');
      expect(query).toContain('attachment_file_id = ?');
      expect(params).toContain(99);
      expect(params).toContain('2026-01-15T00:00:00Z');
      expect(params).toContain(7);
    });

    it('always appends updated_at to the update query', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(baseRow);

      await adHocRequestService.updateRequest(1, { title: 'X' });

      const [query] = mockDb.run.mock.calls[0];
      expect(query).toContain("updated_at = datetime('now')");
    });
  });

  // ============================================
  // softDeleteRequest
  // ============================================

  describe('softDeleteRequest', () => {
    it('soft deletes a request with a deletedBy value', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await adHocRequestService.softDeleteRequest(1, 'admin@example.com');

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('deleted_at = datetime');
      expect(query).toContain('deleted_by = ?');
      expect(params).toEqual(['admin@example.com', 1]);
    });

    it('soft deletes with null deletedBy', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await adHocRequestService.softDeleteRequest(5, null);

      const [, params] = mockDb.run.mock.calls[0];
      expect(params[0]).toBeNull();
      expect(params[1]).toBe(5);
    });
  });

  // ============================================
  // Validator methods
  // ============================================

  describe('isValidStatus', () => {
    it('returns true for all valid statuses', () => {
      const validStatuses = ['submitted', 'reviewing', 'quoted', 'approved', 'in_progress', 'completed', 'declined'];
      for (const s of validStatuses) {
        expect(adHocRequestService.isValidStatus(s)).toBe(true);
      }
    });

    it('returns false for invalid status', () => {
      expect(adHocRequestService.isValidStatus('pending')).toBe(false);
      expect(adHocRequestService.isValidStatus('')).toBe(false);
      expect(adHocRequestService.isValidStatus('unknown')).toBe(false);
    });
  });

  describe('isValidType', () => {
    it('returns true for all valid types', () => {
      const validTypes = ['feature', 'change', 'bug_fix', 'enhancement', 'support'];
      for (const t of validTypes) {
        expect(adHocRequestService.isValidType(t)).toBe(true);
      }
    });

    it('returns false for invalid type', () => {
      expect(adHocRequestService.isValidType('task')).toBe(false);
      expect(adHocRequestService.isValidType('')).toBe(false);
    });
  });

  describe('isValidPriority', () => {
    it('returns true for all valid priorities', () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      for (const p of validPriorities) {
        expect(adHocRequestService.isValidPriority(p)).toBe(true);
      }
    });

    it('returns false for invalid priority', () => {
      expect(adHocRequestService.isValidPriority('critical')).toBe(false);
      expect(adHocRequestService.isValidPriority('')).toBe(false);
    });
  });

  describe('isValidUrgency', () => {
    it('returns true for all valid urgency levels', () => {
      const validUrgencies = ['normal', 'priority', 'urgent', 'emergency'];
      for (const u of validUrgencies) {
        expect(adHocRequestService.isValidUrgency(u)).toBe(true);
      }
    });

    it('returns false for invalid urgency', () => {
      expect(adHocRequestService.isValidUrgency('flash')).toBe(false);
      expect(adHocRequestService.isValidUrgency('')).toBe(false);
    });
  });
});
