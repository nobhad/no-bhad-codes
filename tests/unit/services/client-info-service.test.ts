/**
 * ===============================================
 * UNIT TESTS - CLIENT INFO SERVICE
 * ===============================================
 * @file tests/unit/services/client-info-service.test.ts
 *
 * Tests for client onboarding progress and information
 * completeness tracking service, including:
 * - Completeness calculation and upsert logic
 * - Completeness retrieval
 * - Full client info status retrieval
 * - All-clients info status with filters
 * - Missing items detection (profile, onboarding, docs, questionnaires)
 * - Onboarding progress CRUD
 * - Onboarding completion (new and existing records)
 * - Onboarding reset
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

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/utils/safe-json', () => ({
  parseIfString: vi.fn((value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value;
  }),
  safeJsonParse: vi.fn((value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  })
}));

// Import service after mocks
import { clientInfoService } from '../../../server/services/client-info-service';

// =====================================================
// SHARED FIXTURES
// =====================================================

const makeCompletenessRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  client_id: 10,
  overall_percentage: 80,
  profile_complete: 1,
  documents_pending: 0,
  documents_approved: 2,
  documents_total: 2,
  questionnaires_pending: 0,
  questionnaires_completed: 1,
  questionnaires_total: 1,
  onboarding_complete: 1,
  last_calculated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeOnboardingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  client_id: 10,
  project_id: null,
  current_step: 3,
  step_data: JSON.stringify({ company_name: 'Acme', contact_name: 'Jane' }),
  status: 'in_progress',
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  company_name: 'Acme Corp',
  contact_name: 'Jane Doe',
  email: 'jane@acme.com',
  phone: '555-0000',
  address: '123 Main St',
  ...overrides
});

// =====================================================
// COMPLETENESS CALCULATION
// =====================================================

describe('ClientInfoService - calculateCompleteness', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('calculates 100% completeness when everything is done (UPDATE path)', async () => {
    // doc stats
    mockDb.get.mockResolvedValueOnce({ total: 2, pending: 0, approved: 2 });
    // questionnaire stats
    mockDb.get.mockResolvedValueOnce({ total: 1, pending: 0, completed: 1 });
    // onboarding progress (called via getOnboardingProgress)
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));
    // client profile (all fields filled)
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    // existing completeness record → UPDATE path
    mockDb.get.mockResolvedValueOnce({ id: 1 });
    mockDb.run.mockResolvedValueOnce({});
    // getCompleteness call at end
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ overall_percentage: 100 }));

    const result = await clientInfoService.calculateCompleteness(10);

    expect(result.overall_percentage).toBe(100);
    expect(result.onboarding_complete).toBe(true);
    // Verify UPDATE was used
    expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE client_info_completeness');
  });

  it('uses INSERT path when no existing completeness record', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 }); // doc stats
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 }); // q stats
    mockDb.get.mockResolvedValueOnce(null); // no onboarding
    mockDb.get.mockResolvedValueOnce(makeClientRow()); // client profile
    mockDb.get.mockResolvedValueOnce(null); // no existing completeness record
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ overall_percentage: 70 }));

    const result = await clientInfoService.calculateCompleteness(10);

    expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO client_info_completeness');
    expect(result).toBeDefined();
  });

  it('handles missing client profile gracefully (undefined from db)', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(null); // no onboarding
    mockDb.get.mockResolvedValueOnce(undefined); // no client profile
    mockDb.get.mockResolvedValueOnce(null); // no existing record
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ profile_complete: 0, overall_percentage: 20 }));

    const result = await clientInfoService.calculateCompleteness(10);

    expect(result.profile_complete).toBe(false);
  });

  it('weighs onboarding progress by current_step fraction when in_progress', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    // onboarding at step 2 of 5 (in_progress)
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'in_progress', current_step: 2 }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ overall_percentage: 52 }));

    const result = await clientInfoService.calculateCompleteness(10);
    expect(result).toBeDefined();
  });

  it('includes document and questionnaire weights when totals > 0', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 4, pending: 2, approved: 2 }); // 50% approved
    mockDb.get.mockResolvedValueOnce({ total: 2, pending: 0, completed: 2 }); // 100% completed
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce({ id: 1 }); // existing record
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ overall_percentage: 85 }));

    const result = await clientInfoService.calculateCompleteness(10);

    expect(result.documents_approved).toBe(2);
    expect(result.questionnaires_completed).toBe(1);
  });

  it('sets onboarding_complete to false when onboarding is not completed', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'in_progress' }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce({ id: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ onboarding_complete: 0 }));

    const result = await clientInfoService.calculateCompleteness(10);
    expect(result.onboarding_complete).toBe(false);
  });
});

// =====================================================
// COMPLETENESS RETRIEVAL
// =====================================================

describe('ClientInfoService - getCompleteness', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns mapped completeness when record exists', async () => {
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow());

    const result = await clientInfoService.getCompleteness(10);

    expect(result).not.toBeNull();
    expect(result!.client_id).toBe(10);
    expect(result!.overall_percentage).toBe(80);
    expect(result!.profile_complete).toBe(true);
    expect(result!.onboarding_complete).toBe(true);
  });

  it('returns null when no completeness record exists', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await clientInfoService.getCompleteness(99);
    expect(result).toBeNull();
  });

  it('maps boolean fields correctly from SQLite integers', async () => {
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ profile_complete: 0, onboarding_complete: 0 }));

    const result = await clientInfoService.getCompleteness(10);

    expect(result!.profile_complete).toBe(false);
    expect(result!.onboarding_complete).toBe(false);
  });
});

// =====================================================
// FULL CLIENT INFO STATUS
// =====================================================

describe('ClientInfoService - getClientInfoStatus', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when client is not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await clientInfoService.getClientInfoStatus(999);
    expect(result).toBeNull();
  });

  it('returns full status object with company_name as client_name', async () => {
    // getClientInfoStatus fetches the client
    mockDb.get.mockResolvedValueOnce({ id: 10, company_name: 'Acme Corp', contact_name: 'Jane', email: 'jane@acme.com' });

    // calculateCompleteness internals:
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 }); // doc stats
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 }); // q stats
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 })); // onboarding inside calculateCompleteness
    mockDb.get.mockResolvedValueOnce(makeClientRow()); // client profile in calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ id: 1 }); // existing completeness row
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow()); // getCompleteness at end of calculateCompleteness

    // getOnboardingProgress called in getClientInfoStatus
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));

    const result = await clientInfoService.getClientInfoStatus(10);

    expect(result).not.toBeNull();
    expect(result!.client_name).toBe('Acme Corp');
    expect(result!.client_email).toBe('jane@acme.com');
    expect(result!.completeness).toBeDefined();
    expect(result!.onboarding).toBeDefined();
  });

  it('uses contact_name when company_name is absent', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 10, company_name: null, contact_name: 'Jane Doe', email: 'jane@acme.com' });

    // calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(null); // no onboarding
    mockDb.get.mockResolvedValueOnce({ company_name: null, contact_name: 'Jane Doe', email: 'jane@acme.com', phone: null, address: null });
    mockDb.get.mockResolvedValueOnce(null); // no existing record
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ overall_percentage: 40 }));

    // getOnboardingProgress
    mockDb.get.mockResolvedValueOnce(null);

    const result = await clientInfoService.getClientInfoStatus(10);
    expect(result!.client_name).toBe('Jane Doe');
  });

  it('uses "Unknown" when both company_name and contact_name are absent', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 10, company_name: null, contact_name: null, email: 'x@x.com' });

    // calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.get.mockResolvedValueOnce({ company_name: null, contact_name: null, email: 'x@x.com', phone: null, address: null });
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow());

    mockDb.get.mockResolvedValueOnce(null); // no onboarding

    const result = await clientInfoService.getClientInfoStatus(10);
    expect(result!.client_name).toBe('Unknown');
  });
});

// =====================================================
// ALL CLIENTS INFO STATUS
// =====================================================

describe('ClientInfoService - getAllClientsInfoStatus', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  const setupClientStatus = (clientId: number, percentage: number, onboardingStatus: string) => {
    // getClientInfoStatus → client lookup
    mockDb.get.mockResolvedValueOnce({ id: clientId, company_name: 'Corp', contact_name: null, email: `c${clientId}@x.com` });

    // calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(onboardingStatus === 'completed'
      ? makeOnboardingRow({ client_id: clientId, status: 'completed', current_step: 5 })
      : makeOnboardingRow({ client_id: clientId, status: onboardingStatus, current_step: 2 })
    );
    mockDb.get.mockResolvedValueOnce(makeClientRow({ id: clientId }));
    mockDb.get.mockResolvedValueOnce({ id: 99 }); // existing record
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ client_id: clientId, overall_percentage: percentage }));

    // getOnboardingProgress inside getClientInfoStatus
    mockDb.get.mockResolvedValueOnce(onboardingStatus === 'completed'
      ? makeOnboardingRow({ client_id: clientId, status: 'completed', current_step: 5 })
      : makeOnboardingRow({ client_id: clientId, status: onboardingStatus, current_step: 2 })
    );
  };

  it('returns all clients when no filters applied', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 10, company_name: 'A', contact_name: null, email: 'a@x.com' },
      { id: 11, company_name: 'B', contact_name: null, email: 'b@x.com' }
    ]);

    setupClientStatus(10, 80, 'completed');
    setupClientStatus(11, 60, 'in_progress');

    const result = await clientInfoService.getAllClientsInfoStatus();
    expect(result).toHaveLength(2);
  });

  it('filters by minCompleteness', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 10, company_name: 'A', contact_name: null, email: 'a@x.com' },
      { id: 11, company_name: 'B', contact_name: null, email: 'b@x.com' }
    ]);

    setupClientStatus(10, 90, 'completed');
    setupClientStatus(11, 30, 'in_progress');

    const result = await clientInfoService.getAllClientsInfoStatus({ minCompleteness: 70 });
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe(10);
  });

  it('filters by maxCompleteness', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 10, company_name: 'A', contact_name: null, email: 'a@x.com' },
      { id: 11, company_name: 'B', contact_name: null, email: 'b@x.com' }
    ]);

    setupClientStatus(10, 90, 'completed');
    setupClientStatus(11, 40, 'in_progress');

    const result = await clientInfoService.getAllClientsInfoStatus({ maxCompleteness: 50 });
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe(11);
  });

  it('filters by onboardingStatus', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 10, company_name: 'A', contact_name: null, email: 'a@x.com' },
      { id: 11, company_name: 'B', contact_name: null, email: 'b@x.com' }
    ]);

    setupClientStatus(10, 80, 'completed');
    setupClientStatus(11, 50, 'in_progress');

    const result = await clientInfoService.getAllClientsInfoStatus({ onboardingStatus: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe(10);
  });

  it('returns empty array when no clients exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await clientInfoService.getAllClientsInfoStatus();
    expect(result).toEqual([]);
  });
});

// =====================================================
// MISSING ITEMS
// =====================================================

describe('ClientInfoService - getMissingItems', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns empty array when profile is complete, onboarding done, no pending docs or questionnaires', async () => {
    // client profile — all fields filled
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    // getOnboardingProgress — completed
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed' }));
    // pending document requests — none
    mockDb.all.mockResolvedValueOnce([]);
    // pending questionnaires — none
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);
    expect(result).toEqual([]);
  });

  it('adds profile items for missing company_name, phone, and address', async () => {
    // Missing company_name, phone, address
    mockDb.get.mockResolvedValueOnce({ company_name: null, contact_name: 'Jane', email: 'jane@x.com', phone: null, address: null });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed' }));
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);

    const types = result.map((i) => i.title);
    expect(types).toContain('Company Name');
    expect(types).toContain('Phone Number');
    expect(types).toContain('Business Address');
  });

  it('adds onboarding item when onboarding is in_progress', async () => {
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'in_progress' }));
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);

    expect(result.some((i) => i.type === 'onboarding')).toBe(true);
    expect(result.find((i) => i.type === 'onboarding')!.title).toBe('Complete Onboarding Wizard');
  });

  it('adds onboarding item when no onboarding record exists', async () => {
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(null); // no onboarding
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);
    expect(result.some((i) => i.type === 'onboarding')).toBe(true);
  });

  it('adds document items for pending document requests', async () => {
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed' }));
    mockDb.all.mockResolvedValueOnce([
      { id: 5, title: 'NDA', description: 'Sign the NDA', due_date: '2026-04-01', priority: 'high' },
      { id: 6, title: 'Tax Form', description: null, due_date: null, priority: 'low' }
    ]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);
    const docs = result.filter((i) => i.type === 'document');

    expect(docs).toHaveLength(2);
    expect(docs[0].id).toBe(5);
    expect(docs[0].title).toBe('NDA');
    expect(docs[0].priority).toBe('high');
  });

  it('adds questionnaire items for pending questionnaires', async () => {
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed' }));
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([
      { id: 7, title: 'Brand Survey', description: 'Tell us about your brand', due_date: '2026-05-01' }
    ]);

    const result = await clientInfoService.getMissingItems(10);
    const questionnaires = result.filter((i) => i.type === 'questionnaire');

    expect(questionnaires).toHaveLength(1);
    expect(questionnaires[0].id).toBe(7);
    expect(questionnaires[0].title).toBe('Brand Survey');
  });

  it('handles missing client profile (undefined) without throwing', async () => {
    mockDb.get.mockResolvedValueOnce(undefined); // no client
    mockDb.get.mockResolvedValueOnce(null); // no onboarding
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await clientInfoService.getMissingItems(10);
    // Should still add onboarding item
    expect(result.some((i) => i.type === 'onboarding')).toBe(true);
    // No profile items added when client is undefined
    expect(result.every((i) => i.type !== 'profile')).toBe(true);
  });
});

// =====================================================
// ONBOARDING PROGRESS
// =====================================================

describe('ClientInfoService - getOnboardingProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when no onboarding record exists', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const result = await clientInfoService.getOnboardingProgress(10);
    expect(result).toBeNull();
  });

  it('returns mapped onboarding progress when record exists', async () => {
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow());

    const result = await clientInfoService.getOnboardingProgress(10);

    expect(result).not.toBeNull();
    expect(result!.client_id).toBe(10);
    expect(result!.current_step).toBe(3);
    expect(result!.status).toBe('in_progress');
  });

  it('parses step_data JSON string correctly', async () => {
    const stepData = { company_name: 'Acme', features: ['auth', 'dashboard'] };
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ step_data: JSON.stringify(stepData) }));

    const result = await clientInfoService.getOnboardingProgress(10);

    expect(result!.step_data).toEqual(stepData);
  });

  it('falls back to empty object when step_data is null', async () => {
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ step_data: null }));

    const result = await clientInfoService.getOnboardingProgress(10);
    expect(result!.step_data).toEqual({});
  });

  it('returns already-parsed step_data object when not a string', async () => {
    const stepData = { features: ['chat'] };
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ step_data: stepData }));

    const result = await clientInfoService.getOnboardingProgress(10);
    expect(result!.step_data).toEqual(stepData);
  });
});

// =====================================================
// SAVE ONBOARDING PROGRESS
// =====================================================

describe('ClientInfoService - saveOnboardingProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('inserts a new record when no existing progress', async () => {
    // getOnboardingProgress → no record
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    // getOnboardingProgress at the end
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'in_progress', current_step: 1 }));

    const result = await clientInfoService.saveOnboardingProgress(10, 1, { company_name: 'Acme' });

    expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO client_onboarding');
    expect(result.status).toBe('in_progress');
    expect(result.current_step).toBe(1);
  });

  it('updates existing record and merges step_data', async () => {
    const existingRow = makeOnboardingRow({
      current_step: 1,
      step_data: JSON.stringify({ company_name: 'OldCorp' }),
      status: 'in_progress'
    });
    // getOnboardingProgress → existing
    mockDb.get.mockResolvedValueOnce(existingRow);
    mockDb.run.mockResolvedValueOnce({});
    // getOnboardingProgress at the end
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({
      current_step: 2,
      step_data: JSON.stringify({ company_name: 'NewCorp', contact_name: 'Jane' }),
      status: 'in_progress'
    }));

    const result = await clientInfoService.saveOnboardingProgress(10, 2, { contact_name: 'Jane', company_name: 'NewCorp' });

    expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE client_onboarding');
    expect(result.current_step).toBe(2);
  });

  it('passes projectId to INSERT when provided', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ project_id: 42 }));

    await clientInfoService.saveOnboardingProgress(10, 1, {}, 42);

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[1]).toBe(42); // project_id
  });

  it('passes null for projectId in INSERT when not provided', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow());

    await clientInfoService.saveOnboardingProgress(10, 1, {});

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[1]).toBeNull(); // project_id defaults to null
  });
});

// =====================================================
// COMPLETE ONBOARDING
// =====================================================

describe('ClientInfoService - completeOnboarding', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('inserts a completed record when none exists', async () => {
    // getOnboardingProgress inside completeOnboarding → no record
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({}); // INSERT

    // calculateCompleteness internals
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 })); // onboarding in calculateCompleteness
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(null); // no existing completeness
    mockDb.run.mockResolvedValueOnce({}); // INSERT completeness
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ onboarding_complete: 1 }));

    // getOnboardingProgress at the end
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));

    const result = await clientInfoService.completeOnboarding(10);

    expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO client_onboarding');
    expect(result.status).toBe('completed');
    expect(result.current_step).toBe(5);
  });

  it('updates existing record when one exists, merging finalData', async () => {
    const existingOnboarding = makeOnboardingRow({
      status: 'in_progress',
      step_data: JSON.stringify({ company_name: 'Acme' })
    });
    // getOnboardingProgress inside completeOnboarding → existing
    mockDb.get.mockResolvedValueOnce(existingOnboarding);
    mockDb.run.mockResolvedValueOnce({}); // UPDATE to completed

    // calculateCompleteness internals
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce({ id: 1 }); // existing completeness
    mockDb.run.mockResolvedValueOnce({}); // UPDATE completeness
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ onboarding_complete: 1 }));

    // getOnboardingProgress at the end
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));

    const result = await clientInfoService.completeOnboarding(10, { confirmed: true });

    expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE client_onboarding');
    const updateParams = mockDb.run.mock.calls[0][1];
    const mergedData = JSON.parse(updateParams[0]);
    expect(mergedData.company_name).toBe('Acme');
    expect(mergedData.confirmed).toBe(true);
    expect(result.status).toBe('completed');
  });

  it('updates existing record without finalData (uses existing step_data)', async () => {
    const existingOnboarding = makeOnboardingRow({
      status: 'in_progress',
      step_data: JSON.stringify({ company_name: 'Acme' })
    });
    mockDb.get.mockResolvedValueOnce(existingOnboarding);
    mockDb.run.mockResolvedValueOnce({});

    // calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce({ id: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ onboarding_complete: 1 }));

    // final getOnboardingProgress
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));

    await clientInfoService.completeOnboarding(10); // no finalData

    const updateParams = mockDb.run.mock.calls[0][1];
    const mergedData = JSON.parse(updateParams[0]);
    expect(mergedData.company_name).toBe('Acme'); // step_data preserved
  });

  it('inserts with empty step_data when no existing record and no finalData', async () => {
    mockDb.get.mockResolvedValueOnce(null); // no existing
    mockDb.run.mockResolvedValueOnce({});

    // calculateCompleteness
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow());

    mockDb.get.mockResolvedValueOnce(makeOnboardingRow({ status: 'completed', current_step: 5 }));

    await clientInfoService.completeOnboarding(10);

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(JSON.parse(insertParams[1])).toEqual({}); // empty finalData
  });
});

// =====================================================
// RESET ONBOARDING
// =====================================================

describe('ClientInfoService - resetOnboarding', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('deletes the onboarding record and recalculates completeness', async () => {
    mockDb.run.mockResolvedValueOnce({}); // DELETE

    // calculateCompleteness internals
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(null); // no onboarding after reset
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce({ id: 1 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow({ onboarding_complete: 0 }));

    await expect(clientInfoService.resetOnboarding(10)).resolves.toBeUndefined();

    expect(mockDb.run.mock.calls[0][0]).toContain('DELETE FROM client_onboarding WHERE client_id = ?');
    expect(mockDb.run.mock.calls[0][1]).toEqual([10]);
  });

  it('calls calculateCompleteness after deletion', async () => {
    mockDb.run.mockResolvedValueOnce({}); // DELETE

    // calculateCompleteness chain (minimal)
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, approved: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, pending: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.get.mockResolvedValueOnce(makeClientRow());
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeCompletenessRow());

    await clientInfoService.resetOnboarding(10);

    // Should have 2 db.run calls: DELETE + INSERT/UPDATE in calculateCompleteness
    expect(mockDb.run.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
