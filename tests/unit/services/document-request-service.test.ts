/**
 * ===============================================
 * UNIT TESTS - DOCUMENT REQUEST SERVICE
 * ===============================================
 * @file tests/unit/services/document-request-service.test.ts
 *
 * Tests for document request management service including:
 * - Request CRUD (create, get, update status, delete)
 * - Status transitions (view, upload, review, approve, reject)
 * - Reminder tracking
 * - Template CRUD and category grouping
 * - History logging
 * - Admin and client stats
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
    getUserIdByEmail: vi.fn().mockResolvedValue(99),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(99)
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

// Import service after mocks
import { documentRequestService } from '../../../server/services/document-request-service';
import type {
  DocumentRequest,
  DocumentRequestTemplate,
  DocumentRequestHistory
} from '../../../server/services/document-request-service';
import { userService } from '../../../server/services/user-service';
import { logger } from '../../../server/services/logger';

// ============================================
// Shared Test Factories
// ============================================

const makeRequest = (overrides: Partial<DocumentRequest> = {}): DocumentRequest => ({
  id: 1,
  client_id: 10,
  project_id: 5,
  requested_by: 'admin@example.com',
  title: 'Tax Return 2025',
  description: 'Please upload your tax return',
  document_type: 'general',
  priority: 'normal',
  status: 'requested',
  due_date: '2026-06-01',
  file_id: undefined,
  uploaded_by: undefined,
  uploaded_at: undefined,
  reviewed_by: undefined,
  reviewed_at: undefined,
  review_notes: undefined,
  rejection_reason: undefined,
  approved_file_id: undefined,
  is_required: true,
  reminder_sent_at: undefined,
  reminder_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  client_name: 'Acme Corp',
  project_name: 'Q1 Audit',
  file_name: undefined,
  ...overrides
});

const makeTemplate = (overrides: Partial<DocumentRequestTemplate> = {}): DocumentRequestTemplate => ({
  id: 1,
  name: 'Standard ID',
  title: 'Government-Issued ID',
  description: 'Please provide a government-issued photo ID',
  document_type: 'identification',
  is_required: true,
  days_until_due: 7,
  category: 'legal',
  project_type: 'onboarding',
  created_by: 'admin@example.com',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeHistory = (overrides: Partial<DocumentRequestHistory> = {}): DocumentRequestHistory => ({
  id: 1,
  request_id: 1,
  action: 'created',
  old_status: undefined,
  new_status: 'requested',
  actor_email: 'admin@example.com',
  actor_type: 'admin',
  notes: undefined,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// ============================================
// REQUEST MANAGEMENT
// ============================================

describe('DocumentRequestService - createRequest', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('creates a request with all provided data', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT request
    mockDb.run.mockResolvedValueOnce({}); // INSERT history
    mockDb.get.mockResolvedValueOnce(makeRequest()); // getRequest

    const result = await documentRequestService.createRequest({
      client_id: 10,
      project_id: 5,
      requested_by: 'admin@example.com',
      title: 'Tax Return 2025',
      description: 'Upload your tax return',
      document_type: 'general',
      priority: 'high',
      due_date: '2026-06-01',
      is_required: true
    });

    expect(result).not.toBeNull();
    expect(result.title).toBe('Tax Return 2025');
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('defaults document_type to general and priority to normal', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'Something'
    });

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams).toContain('general');
    expect(insertParams).toContain('normal');
  });

  it('defaults project_id to null when not provided', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ project_id: undefined }));

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'No Project'
    });

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[1]).toBeNull(); // project_id
  });

  it('sets is_required to 1 by default', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'Required Doc'
    });

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[9]).toBe(1); // is_required
  });

  it('sets is_required to 0 when explicitly false', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ is_required: false }));

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'Optional Doc',
      is_required: false
    });

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[9]).toBe(0);
  });

  it('looks up requested_by user ID', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'Doc'
    });

    expect(userService.getUserIdByEmail).toHaveBeenCalledWith('admin@example.com');
    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[3]).toBe(99); // requested_by_user_id
  });

  it('logs creation history with correct values', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 7 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.createRequest({
      client_id: 10,
      requested_by: 'admin@example.com',
      title: 'Doc'
    });

    const historyParams = mockDb.run.mock.calls[1][1];
    expect(historyParams[0]).toBe(7); // request_id
    expect(historyParams[1]).toBe('created'); // action
    expect(historyParams[3]).toBe('requested'); // new_status
    expect(historyParams[4]).toBe('admin@example.com'); // actor_email
    expect(historyParams[5]).toBe('admin'); // actor_type
  });
});

describe('DocumentRequestService - createFromTemplates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('skips templates that are not found', async () => {
    mockDb.get.mockResolvedValueOnce(null); // getTemplate returns null

    const result = await documentRequestService.createFromTemplates(10, [999], 'admin@example.com');
    expect(result).toHaveLength(0);
  });

  it('creates requests from valid template IDs', async () => {
    const template = makeTemplate({ days_until_due: 7 });
    // getTemplate
    mockDb.get.mockResolvedValueOnce(template);
    // createRequest: INSERT
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // createRequest: logHistory INSERT
    mockDb.run.mockResolvedValueOnce({});
    // createRequest: getRequest
    mockDb.get.mockResolvedValueOnce(makeRequest());

    const result = await documentRequestService.createFromTemplates(
      10,
      [1],
      'admin@example.com',
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Tax Return 2025');
  });

  it('calculates due date from days_until_due', async () => {
    const template = makeTemplate({ days_until_due: 14 });
    mockDb.get.mockResolvedValueOnce(template);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.createFromTemplates(10, [1], 'admin@example.com');

    const insertParams = mockDb.run.mock.calls[0][1];
    const dueDate = insertParams[8] as string;
    // Should be a date string 14 days from now
    expect(dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('processes multiple templates in order', async () => {
    const template1 = makeTemplate({ id: 1, title: 'Doc A' });
    const template2 = makeTemplate({ id: 2, title: 'Doc B' });

    mockDb.get.mockResolvedValueOnce(template1);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ title: 'Doc A' }));

    mockDb.get.mockResolvedValueOnce(template2);
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ title: 'Doc B' }));

    const result = await documentRequestService.createFromTemplates(10, [1, 2], 'admin@example.com');
    expect(result).toHaveLength(2);
  });
});

describe('DocumentRequestService - getRequest', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a request by ID', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest());
    const result = await documentRequestService.getRequest(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it('returns null when not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const result = await documentRequestService.getRequest(999);
    expect(result).toBeNull();
  });
});

describe('DocumentRequestService - getClientRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all requests for a client without status filter', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest(), makeRequest({ id: 2 })]);
    const result = await documentRequestService.getClientRequests(10);
    expect(result).toHaveLength(2);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.not.stringContaining('dr.status = ?'),
      [10]
    );
  });

  it('filters by status when provided', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest()]);
    await documentRequestService.getClientRequests(10, 'uploaded');

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('dr.status = ?'),
      [10, 'uploaded']
    );
  });
});

describe('DocumentRequestService - getAllRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all requests without status filter', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest()]);
    const result = await documentRequestService.getAllRequests();
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.not.stringContaining('WHERE dr.status = ?'),
      []
    );
  });

  it('filters by status when provided', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest({ status: 'approved' })]);
    await documentRequestService.getAllRequests('approved');

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE dr.status = ?'),
      ['approved']
    );
  });
});

describe('DocumentRequestService - getAdminStats', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns admin stats with all fields', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 10, pending: 3, uploaded: 2, approved: 4, overdue: 1
    });

    const result = await documentRequestService.getAdminStats();
    expect(result.total).toBe(10);
    expect(result.pending).toBe(3);
    expect(result.uploaded).toBe(2);
    expect(result.approved).toBe(4);
    expect(result.overdue).toBe(1);
  });

  it('defaults all fields to 0 when stats are null/undefined', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await documentRequestService.getAdminStats();
    expect(result.total).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.uploaded).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.overdue).toBe(0);
  });
});

describe('DocumentRequestService - getPendingRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns pending requests ordered by priority', async () => {
    const pending = [makeRequest({ priority: 'urgent' }), makeRequest({ id: 2, priority: 'low' })];
    mockDb.all.mockResolvedValueOnce(pending);

    const result = await documentRequestService.getPendingRequests();
    expect(result).toHaveLength(2);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('requested', 'viewed', 'uploaded', 'under_review')")
    );
  });
});

describe('DocumentRequestService - getRequestsForReview', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns requests with uploaded status', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest({ status: 'uploaded' })]);
    const result = await documentRequestService.getRequestsForReview();
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("status = 'uploaded'")
    );
  });
});

// ============================================
// STATUS TRANSITIONS
// ============================================

describe('DocumentRequestService - markViewed', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(documentRequestService.markViewed(999, 'client@example.com')).rejects.toThrow(
      'Document request not found'
    );
  });

  it('updates status from requested to viewed', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'requested' }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE status
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'viewed' }));

    const result = await documentRequestService.markViewed(1, 'client@example.com');
    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('viewed');
  });

  it('does not update status when already past requested', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded' }));
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded' }));

    await documentRequestService.markViewed(1, 'client@example.com');
    // No db.run calls since status is not 'requested'
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});

describe('DocumentRequestService - uploadDocument', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(documentRequestService.uploadDocument(999, 1, 'client@example.com')).rejects.toThrow(
      'Document request not found'
    );
  });

  it('updates file_id, uploaded_by and status to uploaded', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'viewed' }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded', file_id: 42 }));

    const result = await documentRequestService.uploadDocument(1, 42, 'client@example.com');
    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(userService.getUserIdByEmail).toHaveBeenCalledWith('client@example.com');
    expect(result.status).toBe('uploaded');
  });

  it('passes old status to logHistory', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'viewed' }));
    mockDb.run.mockResolvedValueOnce({});
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded' }));

    await documentRequestService.uploadDocument(1, 5, 'client@example.com');

    const historyParams = mockDb.run.mock.calls[1][1];
    expect(historyParams[2]).toBe('viewed'); // old_status
    expect(historyParams[3]).toBe('uploaded'); // new_status
  });
});

describe('DocumentRequestService - startReview', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(documentRequestService.startReview(999, 'admin@example.com')).rejects.toThrow(
      'Document request not found'
    );
  });

  it('throws when request status is not uploaded', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'requested' }));
    await expect(documentRequestService.startReview(1, 'admin@example.com')).rejects.toThrow(
      'Request must be uploaded before review'
    );
  });

  it('transitions status to under_review when uploaded', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded' }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'under_review' }));

    const result = await documentRequestService.startReview(1, 'admin@example.com');
    expect(result.status).toBe('under_review');
    expect(userService.getUserIdByEmail).toHaveBeenCalledWith('admin@example.com');
  });
});

describe('DocumentRequestService - approveRequest', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(documentRequestService.approveRequest(999, 'admin@example.com')).rejects.toThrow(
      'Document request not found'
    );
  });

  it('approves request without a file', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ file_id: undefined }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'approved' }));

    const { request, approvedFileId } = await documentRequestService.approveRequest(1, 'admin@example.com');
    expect(request.status).toBe('approved');
    expect(approvedFileId).toBeNull();
  });

  it('copies file to files tab when file_id is present', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ file_id: 10, project_id: 5 }));
    // copyFileToFilesTab: db.get (original file)
    mockDb.get.mockResolvedValueOnce({
      id: 10, project_id: 5, filename: 'doc.pdf', original_filename: 'Tax Return.pdf',
      file_path: '/uploads/doc.pdf', file_size: 1024, mime_type: 'application/pdf', file_type: 'document'
    });
    // copyFileToFilesTab: db.run (INSERT new file)
    mockDb.run.mockResolvedValueOnce({ lastID: 20 });
    // approveRequest: UPDATE document_requests
    mockDb.run.mockResolvedValueOnce({});
    // approveRequest: logHistory
    mockDb.run.mockResolvedValueOnce({});
    // getRequest
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'approved', approved_file_id: 20 }));

    const { request, approvedFileId } = await documentRequestService.approveRequest(1, 'admin@example.com', 'Looks good');
    expect(approvedFileId).toBe(20);
    expect(request.status).toBe('approved');
    expect(logger.info).toHaveBeenCalled();
  });

  it('returns null approvedFileId when original file not found in DB', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ file_id: 10, project_id: 5 }));
    mockDb.get.mockResolvedValueOnce(undefined); // original file not found
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'approved' }));

    const { approvedFileId } = await documentRequestService.approveRequest(1, 'admin@example.com');
    expect(approvedFileId).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns null approvedFileId when no project_id on request', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ file_id: 10, project_id: undefined }));
    mockDb.get.mockResolvedValueOnce({
      id: 10, filename: 'doc.pdf', original_filename: 'doc.pdf',
      file_path: '/uploads/doc.pdf', file_size: 1024, mime_type: 'application/pdf', file_type: 'document'
    });
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'approved' }));

    const { approvedFileId } = await documentRequestService.approveRequest(1, 'admin@example.com');
    expect(approvedFileId).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('DocumentRequestService - rejectRequest', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(
      documentRequestService.rejectRequest(999, 'admin@example.com', 'Wrong document')
    ).rejects.toThrow('Document request not found');
  });

  it('rejects a request and updates status', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'uploaded' }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'rejected', rejection_reason: 'Wrong document' }));

    const result = await documentRequestService.rejectRequest(1, 'admin@example.com', 'Wrong document');
    expect(result.status).toBe('rejected');

    const updateParams = mockDb.run.mock.calls[0][1];
    expect(updateParams).toContain('Wrong document'); // rejection_reason
    expect(userService.getUserIdByEmail).toHaveBeenCalledWith('admin@example.com');
  });

  it('logs history with correct old and new status', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'under_review' }));
    mockDb.run.mockResolvedValueOnce({});
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'rejected' }));

    await documentRequestService.rejectRequest(1, 'admin@example.com', 'Blurry image');

    const historyParams = mockDb.run.mock.calls[1][1];
    expect(historyParams[1]).toBe('rejected'); // action
    expect(historyParams[2]).toBe('under_review'); // old_status
    expect(historyParams[3]).toBe('rejected'); // new_status
    expect(historyParams[6]).toBe('Blurry image'); // notes
  });
});

describe('DocumentRequestService - deleteRequest', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('deletes a request by ID', async () => {
    mockDb.run.mockResolvedValueOnce({});
    await documentRequestService.deleteRequest(1);
    expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM document_requests WHERE id = ?', [1]);
  });
});

describe('DocumentRequestService - sendReminder', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when request not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    await expect(documentRequestService.sendReminder(999)).rejects.toThrow(
      'Document request not found'
    );
  });

  it('increments reminder count and updates reminder_sent_at', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'requested', reminder_count: 1 }));
    mockDb.run.mockResolvedValueOnce({}); // UPDATE
    mockDb.run.mockResolvedValueOnce({}); // logHistory
    mockDb.get.mockResolvedValueOnce(makeRequest({ reminder_count: 2 }));

    const result = await documentRequestService.sendReminder(1);
    expect(mockDb.run).toHaveBeenCalledTimes(2);

    const updateSql = mockDb.run.mock.calls[0][0] as string;
    expect(updateSql).toContain('reminder_count = reminder_count + 1');
  });

  it('logs history with system actor', async () => {
    mockDb.get.mockResolvedValueOnce(makeRequest({ status: 'requested' }));
    mockDb.run.mockResolvedValueOnce({});
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    await documentRequestService.sendReminder(1);

    const historyParams = mockDb.run.mock.calls[1][1];
    expect(historyParams[1]).toBe('reminder_sent'); // action
    expect(historyParams[4]).toBe('system'); // actor_email
    expect(historyParams[5]).toBe('system'); // actor_type
  });
});

describe('DocumentRequestService - getOverdueRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns overdue requests', async () => {
    const overdue = [makeRequest({ due_date: '2025-01-01', status: 'requested' })];
    mockDb.all.mockResolvedValueOnce(overdue);
    const result = await documentRequestService.getOverdueRequests();
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("due_date < date('now')")
    );
  });
});

describe('DocumentRequestService - getProjectPendingRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns non-terminal requests for a project', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest()]);
    const result = await documentRequestService.getProjectPendingRequests(5);
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("status NOT IN ('approved', 'rejected')"),
      [5]
    );
  });
});

describe('DocumentRequestService - getClientPendingRequests', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns requested/viewed requests for a client', async () => {
    mockDb.all.mockResolvedValueOnce([makeRequest()]);
    const result = await documentRequestService.getClientPendingRequests(10);
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('requested', 'viewed')"),
      [10]
    );
  });
});

// ============================================
// TEMPLATES
// ============================================

describe('DocumentRequestService - getTemplates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all document request templates', async () => {
    mockDb.all.mockResolvedValueOnce([makeTemplate()]);
    const result = await documentRequestService.getTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Standard ID');
  });

  it('returns empty array when no templates exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await documentRequestService.getTemplates();
    expect(result).toEqual([]);
  });
});

describe('DocumentRequestService - getTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a template by ID', async () => {
    mockDb.get.mockResolvedValueOnce(makeTemplate());
    const result = await documentRequestService.getTemplate(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it('returns null when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const result = await documentRequestService.getTemplate(999);
    expect(result).toBeNull();
  });
});

describe('DocumentRequestService - createTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('creates a template with defaults', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeTemplate());

    const result = await documentRequestService.createTemplate({
      name: 'Standard ID',
      title: 'Government-Issued ID'
    });

    expect(result).not.toBeNull();
    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams).toContain('general'); // default document_type
    expect(insertParams).toContain(1); // is_required default
    expect(insertParams).toContain(7); // days_until_due default
  });

  it('uses provided document_type, is_required, and days_until_due', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeTemplate());

    await documentRequestService.createTemplate({
      name: 'Bank Statement',
      title: 'Bank Statement',
      document_type: 'source',
      is_required: false,
      days_until_due: 14,
      created_by: 'admin@example.com'
    });

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams).toContain('source');
    expect(insertParams).toContain(0); // is_required = false => 0
    expect(insertParams).toContain(14);
    expect(insertParams).toContain('admin@example.com');
  });
});

describe('DocumentRequestService - updateTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const result = await documentRequestService.updateTemplate(999, { name: 'New Name' });
    expect(result).toBeNull();
  });

  it('updates the template and returns updated data', async () => {
    const existing = makeTemplate();
    mockDb.get
      .mockResolvedValueOnce(existing) // getTemplate in update
      .mockResolvedValueOnce(makeTemplate({ name: 'Updated' })); // final getTemplate
    mockDb.run.mockResolvedValueOnce({});

    const result = await documentRequestService.updateTemplate(1, { name: 'Updated' });
    expect(result).not.toBeNull();
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('falls back to existing values for unset fields', async () => {
    const existing = makeTemplate({ name: 'Old Name', title: 'Old Title' });
    mockDb.get
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(makeTemplate({ name: 'Old Name', title: 'Old Title' }));
    mockDb.run.mockResolvedValueOnce({});

    await documentRequestService.updateTemplate(1, {});

    const updateParams = mockDb.run.mock.calls[0][1];
    expect(updateParams[0]).toBe('Old Name'); // name falls back
    expect(updateParams[1]).toBe('Old Title'); // title falls back
  });

  it('handles is_required update to false (sets 0)', async () => {
    const existing = makeTemplate({ is_required: true });
    mockDb.get
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(makeTemplate({ is_required: false }));
    mockDb.run.mockResolvedValueOnce({});

    await documentRequestService.updateTemplate(1, { is_required: false });

    const updateParams = mockDb.run.mock.calls[0][1];
    expect(updateParams[4]).toBe(0); // is_required = false => 0
  });
});

describe('DocumentRequestService - deleteTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('deletes a template by ID', async () => {
    mockDb.run.mockResolvedValueOnce({});
    await documentRequestService.deleteTemplate(1);
    expect(mockDb.run).toHaveBeenCalledWith(
      'DELETE FROM document_request_templates WHERE id = ?',
      [1]
    );
  });
});

// ============================================
// TEMPLATE CATEGORIES
// ============================================

describe('DocumentRequestService - getTemplatesByCategory', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns templates grouped by their category', async () => {
    mockDb.all.mockResolvedValueOnce([
      makeTemplate({ category: 'legal' }),
      makeTemplate({ id: 2, name: 'Logo', category: 'brand_assets' })
    ]);

    const result = await documentRequestService.getTemplatesByCategory();
    expect(result.legal).toHaveLength(1);
    expect(result.brand_assets).toHaveLength(1);
    expect(result.general).toHaveLength(0);
    expect(result.content).toHaveLength(0);
    expect(result.technical).toHaveLength(0);
  });

  it('falls back to general category when category is undefined', async () => {
    mockDb.all.mockResolvedValueOnce([
      makeTemplate({ category: undefined as unknown as 'general' })
    ]);

    const result = await documentRequestService.getTemplatesByCategory();
    expect(result.general).toHaveLength(1);
  });

  it('returns all predefined category buckets even when empty', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await documentRequestService.getTemplatesByCategory();
    expect(result).toHaveProperty('general');
    expect(result).toHaveProperty('brand_assets');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('legal');
    expect(result).toHaveProperty('technical');
  });
});

describe('DocumentRequestService - getTemplatesByProjectType', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns templates for a given project type', async () => {
    mockDb.all.mockResolvedValueOnce([makeTemplate({ project_type: 'onboarding' })]);
    const result = await documentRequestService.getTemplatesByProjectType('onboarding');
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('project_type = ? OR project_type IS NULL'),
      ['onboarding']
    );
  });
});

describe('DocumentRequestService - bulkRequestByProjectType', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(99);
  });

  it('creates requests for all templates of a project type', async () => {
    const templates = [makeTemplate({ id: 1 }), makeTemplate({ id: 2, is_required: false })];
    mockDb.all.mockResolvedValueOnce(templates);

    // For createFromTemplates with ids [1, 2]:
    mockDb.get.mockResolvedValueOnce(templates[0]); // getTemplate(1)
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ id: 1 }));

    mockDb.get.mockResolvedValueOnce(templates[1]); // getTemplate(2)
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest({ id: 2 }));

    const result = await documentRequestService.bulkRequestByProjectType(
      10, 'onboarding', 'admin@example.com'
    );
    expect(result).toHaveLength(2);
  });

  it('filters to required-only when requiredOnly is true', async () => {
    const templates = [
      makeTemplate({ id: 1, is_required: true }),
      makeTemplate({ id: 2, is_required: false })
    ];
    mockDb.all.mockResolvedValueOnce(templates);

    // Only template 1 (required) should be processed
    mockDb.get.mockResolvedValueOnce(templates[0]);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRequest());

    const result = await documentRequestService.bulkRequestByProjectType(
      10, 'onboarding', 'admin@example.com', undefined, true
    );
    expect(result).toHaveLength(1);
  });
});

// ============================================
// HISTORY
// ============================================

describe('DocumentRequestService - getRequestHistory', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns history entries for a request', async () => {
    const history = [
      makeHistory({ action: 'approved' }),
      makeHistory({ id: 2, action: 'uploaded' })
    ];
    mockDb.all.mockResolvedValueOnce(history);

    const result = await documentRequestService.getRequestHistory(1);
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('approved');
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE request_id = ?'),
      [1]
    );
  });

  it('returns empty array when no history exists', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await documentRequestService.getRequestHistory(1);
    expect(result).toEqual([]);
  });
});

// ============================================
// STATS
// ============================================

describe('DocumentRequestService - getClientStats', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns client stats with all fields populated', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 5, pending: 2, uploaded: 1, approved: 1, rejected: 1, overdue: 0
    });

    const result = await documentRequestService.getClientStats(10);
    expect(result.total).toBe(5);
    expect(result.pending).toBe(2);
    expect(result.uploaded).toBe(1);
    expect(result.approved).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.overdue).toBe(0);
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE client_id = ?'),
      [10]
    );
  });

  it('defaults all stats to 0 when result is null', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const result = await documentRequestService.getClientStats(10);
    expect(result.total).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.uploaded).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.overdue).toBe(0);
  });
});
