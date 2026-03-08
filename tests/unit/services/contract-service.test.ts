/**
 * ===============================================
 * UNIT TESTS - CONTRACT SERVICE
 * ===============================================
 * @file tests/unit/services/contract-service.test.ts
 *
 * Tests for the contract management service including:
 * - Template CRUD (getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate)
 * - Contract CRUD (getContracts, getContract, createContract, updateContract)
 * - Contract-from-template creation
 * - Signature lifecycle (requestSignature, getContractBySignatureToken,
 *   recordSignature, recordCountersignature, expireSignatureRequest, getSignatureInfo)
 * - Validation helpers (isValidTemplateType, isValidContractStatus)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =====================================================
// Mock setup must precede service import
// =====================================================

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock entity mappers for predictable output
vi.mock('../../../server/database/entities/index', () => ({
  toContractTemplate: vi.fn((row) => ({
    id: row?.id ?? 1,
    name: row?.name ?? 'Template',
    type: row?.type ?? 'standard',
    content: row?.content ?? '',
    variables: row?.variables ? JSON.parse(row.variables) : [],
    isDefault: Boolean(row?.is_default),
    isActive: Boolean(row?.is_active ?? 1),
    createdAt: row?.created_at ?? '',
    updatedAt: row?.updated_at ?? ''
  })),
  toContract: vi.fn((row) => ({
    id: row?.id ?? 1,
    templateId: row?.template_id ?? null,
    projectId: row?.project_id ?? 1,
    clientId: row?.client_id ?? 1,
    content: row?.content ?? '',
    status: row?.status ?? 'draft',
    variables: row?.variables ?? null,
    parentContractId: row?.parent_contract_id ?? null,
    renewalAt: row?.renewal_at ?? null,
    sentAt: row?.sent_at ?? null,
    signedAt: row?.signed_at ?? null,
    expiresAt: row?.expires_at ?? null,
    signatureToken: row?.signature_token ?? null,
    signatureRequestedAt: row?.signature_requested_at ?? null,
    signatureExpiresAt: row?.signature_expires_at ?? null,
    signerName: row?.signer_name ?? null,
    signerEmail: row?.signer_email ?? null,
    signerIp: row?.signer_ip ?? null,
    countersignedAt: row?.countersigned_at ?? null,
    countersignerName: row?.countersigner_name ?? null,
    countersignerEmail: row?.countersigner_email ?? null,
    countersignerIp: row?.countersigner_ip ?? null,
    signedPdfPath: row?.signed_pdf_path ?? null,
    createdAt: row?.created_at ?? '',
    updatedAt: row?.updated_at ?? ''
  }))
}));

// Mock contract variable utilities
vi.mock('../../../server/utils/contract-variables', () => ({
  applyContractVariables: vi.fn((template: string, vars: Record<string, string>) => {
    return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match: string, key: string) => vars[key] ?? _match);
  }),
  getDefaultContractVariables: vi.fn(() => ['client.name', 'project.name', 'date.today']),
  resolveContractVariables: vi.fn(() => ({
    'client.name': 'Test Client',
    'project.name': 'Test Project',
    'date.today': '2026-01-01'
  }))
}));

// Mock business config (avoids reading .env during tests)
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'Test Business',
    owner: 'Test Owner',
    contact: 'Test Contact',
    email: 'test@business.com',
    website: 'testbusiness.com'
  }
}));

vi.mock('../../../server/database/row-helpers', () => ({
  getString: vi.fn((row, key) => (row && row[key] != null ? String(row[key]) : ''))
}));

// Import after mocks
import { contractService } from '../../../server/services/contract-service';

// =====================================================
// Shared fixtures
// =====================================================

const makeTemplateRow = (overrides = {}) => ({
  id: 1,
  name: 'Standard Contract',
  type: 'standard',
  content: 'Hello {{ client.name }}, welcome to {{ project.name }}.',
  variables: JSON.stringify(['client.name', 'project.name']),
  is_default: 1,
  is_active: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeContractRow = (overrides = {}) => ({
  id: 1,
  template_id: 1,
  project_id: 10,
  client_id: 5,
  content: 'Hello Test Client.',
  status: 'draft',
  variables: null,
  parent_contract_id: null,
  renewal_at: null,
  sent_at: null,
  signed_at: null,
  expires_at: null,
  signature_token: null,
  signature_requested_at: null,
  signature_expires_at: null,
  signer_name: null,
  signer_email: null,
  signer_ip: null,
  countersigned_at: null,
  countersigner_name: null,
  countersigner_email: null,
  countersigner_ip: null,
  signed_pdf_path: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// =====================================================
// TEMPLATE TESTS
// =====================================================

describe('ContractService - Templates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getTemplates', () => {
    it('returns all active templates when no type filter', async () => {
      mockDb.all.mockResolvedValueOnce([makeTemplateRow(), makeTemplateRow({ id: 2, name: 'NDA' })]);

      const result = await contractService.getTemplates();

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_active = TRUE'),
        []
      );
    });

    it('filters templates by type when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeTemplateRow()]);

      const result = await contractService.getTemplates('standard');

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND type = ?'),
        ['standard']
      );
    });

    it('returns empty array when no templates found', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await contractService.getTemplates('nda');

      expect(result).toHaveLength(0);
    });

    it('orders by is_default DESC then name ASC', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await contractService.getTemplates();

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY is_default DESC, name ASC'),
        expect.any(Array)
      );
    });
  });

  describe('getTemplate', () => {
    it('returns a template by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      const result = await contractService.getTemplate(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Standard Contract');
    });

    it('throws when template not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(contractService.getTemplate(999)).rejects.toThrow('Template not found');
    });
  });

  describe('createTemplate', () => {
    it('creates a template with provided variables', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.get.mockResolvedValueOnce(makeTemplateRow()); // getTemplate

      const result = await contractService.createTemplate({
        name: 'Standard Contract',
        type: 'standard',
        content: 'Hello {{ client.name }}',
        variables: ['client.name'],
        isDefault: false
      });

      expect(result.name).toBe('Standard Contract');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contract_templates'),
        expect.arrayContaining(['Standard Contract', 'standard'])
      );
    });

    it('uses default variables when none provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      await contractService.createTemplate({
        name: 'Test Template',
        type: 'standard',
        content: 'Content',
        variables: []
      });

      // getDefaultContractVariables mock returns 3 defaults
      const insertCall = mockDb.run.mock.calls[0];
      const variablesArg = insertCall[1][3]; // 4th param is JSON variables
      expect(JSON.parse(variablesArg)).toHaveLength(3);
    });

    it('deactivates previous default when isDefault is true', async () => {
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE existing defaults
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ is_default: 1 }));

      const result = await contractService.createTemplate({
        name: 'New Default',
        type: 'standard',
        content: 'Content',
        isDefault: true
      });

      expect(mockDb.run).toHaveBeenNthCalledWith(
        1,
        'UPDATE contract_templates SET is_default = FALSE WHERE type = ?',
        ['standard']
      );
      expect(result.isDefault).toBe(true);
    });
  });

  describe('updateTemplate', () => {
    it('updates specified template fields', async () => {
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ name: 'Updated Name' }));

      const result = await contractService.updateTemplate(1, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('name = ?'),
        expect.arrayContaining(['Updated Name', 1])
      );
    });

    it('updates content field', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ content: 'New content' }));

      await contractService.updateTemplate(1, { content: 'New content' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('content = ?'),
        expect.arrayContaining(['New content'])
      );
    });

    it('serializes variables as JSON', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      await contractService.updateTemplate(1, { variables: ['client.name'] });

      const updateCall = mockDb.run.mock.calls[0];
      const params = updateCall[1];
      expect(params).toContain(JSON.stringify(['client.name']));
    });

    it('deactivates old default when setting isDefault=true on update', async () => {
      // getTemplate call for type lookup
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ type: 'standard' }));
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE old default
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE this template
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ is_default: 1 }));

      const result = await contractService.updateTemplate(1, { isDefault: true });

      expect(result.isDefault).toBe(true);
      // First run call should be to clear old default
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE contract_templates SET is_default = FALSE WHERE type = ?',
        expect.any(Array)
      );
    });

    it('does not change default status when isDefault=false on update', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ is_default: 0 }));

      await contractService.updateTemplate(1, { isDefault: false });

      const calls = mockDb.run.mock.calls;
      const clearDefaultCall = calls.find(c =>
        c[0].includes('is_default = FALSE WHERE type')
      );
      expect(clearDefaultCall).toBeUndefined();
    });

    it('always appends updated_at to update query', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      await contractService.updateTemplate(1, { name: 'Changed' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("updated_at = datetime('now')"),
        expect.any(Array)
      );
    });
  });

  describe('deleteTemplate', () => {
    it('soft-deletes a template by setting is_active = FALSE', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await contractService.deleteTemplate(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('is_active = FALSE'),
        [1]
      );
    });
  });
});

// =====================================================
// CONTRACT TESTS
// =====================================================

describe('ContractService - Contracts', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getContracts', () => {
    it('returns all contracts with no filters', async () => {
      mockDb.all.mockResolvedValueOnce([makeContractRow(), makeContractRow({ id: 2 })]);

      const result = await contractService.getContracts();

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        []
      );
    });

    it('filters by projectId', async () => {
      mockDb.all.mockResolvedValueOnce([makeContractRow()]);

      const result = await contractService.getContracts({ projectId: 10 });

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('project_id = ?'),
        [10]
      );
    });

    it('filters by clientId', async () => {
      mockDb.all.mockResolvedValueOnce([makeContractRow()]);

      await contractService.getContracts({ clientId: 5 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('client_id = ?'),
        [5]
      );
    });

    it('filters by status', async () => {
      mockDb.all.mockResolvedValueOnce([makeContractRow({ status: 'signed' })]);

      await contractService.getContracts({ status: 'signed' });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('status = ?'),
        ['signed']
      );
    });

    it('supports multiple filters combined', async () => {
      mockDb.all.mockResolvedValueOnce([makeContractRow()]);

      await contractService.getContracts({ projectId: 10, clientId: 5, status: 'draft' });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        [10, 5, 'draft']
      );
    });

    it('returns empty array when no contracts', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await contractService.getContracts();

      expect(result).toHaveLength(0);
    });
  });

  describe('getContract', () => {
    it('returns contract by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      const result = await contractService.getContract(1);

      expect(result.id).toBe(1);
      expect(result.status).toBe('draft');
    });

    it('throws when contract not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(contractService.getContract(999)).rejects.toThrow('Contract not found');
    });
  });

  describe('createContract', () => {
    it('creates a contract with default status draft', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      const result = await contractService.createContract({
        projectId: 10,
        clientId: 5,
        content: 'Contract content'
      });

      expect(result.status).toBe('draft');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contracts'),
        expect.arrayContaining([10, 5, 'Contract content', 'draft'])
      );
    });

    it('creates contract with explicit status', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeContractRow({ status: 'sent' }));

      await contractService.createContract({
        projectId: 10,
        clientId: 5,
        content: 'Contract content',
        status: 'sent'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['sent'])
      );
    });

    it('throws for invalid status', async () => {
      await expect(
        contractService.createContract({
          projectId: 10,
          clientId: 5,
          content: 'Content',
          status: 'invalid' as never
        })
      ).rejects.toThrow('Invalid contract status');
    });

    it('passes null for optional fields when not provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      await contractService.createContract({
        projectId: 10,
        clientId: 5,
        content: 'Content'
      });

      const params = mockDb.run.mock.calls[0][1];
      // templateId, parentContractId, renewalAt etc should be null
      expect(params[0]).toBeNull(); // template_id
      expect(params[6]).toBeNull(); // parent_contract_id
    });

    it('serializes variables to JSON', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      await contractService.createContract({
        projectId: 10,
        clientId: 5,
        content: 'Content',
        variables: { 'client.name': 'Alice' }
      });

      const params = mockDb.run.mock.calls[0][1];
      expect(params[5]).toBe(JSON.stringify({ 'client.name': 'Alice' }));
    });
  });

  describe('createContractFromTemplate', () => {
    it('creates contract by resolving template variables and applying them', async () => {
      // getTemplate
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ content: 'Hello {{ client.name }}' }));
      // getContractVariableSource
      mockDb.get.mockResolvedValueOnce({
        project_name: 'Test Project',
        project_type: 'web',
        description: null,
        start_date: null,
        due_date: null,
        price: null,
        deposit_amount: null,
        contact_name: 'Test Client',
        email: 'client@test.com',
        company_name: null
      });
      // createContract -> INSERT
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      // getContract -> SELECT
      mockDb.get.mockResolvedValueOnce(makeContractRow({ content: 'Hello Test Client' }));

      const result = await contractService.createContractFromTemplate({
        templateId: 1,
        projectId: 10,
        clientId: 5
      });

      expect(result.id).toBe(1);
    });

    it('throws when project/client not found during variable resolution', async () => {
      // getTemplate
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());
      // getContractVariableSource - no row
      mockDb.get.mockResolvedValueOnce(null);

      await expect(
        contractService.createContractFromTemplate({
          templateId: 1,
          projectId: 999,
          clientId: 999
        })
      ).rejects.toThrow('Project or client not found');
    });
  });

  describe('updateContract', () => {
    it('returns existing contract when no fields to update', async () => {
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      const result = await contractService.updateContract(1, {});

      expect(result.id).toBe(1);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('updates content field', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ content: 'Updated content' }));

      await contractService.updateContract(1, { content: 'Updated content' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('content = ?'),
        expect.arrayContaining(['Updated content', 1])
      );
    });

    it('throws for invalid status on update', async () => {
      await expect(
        contractService.updateContract(1, { status: 'not-a-status' as never })
      ).rejects.toThrow('Invalid contract status');
    });

    it('updates status field', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ status: 'signed' }));

      const result = await contractService.updateContract(1, { status: 'signed' });

      expect(result.status).toBe('signed');
    });

    it('updates templateId field, passing null for falsy values', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ template_id: null }));

      await contractService.updateContract(1, { templateId: null });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('template_id = ?'),
        expect.arrayContaining([null])
      );
    });

    it('serializes variables as JSON when provided', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      await contractService.updateContract(1, { variables: { 'client.name': 'Bob' } });

      const params = mockDb.run.mock.calls[0][1];
      expect(params).toContain(JSON.stringify({ 'client.name': 'Bob' }));
    });

    it('passes null for variables when explicitly set to undefined', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      // variables: undefined means the field won't be in the update
      // but variables: null (via cast) would pass null
      await contractService.updateContract(1, { variables: undefined });

      // Since variables is undefined, it should not be in the update
      expect(mockDb.run).not.toHaveBeenCalled(); // no fields to update
    });

    it('updates all date/reminder fields', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({
        renewal_at: '2027-01-01',
        last_reminder_at: '2026-06-01',
        reminder_count: 2,
        sent_at: '2026-01-15',
        signed_at: '2026-01-20',
        expires_at: '2027-01-01'
      }));

      await contractService.updateContract(1, {
        renewalAt: '2027-01-01',
        lastReminderAt: '2026-06-01',
        reminderCount: 2,
        sentAt: '2026-01-15',
        signedAt: '2026-01-20',
        expiresAt: '2027-01-01'
      });

      const query = mockDb.run.mock.calls[0][0] as string;
      expect(query).toContain('renewal_at = ?');
      expect(query).toContain('last_reminder_at = ?');
      expect(query).toContain('reminder_count = ?');
      expect(query).toContain('sent_at = ?');
      expect(query).toContain('signed_at = ?');
      expect(query).toContain('expires_at = ?');
    });
  });
});

// =====================================================
// SIGNATURE LIFECYCLE TESTS
// =====================================================

describe('ContractService - Signature Lifecycle', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('requestSignature', () => {
    it('updates contract with signature token and status=sent', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ status: 'sent', signature_token: 'token123' }));

      const result = await contractService.requestSignature(1, {
        signatureToken: 'token123',
        expiresAt: '2026-02-01T00:00:00Z'
      });

      expect(result.status).toBe('sent');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('signature_token = ?'),
        ['token123', '2026-02-01T00:00:00Z', 1]
      );
    });
  });

  describe('getContractBySignatureToken', () => {
    it('returns contract when token matches', async () => {
      mockDb.get.mockResolvedValueOnce(makeContractRow({ signature_token: 'token123' }));

      const result = await contractService.getContractBySignatureToken('token123');

      expect(result).not.toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('signature_token = ?'),
        ['token123']
      );
    });

    it('returns null when no contract matches the token', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await contractService.getContractBySignatureToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('recordSignature', () => {
    it('records all signer details and sets status to signed', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({
        status: 'signed',
        signer_name: 'Alice Smith',
        signer_email: 'alice@example.com'
      }));

      const result = await contractService.recordSignature(1, {
        signerName: 'Alice Smith',
        signerEmail: 'alice@example.com',
        signerIp: '127.0.0.1',
        signerUserAgent: 'Mozilla/5.0',
        signatureData: 'base64data'
      });

      expect(result.status).toBe('signed');
      expect(result.signerName).toBe('Alice Smith');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'signed'"),
        expect.arrayContaining(['Alice Smith', 'alice@example.com', '127.0.0.1'])
      );
    });

    it('clears signature_token and signature_expires_at on signing', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ status: 'signed' }));

      await contractService.recordSignature(1, {
        signerName: 'Bob',
        signerEmail: 'bob@example.com',
        signerIp: '127.0.0.1',
        signerUserAgent: 'Chrome',
        signatureData: 'sig'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('signature_token = NULL'),
        expect.any(Array)
      );
    });
  });

  describe('recordCountersignature', () => {
    it('records countersigner details', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({
        countersigned_at: '2026-01-02T00:00:00Z',
        countersigner_name: 'Owner',
        countersigner_email: 'owner@business.com'
      }));

      const result = await contractService.recordCountersignature(1, {
        countersignerName: 'Owner',
        countersignerEmail: 'owner@business.com',
        countersignerIp: '10.0.0.1',
        countersignerUserAgent: 'Safari',
        countersignatureData: 'countersigdata'
      });

      expect(result.countersignerName).toBe('Owner');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('countersigner_name = ?'),
        expect.arrayContaining(['Owner', 'owner@business.com'])
      );
    });

    it('records signed_pdf_path when provided', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ signed_pdf_path: '/path/to/signed.pdf' }));

      await contractService.recordCountersignature(1, {
        countersignerName: 'Owner',
        countersignerEmail: 'owner@business.com',
        countersignerIp: '10.0.0.1',
        countersignerUserAgent: 'Safari',
        countersignatureData: 'data',
        signedPdfPath: '/path/to/signed.pdf'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('signed_pdf_path = ?'),
        expect.arrayContaining(['/path/to/signed.pdf'])
      );
    });

    it('passes null for signed_pdf_path when not provided', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      await contractService.recordCountersignature(1, {
        countersignerName: 'Owner',
        countersignerEmail: 'owner@business.com',
        countersignerIp: '10.0.0.1',
        countersignerUserAgent: 'Safari',
        countersignatureData: 'data'
      });

      const params = mockDb.run.mock.calls[0][1];
      // signed_pdf_path is 7th positional param (index 6), then contractId at end
      const pdfPathIndex = params.indexOf(null);
      expect(pdfPathIndex).toBeGreaterThan(-1);
    });
  });

  describe('expireSignatureRequest', () => {
    it('sets contract status to expired and clears token', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeContractRow({ status: 'expired', signature_token: null }));

      const result = await contractService.expireSignatureRequest(1);

      expect(result.status).toBe('expired');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'expired'"),
        [1]
      );
    });
  });

  describe('getSignatureInfo', () => {
    it('returns all signature fields as null when unsigned', async () => {
      mockDb.get.mockResolvedValueOnce(makeContractRow());

      const result = await contractService.getSignatureInfo(1);

      expect(result.signedAt).toBeNull();
      expect(result.signatureToken).toBeUndefined(); // not in return type
      expect(result.signerName).toBeNull();
      expect(result.countersignedAt).toBeNull();
      expect(result.signedPdfPath).toBeNull();
    });

    it('returns populated signature fields when signed', async () => {
      mockDb.get.mockResolvedValueOnce(makeContractRow({
        signed_at: '2026-01-05T00:00:00Z',
        signer_name: 'Alice',
        signer_email: 'alice@example.com',
        signer_ip: '127.0.0.1',
        countersigned_at: '2026-01-06T00:00:00Z',
        countersigner_name: 'Owner',
        countersigner_email: 'owner@biz.com',
        countersigner_ip: '10.0.0.1',
        signed_pdf_path: '/path/signed.pdf',
        signature_requested_at: '2026-01-04T00:00:00Z',
        signature_expires_at: '2026-02-04T00:00:00Z'
      }));

      const result = await contractService.getSignatureInfo(1);

      expect(result.signedAt).toBe('2026-01-05T00:00:00Z');
      expect(result.signerName).toBe('Alice');
      expect(result.signerEmail).toBe('alice@example.com');
      expect(result.signerIp).toBe('127.0.0.1');
      expect(result.countersignedAt).toBe('2026-01-06T00:00:00Z');
      expect(result.countersignerName).toBe('Owner');
      expect(result.signedPdfPath).toBe('/path/signed.pdf');
    });

    it('throws when contract not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(contractService.getSignatureInfo(999)).rejects.toThrow('Contract not found');
    });
  });
});

// =====================================================
// VALIDATION HELPER TESTS
// =====================================================

describe('ContractService - Validation Helpers', () => {
  describe('isValidTemplateType', () => {
    it('returns true for all valid template types', () => {
      const validTypes = ['standard', 'custom', 'amendment', 'nda', 'maintenance'];

      for (const type of validTypes) {
        expect(contractService.isValidTemplateType(type)).toBe(true);
      }
    });

    it('returns false for invalid template type', () => {
      expect(contractService.isValidTemplateType('unknown')).toBe(false);
      expect(contractService.isValidTemplateType('')).toBe(false);
      expect(contractService.isValidTemplateType('STANDARD')).toBe(false);
    });
  });

  describe('isValidContractStatus', () => {
    it('returns true for all valid contract statuses', () => {
      const validStatuses = ['draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'];

      for (const status of validStatuses) {
        expect(contractService.isValidContractStatus(status)).toBe(true);
      }
    });

    it('returns false for invalid contract status', () => {
      expect(contractService.isValidContractStatus('pending')).toBe(false);
      expect(contractService.isValidContractStatus('')).toBe(false);
      expect(contractService.isValidContractStatus('SIGNED')).toBe(false);
    });
  });
});
