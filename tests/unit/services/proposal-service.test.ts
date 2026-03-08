/**
 * ===============================================
 * UNIT TESTS - PROPOSAL SERVICE
 * ===============================================
 * @file tests/unit/services/proposal-service.test.ts
 *
 * Tests for proposal management service including:
 * - Template CRUD operations
 * - Versioning (create, get, restore, compare)
 * - E-signatures (request, record, decline, status)
 * - Comments (add, get, delete, threaded)
 * - Activity logging and view tracking
 * - Custom items (add, update, delete)
 * - Discounts (apply, remove, recalculate)
 * - Expiration and reminder processing
 * - Access token management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =====================================================
// MOCK SETUP - must be hoisted before imports
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

vi.mock('../../../server/config/environment', () => ({
  getBaseUrl: vi.fn(() => 'https://example.com')
}));

vi.mock('../../../shared/validation/validators', () => ({
  validateJsonSchema: vi.fn(() => ({ isValid: true })),
  validateLineItems: vi.fn(() => ({ isValid: true })),
  tierStructureSchema: {}
}));

vi.mock('../../../server/services/email-service', () => ({
  emailService: {
    sendProposalSignedNotification: vi.fn(),
    sendProposalSignedClientConfirmation: vi.fn()
  },
  isClientActivated: vi.fn()
}));

vi.mock('../../../server/database/row-helpers', () => ({
  getString: vi.fn((row: Record<string, unknown>, key: string) => {
    if (!row || !(key in row)) return '';
    const val = row[key];
    return typeof val === 'string' ? val : '';
  }),
  getNumber: vi.fn((row: Record<string, unknown>, key: string) => {
    if (!row || !(key in row)) return 0;
    const val = row[key];
    return typeof val === 'number' ? val : 0;
  })
}));

// Mapper mocks — return lightweight objects so we can assert shape
vi.mock('../../../server/database/entities/index', () => ({
  toProposalTemplate: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    validityDays: row.validity_days ?? 30,
    isDefault: Boolean(row.is_default)
  })),
  toProposalVersion: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    versionNumber: row.version_number,
    tierData: row.tier_data ? JSON.parse(row.tier_data as string) : {},
    featuresData: row.features_data ? JSON.parse(row.features_data as string) : [],
    pricingData: row.pricing_data ? JSON.parse(row.pricing_data as string) : {}
  })),
  toProposalSignature: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email
  })),
  toProposalComment: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    content: row.content,
    parentCommentId: row.parent_comment_id ?? null,
    replies: []
  })),
  toProposalActivity: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    activityType: row.activity_type
  })),
  toProposalCustomItem: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    description: row.description,
    unitPrice: row.unit_price,
    quantity: row.quantity ?? 1
  })),
  toSignatureRequest: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    proposalId: row.proposal_id,
    signerEmail: row.signer_email,
    signerName: row.signer_name,
    requestToken: row.request_token,
    status: row.status
  }))
}));

// Import AFTER all mocks are registered
import { proposalService } from '../../../server/services/proposal-service';
import { emailService, isClientActivated } from '../../../server/services/email-service';
import { validateJsonSchema, validateLineItems } from '../../../shared/validation/validators';

// =====================================================
// SHARED TEST DATA FACTORIES
// =====================================================

function makeTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Default Template',
    description: null,
    project_type: 'web',
    tier_structure: null,
    default_line_items: null,
    terms_and_conditions: null,
    validity_days: 30,
    is_default: 0,
    is_active: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    proposal_id: 5,
    version_number: 1,
    tier_data: JSON.stringify({ selectedTier: 'good', maintenanceOption: null }),
    features_data: JSON.stringify([]),
    pricing_data: JSON.stringify({ basePrice: 1000, finalPrice: 1000 }),
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSignatureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 20,
    proposal_id: 5,
    signer_name: 'Jane Doe',
    signer_email: 'jane@example.com',
    signer_title: null,
    signer_company: null,
    signature_method: 'typed',
    signature_data: 'Jane Doe',
    ip_address: '127.0.0.1',
    user_agent: 'TestAgent/1.0',
    signed_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSignatureRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 30,
    proposal_id: 5,
    signer_email: 'jane@example.com',
    signer_name: 'Jane Doe',
    request_token: 'abc123token',
    status: 'pending',
    sent_at: '2026-01-01T00:00:00Z',
    viewed_at: null,
    signed_at: null,
    declined_at: null,
    decline_reason: null,
    expires_at: '2026-01-08T00:00:00Z',
    reminder_count: 0,
    last_reminder_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeCommentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 40,
    proposal_id: 5,
    author_type: 'admin',
    author_name: 'Admin User',
    author_email: 'admin@example.com',
    content: 'This looks good',
    is_internal: 0,
    parent_comment_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeActivityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 50,
    proposal_id: 5,
    activity_type: 'viewed',
    actor: null,
    actor_type: null,
    metadata: null,
    ip_address: null,
    user_agent: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeCustomItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 60,
    proposal_id: 5,
    item_type: 'service',
    description: 'Consulting hour',
    quantity: 2,
    unit_price: 150,
    unit_label: null,
    category: null,
    is_taxable: 1,
    is_optional: 0,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeProposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    project_id: 1,
    client_id: 2,
    project_type: 'web',
    selected_tier: 'good',
    base_price: 1000,
    final_price: 1000,
    maintenance_option: null,
    status: 'pending',
    client_notes: null,
    admin_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    ...overrides
  };
}

// =====================================================
// TEMPLATE TESTS
// =====================================================

describe('ProposalService - Templates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
    vi.mocked(validateJsonSchema).mockReturnValue({ isValid: true });
    vi.mocked(validateLineItems).mockReturnValue({ isValid: true });
  });

  describe('createTemplate', () => {
    it('creates a basic template without optional fields', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      const result = await proposalService.createTemplate({ name: 'Basic Template' });

      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Default Template');
    });

    it('unsets other defaults before creating a default template', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // unset defaults
      mockDb.run.mockResolvedValueOnce({ lastID: 2 }); // insert
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ id: 2, is_default: 1 }));

      await proposalService.createTemplate({
        name: 'Default',
        isDefault: true,
        projectType: 'web'
      });

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      const firstCall = mockDb.run.mock.calls[0][0] as string;
      expect(firstCall).toContain('is_default = FALSE');
    });

    it('validates tierStructure and throws if invalid', async () => {
      vi.mocked(validateJsonSchema).mockReturnValueOnce({
        isValid: false,
        error: 'Invalid tier structure'
      });

      await expect(
        proposalService.createTemplate({
          name: 'Bad Template',
          tierStructure: { invalid: true }
        })
      ).rejects.toThrow('Invalid tier structure');

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('validates defaultLineItems and throws if invalid', async () => {
      vi.mocked(validateLineItems).mockReturnValueOnce({
        isValid: false,
        error: 'Invalid line items'
      });

      await expect(
        proposalService.createTemplate({
          name: 'Bad Items',
          defaultLineItems: [{ bad: true }]
        })
      ).rejects.toThrow('Invalid line items');
    });
  });

  describe('getTemplates', () => {
    it('returns all active templates', async () => {
      mockDb.all.mockResolvedValueOnce([makeTemplateRow(), makeTemplateRow({ id: 2, name: 'T2' })]);

      const result = await proposalService.getTemplates();

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledOnce();
    });

    it('filters by projectType when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeTemplateRow()]);

      await proposalService.getTemplates('web');

      const query = mockDb.all.mock.calls[0][0] as string;
      expect(query).toContain('project_type = ?');
      expect(mockDb.all.mock.calls[0][1]).toContain('web');
    });

    it('returns empty array when no templates exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await proposalService.getTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('getTemplate', () => {
    it('returns a template by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      const result = await proposalService.getTemplate(1);

      expect(result.id).toBe(1);
    });

    it('throws when template not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getTemplate(999)).rejects.toThrow('Template not found');
    });
  });

  describe('updateTemplate', () => {
    it('updates name field only', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ name: 'Updated Name' }));

      const result = await proposalService.updateTemplate(1, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('name = ?');
    });

    it('unsets other defaults when isDefault is set to true', async () => {
      // getTemplate call inside updateTemplate when isDefault is true
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ project_type: 'web' }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // unset defaults
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ is_default: 1 }));

      await proposalService.updateTemplate(1, { isDefault: true });

      const unsetCall = mockDb.run.mock.calls[0][0] as string;
      expect(unsetCall).toContain('is_default = FALSE');
    });

    it('does not call unset-defaults when isDefault is false', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeTemplateRow({ is_default: 0 }));

      await proposalService.updateTemplate(1, { isDefault: false });

      // Only one db.run call (the actual update), no unset call
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });

    it('handles all optional fields', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeTemplateRow());

      await proposalService.updateTemplate(1, {
        description: 'New desc',
        projectType: 'mobile',
        tierStructure: { tiers: [] },
        defaultLineItems: [],
        termsAndConditions: 'T&C text',
        validityDays: 60
      });

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('description = ?');
      expect(sql).toContain('project_type = ?');
      expect(sql).toContain('validity_days = ?');
    });
  });

  describe('deleteTemplate', () => {
    it('soft-deletes by setting is_active to FALSE', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.deleteTemplate(1);

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('is_active = FALSE');
      expect(mockDb.run.mock.calls[0][1]).toContain(1);
    });
  });
});

// =====================================================
// VERSIONING TESTS
// =====================================================

describe('ProposalService - Versioning', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
  });

  describe('createVersion', () => {
    it('creates a new version from current proposal state', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow()); // proposal
      mockDb.all.mockResolvedValueOnce([]); // features
      mockDb.get.mockResolvedValueOnce({ max: 0 }); // last version
      mockDb.run.mockResolvedValueOnce({ lastID: 10 }); // insert version
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update version_number
      mockDb.get.mockResolvedValueOnce(makeVersionRow()); // getVersion

      const result = await proposalService.createVersion(5, 'admin@example.com', 'First save');

      expect(result.id).toBe(10);
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('throws if proposal not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.createVersion(999)).rejects.toThrow('Proposal not found');
    });

    it('increments version number from existing max', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow());
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ max: 3 }); // existing max
      mockDb.run.mockResolvedValueOnce({ lastID: 11 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ version_number: 4 }));

      await proposalService.createVersion(5);

      const insertCall = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertCall[1]).toBe(4); // version_number = 4
    });
  });

  describe('getVersions', () => {
    it('returns all versions ordered by version number DESC', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeVersionRow({ id: 12, version_number: 2 }),
        makeVersionRow({ id: 10, version_number: 1 })
      ]);

      const result = await proposalService.getVersions(5);

      expect(result).toHaveLength(2);
      const query = mockDb.all.mock.calls[0][0] as string;
      expect(query).toContain('ORDER BY version_number DESC');
    });

    it('returns empty array when no versions exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await proposalService.getVersions(5);

      expect(result).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('returns a version by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeVersionRow());

      const result = await proposalService.getVersion(10);

      expect(result.id).toBe(10);
    });

    it('throws when version not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getVersion(999)).rejects.toThrow('Version not found');
    });
  });

  describe('restoreVersion', () => {
    it('throws if version does not belong to the proposal', async () => {
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ proposal_id: 99 })); // different proposalId

      await expect(proposalService.restoreVersion(5, 10)).rejects.toThrow(
        'Version does not belong to this proposal'
      );
    });

    it('restores proposal data from version and logs activity', async () => {
      // getVersion
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ proposal_id: 5 }));

      // transaction mock executes the callback immediately
      const mockCtx = { run: vi.fn().mockResolvedValue({ changes: 1 }) };
      mockDb.transaction.mockImplementation(async (cb: (ctx: typeof mockCtx) => Promise<void>) => {
        await cb(mockCtx);
      });

      // logActivity run
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.restoreVersion(5, 10);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockCtx.run).toHaveBeenCalled();
    });

    it('inserts features back when featuresData is an array', async () => {
      const versionWithFeatures = makeVersionRow({
        proposal_id: 5,
        features_data: JSON.stringify([
          { feature_id: 1, feature_name: 'Feature A', feature_price: 200 }
        ])
      });
      mockDb.get.mockResolvedValueOnce(versionWithFeatures);

      const mockCtx = { run: vi.fn().mockResolvedValue({ changes: 1 }) };
      mockDb.transaction.mockImplementation(async (cb: (ctx: typeof mockCtx) => Promise<void>) => {
        await cb(mockCtx);
      });
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.restoreVersion(5, 10);

      // ctx.run called: UPDATE proposal_requests, DELETE features, INSERT feature
      expect(mockCtx.run).toHaveBeenCalledTimes(3);
    });
  });

  describe('compareVersions', () => {
    it('returns both versions and their differences', async () => {
      const v1 = makeVersionRow({
        id: 10,
        pricing_data: JSON.stringify({ basePrice: 1000, finalPrice: 1000 }),
        tier_data: JSON.stringify({ selectedTier: 'good' }),
        features_data: JSON.stringify([])
      });
      const v2 = makeVersionRow({
        id: 11,
        pricing_data: JSON.stringify({ basePrice: 2000, finalPrice: 2000 }),
        tier_data: JSON.stringify({ selectedTier: 'best' }),
        features_data: JSON.stringify([{ name: 'Feature' }])
      });

      mockDb.get
        .mockResolvedValueOnce(v1) // getVersion(10)
        .mockResolvedValueOnce(v2); // getVersion(11)

      const result = await proposalService.compareVersions(10, 11);

      expect(result.version1.id).toBe(10);
      expect(result.version2.id).toBe(11);
      expect(result.differences).toHaveProperty('basePrice');
      expect(result.differences).toHaveProperty('selectedTier');
      expect(result.differences).toHaveProperty('featureCount');
    });

    it('returns empty differences when versions are identical', async () => {
      const identicalRow = makeVersionRow({ id: 10 });
      mockDb.get
        .mockResolvedValueOnce(identicalRow)
        .mockResolvedValueOnce({ ...identicalRow, id: 11 });

      const result = await proposalService.compareVersions(10, 11);

      expect(Object.keys(result.differences)).toHaveLength(0);
    });
  });
});

// =====================================================
// E-SIGNATURE TESTS
// =====================================================

describe('ProposalService - E-Signatures', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(emailService.sendProposalSignedNotification).mockReset();
    vi.mocked(emailService.sendProposalSignedClientConfirmation).mockReset();
    vi.mocked(isClientActivated).mockReset();
  });

  describe('requestSignature', () => {
    it('creates a signature request and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 30 }); // insert request
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update proposal requires_signature
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity
      mockDb.get.mockResolvedValueOnce(makeSignatureRequestRow()); // getSignatureRequest

      const result = await proposalService.requestSignature(5, 'jane@example.com', 'Jane Doe');

      expect(result.id).toBe(30);
      expect(result.signerEmail).toBe('jane@example.com');
    });

    it('uses default expiresInDays of 7 when not specified', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 30 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeSignatureRequestRow());

      await proposalService.requestSignature(5, 'jane@example.com');

      const insertParams = mockDb.run.mock.calls[0][1] as unknown[];
      // expiresAt is the 5th parameter (index 4)
      const expiresAt = new Date(insertParams[4] as string);
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);
      // Allow a 60-second window
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(60000);
    });
  });

  describe('getSignatureRequest', () => {
    it('returns a request by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeSignatureRequestRow());

      const result = await proposalService.getSignatureRequest(30);

      expect(result.id).toBe(30);
    });

    it('throws when request not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getSignatureRequest(999)).rejects.toThrow(
        'Signature request not found'
      );
    });
  });

  describe('getSignatureRequestByToken', () => {
    it('returns null when token not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await proposalService.getSignatureRequestByToken('nonexistent');

      expect(result).toBeNull();
    });

    it('returns the signature request when token exists', async () => {
      mockDb.get.mockResolvedValueOnce(makeSignatureRequestRow());

      const result = await proposalService.getSignatureRequestByToken('abc123token');

      expect(result).not.toBeNull();
      expect(result!.requestToken).toBe('abc123token');
    });
  });

  describe('recordSignature', () => {
    const signatureData = {
      signerName: 'Jane Doe',
      signerEmail: 'jane@example.com',
      signatureMethod: 'typed' as const,
      signatureData: 'Jane Doe',
      ipAddress: '127.0.0.1',
      userAgent: 'TestAgent'
    };

    it('records signature, updates proposal, and returns the signature', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 }); // insert signature
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update proposal signed_at
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update signature_requests
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      // sendProposalSignedNotification internal calls
      mockDb.get.mockResolvedValueOnce({
        ...makeProposalRow(),
        project_name: 'Test Project',
        client_name: 'Test Client',
        company_name: 'Test Co',
        client_email: 'client@example.com',
        client_id: 2
      });
      mockDb.all.mockResolvedValueOnce([]); // features for notification

      vi.mocked(emailService.sendProposalSignedNotification).mockResolvedValueOnce({ success: true });
      vi.mocked(isClientActivated).mockResolvedValueOnce(false);

      mockDb.get.mockResolvedValueOnce(makeSignatureRow()); // getSignature

      const result = await proposalService.recordSignature(5, signatureData);

      expect(result.id).toBe(20);
      expect(vi.mocked(emailService.sendProposalSignedNotification)).toHaveBeenCalled();
    });

    it('sends client confirmation email when client is activated', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.get.mockResolvedValueOnce({
        ...makeProposalRow(),
        project_name: 'P',
        client_name: 'C',
        company_name: null,
        client_id: 2
      });
      mockDb.all.mockResolvedValueOnce([]);

      vi.mocked(emailService.sendProposalSignedNotification).mockResolvedValueOnce({ success: true });
      vi.mocked(isClientActivated).mockResolvedValueOnce(true);
      vi.mocked(emailService.sendProposalSignedClientConfirmation).mockResolvedValueOnce({ success: true });

      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      await proposalService.recordSignature(5, signatureData);

      expect(vi.mocked(emailService.sendProposalSignedClientConfirmation)).toHaveBeenCalled();
    });

    it('logs error but does not throw when notification proposal not found', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      // sendProposalSignedNotification — proposal not found
      mockDb.get.mockResolvedValueOnce(null);

      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      const result = await proposalService.recordSignature(5, signatureData);

      expect(result.id).toBe(20);
      expect(vi.mocked(emailService.sendProposalSignedNotification)).not.toHaveBeenCalled();
    });

    it('logs error when admin notification fails', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.get.mockResolvedValueOnce({
        ...makeProposalRow(),
        project_name: 'P',
        client_name: 'C',
        company_name: null,
        client_id: 2
      });
      mockDb.all.mockResolvedValueOnce([]);

      // Admin notification fails
      vi.mocked(emailService.sendProposalSignedNotification).mockResolvedValueOnce({
        success: false,
        message: 'SMTP error'
      });
      vi.mocked(isClientActivated).mockResolvedValueOnce(false);

      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      const result = await proposalService.recordSignature(5, signatureData);

      expect(result.id).toBe(20);
    });

    it('logs error when client confirmation email fails', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.get.mockResolvedValueOnce({
        ...makeProposalRow(),
        project_name: 'P',
        client_name: 'C',
        company_name: null,
        client_id: 2
      });
      mockDb.all.mockResolvedValueOnce([]);

      vi.mocked(emailService.sendProposalSignedNotification).mockResolvedValueOnce({ success: true });
      vi.mocked(isClientActivated).mockResolvedValueOnce(true);
      vi.mocked(emailService.sendProposalSignedClientConfirmation).mockResolvedValueOnce({
        success: false,
        message: 'Client email failed'
      });

      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      const result = await proposalService.recordSignature(5, signatureData);

      expect(result.id).toBe(20);
      expect(vi.mocked(emailService.sendProposalSignedClientConfirmation)).toHaveBeenCalled();
    });

    it('does not throw when sendProposalSignedNotification throws an error', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 20 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.get.mockResolvedValueOnce({
        ...makeProposalRow(),
        project_name: 'P',
        client_name: 'C',
        company_name: null,
        client_id: 2
      });
      mockDb.all.mockResolvedValueOnce([]);

      vi.mocked(emailService.sendProposalSignedNotification).mockRejectedValueOnce(
        new Error('Network failure')
      );

      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      // Should not throw — error is caught internally
      const result = await proposalService.recordSignature(5, signatureData);

      expect(result.id).toBe(20);
    });
  });

  describe('getSignature', () => {
    it('returns a signature by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeSignatureRow());

      const result = await proposalService.getSignature(20);

      expect(result.id).toBe(20);
    });

    it('throws when signature not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getSignature(999)).rejects.toThrow('Signature not found');
    });
  });

  describe('getProposalSignatures', () => {
    it('returns all signatures for a proposal', async () => {
      mockDb.all.mockResolvedValueOnce([makeSignatureRow(), makeSignatureRow({ id: 21 })]);

      const result = await proposalService.getProposalSignatures(5);

      expect(result).toHaveLength(2);
    });
  });

  describe('getSignatureStatus', () => {
    it('returns status with signatures and pending requests', async () => {
      mockDb.get.mockResolvedValueOnce({ requires_signature: 1, signed_at: null }); // proposal
      mockDb.all.mockResolvedValueOnce([makeSignatureRow()]); // signatures
      mockDb.all.mockResolvedValueOnce([makeSignatureRequestRow()]); // pending requests

      const result = await proposalService.getSignatureStatus(5);

      expect(result.requiresSignature).toBe(true);
      expect(result.isSigned).toBe(false);
      expect(result.signatures).toHaveLength(1);
      expect(result.pendingRequests).toHaveLength(1);
    });

    it('shows isSigned true when signed_at is set', async () => {
      mockDb.get.mockResolvedValueOnce({ requires_signature: 0, signed_at: '2026-01-01' });
      mockDb.all.mockResolvedValueOnce([makeSignatureRow()]);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await proposalService.getSignatureStatus(5);

      expect(result.isSigned).toBe(true);
    });
  });

  describe('markSignatureViewed', () => {
    it('updates status to viewed for pending requests', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.markSignatureViewed('abc123token');

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain("status = CASE WHEN status = 'pending' THEN 'viewed'");
      expect(mockDb.run.mock.calls[0][1]).toContain('abc123token');
    });
  });

  describe('declineSignature', () => {
    it('throws when token not found', async () => {
      mockDb.get.mockResolvedValueOnce(null); // getSignatureRequestByToken returns null

      await expect(proposalService.declineSignature('bad-token')).rejects.toThrow(
        'Signature request not found'
      );
    });

    it('declines the request and logs activity', async () => {
      mockDb.get.mockResolvedValueOnce(makeSignatureRequestRow()); // getSignatureRequestByToken
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update to declined
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.declineSignature('abc123token', 'Not interested');

      const updateSql = mockDb.run.mock.calls[0][0] as string;
      expect(updateSql).toContain("status = 'declined'");
    });

    it('uses signerEmail as actor when signerName is null', async () => {
      mockDb.get.mockResolvedValueOnce(
        makeSignatureRequestRow({ signer_name: null, signer_email: 'fallback@example.com' })
      );
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.declineSignature('abc123token');

      const activityParams = mockDb.run.mock.calls[1][1] as unknown[];
      expect(activityParams[2]).toBe('fallback@example.com'); // actor
    });
  });
});

// =====================================================
// COMMENT TESTS
// =====================================================

describe('ProposalService - Comments', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addComment', () => {
    it('adds a comment and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 40 }); // insert comment
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity
      mockDb.get.mockResolvedValueOnce(makeCommentRow()); // getComment

      const result = await proposalService.addComment(5, 'admin', 'Admin User', 'Looks good');

      expect(result.id).toBe(40);
    });

    it('passes parentCommentId when provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 41 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeCommentRow({ id: 41, parent_comment_id: 40 }));

      await proposalService.addComment(5, 'client', 'Client', 'Reply', undefined, false, 40);

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[6]).toBe(40); // parentCommentId
    });

    it('marks comment as internal when isInternal is true', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 42 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeCommentRow({ is_internal: 1 }));

      await proposalService.addComment(5, 'admin', 'Admin', 'Internal note', undefined, true);

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[5]).toBe(1); // is_internal = 1
    });
  });

  describe('getComment', () => {
    it('returns a comment by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeCommentRow());

      const result = await proposalService.getComment(40);

      expect(result.id).toBe(40);
    });

    it('throws when comment not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getComment(999)).rejects.toThrow('Comment not found');
    });
  });

  describe('getComments', () => {
    it('excludes internal comments by default', async () => {
      mockDb.all.mockResolvedValueOnce([makeCommentRow()]);

      await proposalService.getComments(5);

      const query = mockDb.all.mock.calls[0][0] as string;
      expect(query).toContain('is_internal = FALSE');
    });

    it('includes internal comments when includeInternal is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeCommentRow(), makeCommentRow({ is_internal: 1 })]);

      await proposalService.getComments(5, true);

      const query = mockDb.all.mock.calls[0][0] as string;
      expect(query).not.toContain('is_internal = FALSE');
    });

    it('builds threaded structure with replies nested under parent', async () => {
      const parent = makeCommentRow({ id: 40, parent_comment_id: null });
      const reply = makeCommentRow({ id: 41, parent_comment_id: 40 });
      mockDb.all.mockResolvedValueOnce([parent, reply]);

      const result = await proposalService.getComments(5, true);

      // Only root comment returned at top level
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(40);
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replies![0].id).toBe(41);
    });

    it('returns multiple root comments when none have parents', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeCommentRow({ id: 40 }),
        makeCommentRow({ id: 41 })
      ]);

      const result = await proposalService.getComments(5, true);

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteComment', () => {
    it('deletes a comment by ID', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.deleteComment(40);

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM proposal_comments');
      expect(mockDb.run.mock.calls[0][1]).toContain(40);
    });
  });
});

// =====================================================
// ACTIVITY TESTS
// =====================================================

describe('ProposalService - Activity', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('logActivity', () => {
    it('inserts an activity record', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 50 });

      await proposalService.logActivity(5, 'viewed', 'admin', 'admin', { page: 1 });

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO proposal_activities');
    });

    it('uses null for optional fields when not provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 51 });

      await proposalService.logActivity(5, 'test_event');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[2]).toBeNull(); // actor
      expect(params[3]).toBeNull(); // actorType
      expect(params[4]).toBeNull(); // metadata (no object provided)
    });
  });

  describe('getActivities', () => {
    it('returns activities with default limit of 50', async () => {
      mockDb.all.mockResolvedValueOnce([makeActivityRow()]);

      const result = await proposalService.getActivities(5);

      expect(result).toHaveLength(1);
      const query = mockDb.all.mock.calls[0][0] as string;
      expect(query).toContain('LIMIT ?');
      expect(mockDb.all.mock.calls[0][1]).toContain(50);
    });

    it('accepts custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await proposalService.getActivities(5, 10);

      expect(mockDb.all.mock.calls[0][1]).toContain(10);
    });
  });

  describe('trackView', () => {
    it('increments view count and logs activity', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update view_count
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity insert

      await proposalService.trackView(5, '127.0.0.1', 'TestAgent');

      const updateSql = mockDb.run.mock.calls[0][0] as string;
      expect(updateSql).toContain('view_count = view_count + 1');
    });
  });
});

// =====================================================
// CUSTOM ITEM TESTS
// =====================================================

describe('ProposalService - Custom Items', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addCustomItem', () => {
    it('adds item with defaults and recalculates totals', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 60 }); // insert item

      // recalculateTotals calls
      mockDb.get.mockResolvedValueOnce(makeProposalRow()); // get proposal
      mockDb.all.mockResolvedValueOnce([]); // features
      mockDb.all.mockResolvedValueOnce([]); // custom items
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update totals

      mockDb.get.mockResolvedValueOnce(makeCustomItemRow()); // getCustomItem

      const result = await proposalService.addCustomItem(5, {
        description: 'Consulting hour',
        unitPrice: 150
      });

      expect(result.id).toBe(60);
    });

    it('uses service as default itemType', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 60 });
      mockDb.get.mockResolvedValueOnce(makeProposalRow());
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeCustomItemRow());

      await proposalService.addCustomItem(5, { description: 'Test', unitPrice: 100 });

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[1]).toBe('service'); // itemType default
    });
  });

  describe('getCustomItem', () => {
    it('returns an item by ID', async () => {
      mockDb.get.mockResolvedValueOnce(makeCustomItemRow());

      const result = await proposalService.getCustomItem(60);

      expect(result.id).toBe(60);
    });

    it('throws when item not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(proposalService.getCustomItem(999)).rejects.toThrow('Custom item not found');
    });
  });

  describe('getCustomItems', () => {
    it('returns all items for a proposal', async () => {
      mockDb.all.mockResolvedValueOnce([makeCustomItemRow(), makeCustomItemRow({ id: 61 })]);

      const result = await proposalService.getCustomItems(5);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateCustomItem', () => {
    it('updates specified fields and recalculates totals', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update

      // getCustomItem (to get proposalId for recalculate)
      mockDb.get.mockResolvedValueOnce(makeCustomItemRow());

      // recalculateTotals
      mockDb.get.mockResolvedValueOnce(makeProposalRow());
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await proposalService.updateCustomItem(60, {
        description: 'Updated',
        unitPrice: 200
      });

      expect(result.id).toBe(60);
    });

    it('handles all optional fields', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeCustomItemRow());
      mockDb.get.mockResolvedValueOnce(makeProposalRow());
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.updateCustomItem(60, {
        itemType: 'product',
        quantity: 5,
        unitLabel: 'each',
        category: 'hardware',
        isTaxable: false,
        isOptional: true,
        sortOrder: 2
      });

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('item_type = ?');
      expect(sql).toContain('quantity = ?');
      expect(sql).toContain('is_taxable = ?');
    });
  });

  describe('deleteCustomItem', () => {
    it('deletes item and recalculates totals', async () => {
      // getCustomItem
      mockDb.get.mockResolvedValueOnce(makeCustomItemRow({ proposal_id: 5 }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // delete

      // recalculateTotals
      mockDb.get.mockResolvedValueOnce(makeProposalRow());
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.deleteCustomItem(60);

      const deleteSql = mockDb.run.mock.calls[0][0] as string;
      expect(deleteSql).toContain('DELETE FROM proposal_custom_items');
    });
  });
});

// =====================================================
// DISCOUNT TESTS
// =====================================================

describe('ProposalService - Discounts', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('applyDiscount', () => {
    it('applies a percentage discount and recalculates', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // set discount

      // recalculateTotals
      mockDb.get.mockResolvedValueOnce(makeProposalRow({ discount_type: 'percentage', discount_value: 10 }));
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update totals

      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.applyDiscount(5, 'percentage', 10, 'Promo discount');

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('discount_type = ?');
    });

    it('applies a fixed discount and recalculates', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeProposalRow({ discount_type: 'fixed', discount_value: 100 }));
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.applyDiscount(5, 'fixed', 100);

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('fixed');
      expect(params[1]).toBe(100);
    });
  });

  describe('removeDiscount', () => {
    it('clears discount fields and recalculates', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // clear discount

      // recalculateTotals
      mockDb.get.mockResolvedValueOnce(makeProposalRow({ discount_type: null, discount_value: 0 }));
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.removeDiscount(5);

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('discount_type = NULL');
    });
  });

  describe('recalculateTotals', () => {
    it('returns early if proposal not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await proposalService.recalculateTotals(999);

      expect(mockDb.all).not.toHaveBeenCalled();
    });

    it('calculates final price with percentage discount and tax', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow({
        base_price: 1000,
        discount_type: 'percentage',
        discount_value: 10,
        tax_rate: 5
      }));
      mockDb.all.mockResolvedValueOnce([]); // features
      mockDb.all.mockResolvedValueOnce([]); // custom items
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.recalculateTotals(5);

      const params = mockDb.run.mock.calls[0][1] as number[];
      // subtotal = 1000, discount 10% = 100, after = 900, tax 5% = 45, final = 945
      expect(params[0]).toBe(1000); // subtotal
      expect(params[1]).toBeCloseTo(45); // tax amount
      expect(params[2]).toBeCloseTo(945); // final price
    });

    it('calculates final price with fixed discount', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow({
        base_price: 1000,
        discount_type: 'fixed',
        discount_value: 200,
        tax_rate: 0
      }));
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.recalculateTotals(5);

      const params = mockDb.run.mock.calls[0][1] as number[];
      expect(params[2]).toBe(800); // 1000 - 200 = 800
    });

    it('includes feature prices in subtotal', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow({ base_price: 1000, discount_type: null, tax_rate: 0 }));
      mockDb.all.mockResolvedValueOnce([{ feature_price: 250 }, { feature_price: 150 }]); // features
      mockDb.all.mockResolvedValueOnce([]); // no custom items
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.recalculateTotals(5);

      const params = mockDb.run.mock.calls[0][1] as number[];
      expect(params[0]).toBe(1400); // 1000 + 250 + 150
    });

    it('includes non-optional custom item totals in subtotal', async () => {
      mockDb.get.mockResolvedValueOnce(makeProposalRow({ base_price: 500, discount_type: null, tax_rate: 0 }));
      mockDb.all.mockResolvedValueOnce([]); // no features
      mockDb.all.mockResolvedValueOnce([{ quantity: 3, unit_price: 100, is_taxable: 1 }]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.recalculateTotals(5);

      const params = mockDb.run.mock.calls[0][1] as number[];
      expect(params[0]).toBe(800); // 500 + 3*100
    });
  });
});

// =====================================================
// EXPIRATION & REMINDER TESTS
// =====================================================

describe('ProposalService - Expiration & Reminders', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('setExpiration', () => {
    it('updates expiration_date for a proposal', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.setExpiration(5, '2026-06-01');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('2026-06-01');
      expect(params[1]).toBe(5);
    });
  });

  describe('processExpiredProposals', () => {
    it('returns count of proposals marked as rejected', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 3 });

      const count = await proposalService.processExpiredProposals();

      expect(count).toBe(3);
    });

    it('returns 0 when no proposals were expired', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 0 });

      const count = await proposalService.processExpiredProposals();

      expect(count).toBe(0);
    });

    it('returns 0 when changes is undefined', async () => {
      mockDb.run.mockResolvedValueOnce({});

      const count = await proposalService.processExpiredProposals();

      expect(count).toBe(0);
    });
  });

  describe('getProposalsDueForReminder', () => {
    it('returns array of proposal IDs', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 5 }, { id: 6 }]);

      const result = await proposalService.getProposalsDueForReminder(3);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when none are due', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await proposalService.getProposalsDueForReminder(7);

      expect(result).toEqual([]);
    });
  });

  describe('markReminderSent', () => {
    it('updates reminder_sent_at and logs activity', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update reminder_sent_at
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.markReminderSent(5);

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('reminder_sent_at = datetime');
    });
  });

  describe('markProposalSent', () => {
    it('sets sent_at, sent_by, expiration_date and logs activity', async () => {
      mockDb.get.mockResolvedValueOnce({ validity_days: 30 }); // get validity_days
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // update
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // logActivity

      await proposalService.markProposalSent(5, 'admin@example.com');

      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('sent_at = datetime');
      expect(sql).toContain('sent_by = ?');
    });

    it('uses validity_days 30 as fallback when proposal not found', async () => {
      mockDb.get.mockResolvedValueOnce(null); // proposal not found
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await proposalService.markProposalSent(5, 'admin@example.com');

      // Should still succeed — uses fallback 30 days
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateAccessToken', () => {
    it('generates a hex token, stores it and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const token = await proposalService.generateAccessToken(5);

      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64); // 32 bytes hex = 64 chars
      const sql = mockDb.run.mock.calls[0][0] as string;
      expect(sql).toContain('access_token = ?');
    });
  });

  describe('getProposalByAccessToken', () => {
    it('returns proposal ID when token exists', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 5 });

      const result = await proposalService.getProposalByAccessToken('valid-token');

      expect(result).toBe(5);
    });

    it('returns null when token not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await proposalService.getProposalByAccessToken('bad-token');

      expect(result).toBeNull();
    });
  });
});
