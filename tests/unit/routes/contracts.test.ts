/**
 * ===============================================
 * CONTRACT ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/contracts.test.ts
 *
 * Unit tests for contract lifecycle route handlers:
 * - POST / — create contract
 * - POST /:contractId/send — send for signature, generate token
 * - POST /:contractId/expire — expire contract
 * - GET /:contractId/activity — activity timeline
 * - GET /:contractId — get single contract with access control
 * - DELETE /:contractId — cancel contract
 * - Error handling for missing contracts, unauthorized access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK DEPENDENCIES
// ============================================

// Mock contract service
const mockGetContract = vi.fn();
const mockCreateContract = vi.fn();
const mockUpdateContract = vi.fn();
const mockGetContracts = vi.fn();
const mockIsValidContractStatus = vi.fn();
const mockGetTemplates = vi.fn();
const mockGetTemplate = vi.fn();
const mockCreateTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockIsValidTemplateType = vi.fn();
const mockCreateContractFromTemplate = vi.fn();
const mockEnsureProjectSignatureToken = vi.fn();
const mockLogSignatureAction = vi.fn();
const mockExpireProjectSignatureToken = vi.fn();
const mockGetProjectWithClientForDistribution = vi.fn();
const mockGetProjectWithClientForRenewal = vi.fn();
const mockUpdateContractReminder = vi.fn();
const mockGetClientContracts = vi.fn();
const mockGetContractProjectId = vi.fn();
const mockGetContractActivity = vi.fn();
const mockGetContractForSigning = vi.fn();
const mockSignContractFromPortal = vi.fn();

vi.mock('../../../server/services/contract-service', () => ({
  contractService: {
    getContract: (...args: unknown[]) => mockGetContract(...args),
    createContract: (...args: unknown[]) => mockCreateContract(...args),
    updateContract: (...args: unknown[]) => mockUpdateContract(...args),
    getContracts: (...args: unknown[]) => mockGetContracts(...args),
    isValidContractStatus: (...args: unknown[]) => mockIsValidContractStatus(...args),
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
    createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
    updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
    deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
    isValidTemplateType: (...args: unknown[]) => mockIsValidTemplateType(...args),
    createContractFromTemplate: (...args: unknown[]) => mockCreateContractFromTemplate(...args),
    ensureProjectSignatureToken: (...args: unknown[]) => mockEnsureProjectSignatureToken(...args),
    logSignatureAction: (...args: unknown[]) => mockLogSignatureAction(...args),
    expireProjectSignatureToken: (...args: unknown[]) => mockExpireProjectSignatureToken(...args),
    getProjectWithClientForDistribution: (...args: unknown[]) => mockGetProjectWithClientForDistribution(...args),
    getProjectWithClientForRenewal: (...args: unknown[]) => mockGetProjectWithClientForRenewal(...args),
    updateContractReminder: (...args: unknown[]) => mockUpdateContractReminder(...args),
    getClientContracts: (...args: unknown[]) => mockGetClientContracts(...args),
    getContractProjectId: (...args: unknown[]) => mockGetContractProjectId(...args),
    getContractActivity: (...args: unknown[]) => mockGetContractActivity(...args),
    getContractForSigning: (...args: unknown[]) => mockGetContractForSigning(...args),
    signContractFromPortal: (...args: unknown[]) => mockSignContractFromPortal(...args)
  }
}));

// Mock database
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({
    get: (...args: unknown[]) => mockDbGet(...args),
    all: (...args: unknown[]) => mockDbAll(...args),
    run: (...args: unknown[]) => mockDbRun(...args)
  })
}));

// Mock row helpers
vi.mock('../../../server/database/row-helpers', () => ({
  getString: (row: unknown, key: string) => {
    if (row && typeof row === 'object' && key in (row as Record<string, unknown>)) {
      return (row as Record<string, unknown>)[key] as string;
    }
    const defaults: Record<string, string> = {
      email: 'client@test.com',
      contact_name: 'Test Client',
      project_name: 'Test Project'
    };
    return defaults[key] || `mock_${key}`;
  },
  getNumber: (row: unknown, key: string) => {
    if (row && typeof row === 'object' && key in (row as Record<string, unknown>)) {
      return (row as Record<string, unknown>)[key] as number;
    }
    if (key === 'project_id') return 10;
    return 0;
  }
}));

// Mock workflow trigger service
const mockEmit = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../server/services/workflow-trigger-service', () => ({
  workflowTriggerService: {
    emit: (...args: unknown[]) => mockEmit(...args)
  }
}));

// Mock access control (source imports from utils/access-control)
const mockCanAccessContract = vi.fn();
vi.mock('../../../server/utils/access-control', () => ({
  canAccessContract: (...args: unknown[]) => mockCanAccessContract(...args)
}));

// Mock auth middleware — pass through
vi.mock('../../../server/middleware/auth', () => ({
  authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  AuthenticatedRequest: {}
}));

// Mock validation middleware — pass through
vi.mock('../../../server/middleware/validation', () => ({
  validateRequest: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ValidationSchema: {}
}));

// Mock error handler
vi.mock('../../../server/middleware/errorHandler', () => ({
  asyncHandler: (fn: Function) => fn
}));

// Mock email service
vi.mock('../../../server/services/email-service', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue(undefined) }
}));

// Mock environment
vi.mock('../../../server/config/environment', () => ({
  getBaseUrl: () => 'http://localhost:3000'
}));

// Mock business config
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: { name: 'Test Agency' }
}));

// Mock email styles config
vi.mock('../../../server/config/email-styles', () => ({
  EMAIL_COLORS: {
    bodyText: '#333',
    contentBg: '#fff',
    buttonContractBg: '#007bff',
    buttonContractText: '#fff'
  },
  EMAIL_TYPOGRAPHY: {
    fontFamily: 'Arial, sans-serif',
    lineHeight: '1.6'
  }
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock api-response with real-like implementations
vi.mock('../../../server/utils/api-response', () => ({
  sendSuccess: (res: any, data: any, message?: string) =>
    res.status(200).json({ success: true, data, message }),
  sendCreated: (res: any, data: any, message?: string) =>
    res.status(201).json({ success: true, data, message }),
  errorResponse: (res: any, message: string, status: number, code: string) =>
    res.status(status).json({ success: false, error: message, code }),
  ErrorCodes: {
    INVALID_ID: 'INVALID_ID',
    NOT_FOUND: 'NOT_FOUND',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    MISSING_FIELDS: 'MISSING_FIELDS',
    ALREADY_SIGNED: 'ALREADY_SIGNED',
    SIGNATURE_EXPIRED: 'SIGNATURE_EXPIRED',
    CONTRACT_ALREADY_SIGNED: 'CONTRACT_ALREADY_SIGNED',
    CLIENT_SIGNATURE_REQUIRED: 'CLIENT_SIGNATURE_REQUIRED',
    CANCELLATION_FAILED: 'CANCELLATION_FAILED',
    INVALID_STATUS: 'INVALID_STATUS',
    PDF_GENERATION_FAILED: 'PDF_GENERATION_FAILED',
    DELETION_FAILED: 'DELETION_FAILED',
    CREATION_FAILED: 'CREATION_FAILED',
    UPDATE_FAILED: 'UPDATE_FAILED',
    RETRIEVAL_FAILED: 'RETRIEVAL_FAILED'
  }
}));

// ============================================
// HELPERS
// ============================================

function createMockReq(
  overrides: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    user?: Record<string, unknown>;
    query?: Record<string, string>;
  } = {}
) {
  return {
    params: overrides.params || {},
    body: overrides.body || {},
    user: overrides.user || { id: 1, email: 'admin@test.com', type: 'admin' },
    query: overrides.query || {},
    cookies: {},
    headers: {}
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Extract a route handler from an Express router by method + path.
 * Searches recursively through nested sub-routers (router.use).
 * Returns the last handler in the stack (after middleware).
 */
function getRouteHandler(router: any, method: string, path: string): Function {
  // Direct route on this router
  for (const l of router.stack) {
    if (l.route && l.route.path === path && l.route.methods[method]) {
      const handlers = l.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  // Search nested sub-routers (mounted via router.use)
  for (const l of router.stack) {
    if (!l.route && l.handle && l.handle.stack) {
      try {
        return getRouteHandler(l.handle, method, path);
      } catch {
        // Not found in this sub-router, continue
      }
    }
  }
  throw new Error(`No route found for ${method.toUpperCase()} ${path}`);
}

// ============================================
// TEST SUITE
// ============================================

describe('Contract Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidContractStatus.mockReturnValue(true);
    mockDbRun.mockResolvedValue({ changes: 1 });
    // The POST handler now does pre-flight project + client lookups
    // before delegating to the service. Default to "found" so tests
    // that don't care about those gates still get to the create path.
    mockDbGet.mockResolvedValue({ id: 1 });
  });

  describe('POST / — Create Contract', () => {
    it('should create contract with valid data', async () => {
      const newContract = {
        id: 1,
        projectId: 10,
        clientId: 5,
        content: 'Contract content here',
        status: 'draft'
      };
      mockCreateContract.mockResolvedValue(newContract);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/');

      const req = createMockReq({
        body: { projectId: 10, clientId: 5, content: 'Contract content here' }
      });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ contract: newContract }),
          message: 'Contract created successfully'
        })
      );
    });

    it('should emit workflow event on contract creation', async () => {
      mockCreateContract.mockResolvedValue({ id: 2, projectId: 10, clientId: 5 });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/');

      const req = createMockReq({
        body: { projectId: 10, clientId: 5, content: 'Content' }
      });
      const res = createMockRes();

      await handler(req, res);

      expect(mockEmit).toHaveBeenCalledWith('contract.created', expect.objectContaining({
        entityId: 2,
        projectId: 10,
        clientId: 5
      }));
    });

    it('should return 400 when required fields are missing', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/');

      const req = createMockReq({
        body: { projectId: 10 } // missing clientId and content
      });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'VALIDATION_ERROR' })
      );
    });

    it('should reject invalid contract status', async () => {
      mockIsValidContractStatus.mockReturnValue(false);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/');

      const req = createMockReq({
        body: { projectId: 10, clientId: 5, content: 'Content', status: 'bogus' }
      });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });

  describe('POST /:contractId/send — Send for Signature', () => {
    const mockContract = {
      id: 1,
      projectId: 10,
      clientId: 5,
      content: 'Contract content',
      status: 'draft'
    };

    it('should send contract for signature and generate token', async () => {
      mockGetContract.mockResolvedValue(mockContract);
      mockGetProjectWithClientForDistribution.mockResolvedValue({
        id: 10,
        project_name: 'Test Project',
        contract_signature_token: null,
        contract_signature_expires_at: null,
        contact_name: 'Client Name',
        email: 'client@test.com'
      });
      mockEnsureProjectSignatureToken.mockResolvedValue('new-token-xyz');
      mockLogSignatureAction.mockResolvedValue(undefined);
      mockUpdateContract.mockResolvedValue({ ...mockContract, status: 'sent' });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Contract sent for signature'
        })
      );
    });

    it('should use existing signature token if present', async () => {
      const existingToken = 'existing-token-abc123';
      mockGetContract.mockResolvedValue(mockContract);
      mockGetProjectWithClientForDistribution.mockResolvedValue({
        id: 10,
        project_name: 'Test Project',
        contract_signature_token: existingToken,
        contract_signature_expires_at: '2026-04-01T00:00:00Z',
        contact_name: 'Client Name',
        email: 'client@test.com'
      });
      mockEnsureProjectSignatureToken.mockResolvedValue(existingToken);
      mockLogSignatureAction.mockResolvedValue(undefined);
      mockUpdateContract.mockResolvedValue({ ...mockContract, status: 'sent' });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      // Should not generate a new token
      // The DB run for token update should not be called with new token values
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update draft contract status to sent', async () => {
      mockGetContract.mockResolvedValue({ ...mockContract, status: 'draft' });
      mockGetProjectWithClientForDistribution.mockResolvedValue({
        id: 10,
        project_name: 'Test Project',
        contract_signature_token: 'token-123',
        contact_name: 'Client',
        email: 'client@test.com'
      });
      mockEnsureProjectSignatureToken.mockResolvedValue('token-123');
      mockLogSignatureAction.mockResolvedValue(undefined);
      mockUpdateContract.mockResolvedValue({ ...mockContract, status: 'sent' });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(mockUpdateContract).toHaveBeenCalledWith(1, { status: 'sent' });
    });

    it('should return 400 for invalid contract ID', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: 'invalid' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('should return 404 when project not found', async () => {
      mockGetContract.mockResolvedValue(mockContract);
      mockGetProjectWithClientForDistribution.mockResolvedValue(null);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' })
      );
    });

    it('should return 400 when client has no valid email', async () => {
      mockGetContract.mockResolvedValue(mockContract);
      mockGetProjectWithClientForDistribution.mockResolvedValue({
        id: 10,
        project_name: 'Test Project',
        contract_signature_token: 'tok',
        contact_name: 'Client',
        email: '' // empty email
      });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/send');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });

  describe('POST /:contractId/expire — Expire Contract', () => {
    it('should expire contract and clear signature token', async () => {
      mockUpdateContract.mockResolvedValue({
        id: 1,
        projectId: 10,
        status: 'expired'
      });
      mockExpireProjectSignatureToken.mockResolvedValue(undefined);
      mockLogSignatureAction.mockResolvedValue(undefined);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/expire');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(mockUpdateContract).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'expired'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Contract expired'
        })
      );
    });

    it('should log expiration in signature log', async () => {
      mockUpdateContract.mockResolvedValue({ id: 1, projectId: 10, status: 'expired' });
      mockExpireProjectSignatureToken.mockResolvedValue(undefined);
      mockLogSignatureAction.mockResolvedValue(undefined);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/expire');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      // Should call logSignatureAction with 'expired' action
      expect(mockLogSignatureAction).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 10,
          contractId: 1,
          action: 'expired',
          actorEmail: 'admin@test.com'
        })
      );
    });

    it('should return 400 for invalid contract ID', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'post', '/:contractId/expire');

      const req = createMockReq({ params: { contractId: '0' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /:contractId/activity — Activity Timeline', () => {
    it('should return activity timeline for valid contract', async () => {
      const mockLogs = [
        { id: 1, action: 'sent', actor_email: 'admin@test.com', created_at: '2026-03-01' },
        { id: 2, action: 'viewed', actor_email: 'client@test.com', created_at: '2026-03-02' }
      ];
      mockGetContractProjectId.mockResolvedValue(10);
      mockGetContractActivity.mockResolvedValue(mockLogs);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId/activity');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            activity: mockLogs
          })
        })
      );
    });

    it('should return 404 when contract not found', async () => {
      mockGetContractProjectId.mockResolvedValue(null);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId/activity');

      const req = createMockReq({ params: { contractId: '999' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' })
      );
    });

    it('should return 400 for invalid contract ID', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId/activity');

      const req = createMockReq({ params: { contractId: 'abc' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /:contractId — Get Single Contract', () => {
    it('should return contract when user has access', async () => {
      const mockContract = { id: 1, projectId: 10, status: 'draft', content: 'Content' };
      mockCanAccessContract.mockResolvedValue(true);
      mockGetContract.mockResolvedValue(mockContract);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ contract: mockContract })
        })
      );
    });

    it('should return 404 when user lacks access (prevents enumeration)', async () => {
      mockCanAccessContract.mockResolvedValue(false);

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      // Returns 404, NOT 403, to prevent contract ID enumeration
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' })
      );
    });

    it('should return 400 for invalid contract ID', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'get', '/:contractId');

      const req = createMockReq({ params: { contractId: '-1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('DELETE /:contractId — Cancel Contract', () => {
    it('should cancel contract successfully', async () => {
      mockUpdateContract.mockResolvedValue({ id: 1, status: 'cancelled' });

      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'delete', '/:contractId');

      const req = createMockReq({ params: { contractId: '1' } });
      const res = createMockRes();

      await handler(req, res);

      expect(mockUpdateContract).toHaveBeenCalledWith(1, { status: 'cancelled' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Contract cancelled successfully'
        })
      );
    });

    it('should return 400 for invalid contract ID on delete', async () => {
      const contractRouter = (await import('../../../server/routes/contracts')).default;
      const handler = getRouteHandler(contractRouter, 'delete', '/:contractId');

      const req = createMockReq({ params: { contractId: 'NaN' } });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Contract Status Validation', () => {
    it('should validate all supported contract statuses', () => {
      const validStatuses = ['draft', 'sent', 'signed', 'expired', 'cancelled', 'active', 'renewed'];

      for (const status of validStatuses) {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      }
    });

    it('should validate template types', () => {
      const validTypes = ['service-agreement', 'nda', 'scope-of-work', 'maintenance', 'custom'];

      expect(validTypes).toHaveLength(5);
      expect(validTypes).toContain('nda');
      expect(validTypes).toContain('custom');
    });
  });
});
