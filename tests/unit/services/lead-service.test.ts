/**
 * ===============================================
 * UNIT TESTS - LEAD SERVICE
 * ===============================================
 * @file tests/unit/services/lead-service.test.ts
 *
 * Tests for lead management service including:
 * - Scoring rules CRUD
 * - Lead score calculation (all operator branches)
 * - Pipeline management
 * - Task CRUD and lifecycle
 * - Notes CRUD
 * - Lead sources
 * - Assignment
 * - Duplicate detection
 * - Bulk operations
 * - Analytics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =====================================================
// Mock dependencies before imports
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

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock('../../../server/database/entities/index', () => ({
  toScoringRule: vi.fn((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    fieldName: row.field_name,
    operator: row.operator,
    thresholdValue: row.threshold_value,
    points: row.points,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toPipelineStage: vi.fn((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    winProbability: parseFloat(String(row.win_probability)),
    isWon: row.is_won === 1,
    isLost: row.is_lost === 1,
    autoConvertToProject: row.auto_convert_to_project === 1,
    createdAt: row.created_at
  })),
  toLeadTask: vi.fn((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    dueDate: row.due_date,
    dueTime: row.due_time,
    status: row.status,
    assignedTo: row.assigned_to_name,
    priority: row.priority,
    reminderAt: row.reminder_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toLeadNote: vi.fn((row) => ({
    id: row.id,
    projectId: row.project_id,
    author: row.author_name,
    content: row.content,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toLeadSource: vi.fn((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  })),
  toLeadSummary: vi.fn((row) => ({
    id: row.id,
    projectName: row.project_name,
    clientName: row.contact_name,
    companyName: row.company_name,
    budgetRange: row.budget_range,
    leadScore: row.lead_score || 0,
    expectedValue: row.expected_value,
    expectedCloseDate: row.expected_close_date,
    assignedTo: row.assigned_to,
    createdAt: row.created_at
  })),
  toDuplicateResult: vi.fn((row) => ({
    id: row.id,
    leadId1: row.lead_id_1,
    leadId2: row.lead_id_2,
    similarityScore: parseFloat(String(row.similarity_score)),
    matchFields: row.match_fields ? JSON.parse(row.match_fields) : [],
    status: row.status,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at
  }))
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
import { leadService } from '../../../server/services/lead-service';
import { userService } from '../../../server/services/user-service';

// =====================================================
// Shared fixture factories
// =====================================================

const makeScoringRuleRow = (overrides = {}) => ({
  id: 1,
  name: 'Budget Rule',
  description: 'High budget',
  field_name: 'budget_range',
  operator: 'equals',
  threshold_value: 'high',
  points: 20,
  is_active: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makePipelineStageRow = (overrides = {}) => ({
  id: 1,
  name: 'Prospecting',
  description: 'Initial stage',
  color: '#000000',
  sort_order: 1,
  win_probability: 0.1,
  is_won: 0,
  is_lost: 0,
  auto_convert_to_project: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeTaskRow = (overrides = {}) => ({
  id: 1,
  project_id: 10,
  title: 'Follow up',
  description: 'Call back',
  task_type: 'follow_up',
  due_date: '2026-04-01',
  due_time: null,
  status: 'pending',
  assigned_to_user_id: 1,
  assigned_to_name: 'Alice',
  priority: 'medium',
  reminder_at: null,
  completed_at: null,
  completed_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeNoteRow = (overrides = {}) => ({
  id: 1,
  project_id: 10,
  author_user_id: 1,
  author_name: 'Alice',
  content: 'Interesting lead',
  is_pinned: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeLeadSourceRow = (overrides = {}) => ({
  id: 1,
  name: 'Website',
  description: 'Organic',
  is_active: 1,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeProjectRow = (overrides = {}) => ({
  id: 10,
  client_id: 5,
  project_name: 'Acme Website',
  description: 'A big project',
  status: 'pending',
  priority: 'high',
  budget_range: 'high',
  project_type: 'web',
  lead_score: 50,
  pipeline_stage_id: 1,
  assigned_to: 'alice@example.com',
  expected_value: '5000',
  expected_close_date: '2026-06-01',
  contact_name: 'Bob Smith',
  company_name: 'Acme Corp',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeDuplicateRow = (overrides = {}) => ({
  id: 1,
  lead_id_1: 10,
  lead_id_2: 11,
  similarity_score: '0.8',
  match_fields: JSON.stringify(['email']),
  status: 'pending',
  resolved_at: null,
  resolved_by: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// =====================================================
// SCORING RULES
// =====================================================

describe('LeadService - Scoring Rules', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getScoringRules', () => {
    it('returns active rules by default (WHERE is_active = 1)', async () => {
      const row = makeScoringRuleRow();
      mockDb.all.mockResolvedValueOnce([row]);

      const result = await leadService.getScoringRules();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Budget Rule');
      const callArg: string = mockDb.all.mock.calls[0][0];
      expect(callArg).toContain('is_active = 1');
    });

    it('returns all rules when includeInactive is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeScoringRuleRow(), makeScoringRuleRow({ id: 2, is_active: 0 })]);

      const result = await leadService.getScoringRules(true);

      expect(result).toHaveLength(2);
      const callArg: string = mockDb.all.mock.calls[0][0];
      expect(callArg).not.toContain('is_active = 1');
    });

    it('returns empty array when no rules exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getScoringRules();

      expect(result).toEqual([]);
    });
  });

  describe('createScoringRule', () => {
    it('creates a scoring rule and returns mapped result', async () => {
      const row = makeScoringRuleRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(row);

      const result = await leadService.createScoringRule({
        name: 'Budget Rule',
        fieldName: 'budget_range',
        operator: 'equals',
        thresholdValue: 'high',
        points: 20
      });

      expect(result.name).toBe('Budget Rule');
      expect(mockDb.run).toHaveBeenCalledOnce();
    });

    it('defaults isActive to true when not specified', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeScoringRuleRow());

      await leadService.createScoringRule({
        name: 'Rule',
        fieldName: 'priority',
        operator: 'equals',
        thresholdValue: 'high',
        points: 10
      });

      const insertCall = mockDb.run.mock.calls[0];
      const params = insertCall[1] as unknown[];
      // is_active is last param before the id — index 6
      expect(params[6]).toBe(1);
    });

    it('sets isActive to 0 when explicitly false', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeScoringRuleRow({ id: 2, is_active: 0 }));

      await leadService.createScoringRule({
        name: 'Inactive Rule',
        fieldName: 'priority',
        operator: 'equals',
        thresholdValue: 'low',
        points: 5,
        isActive: false
      });

      const insertParams = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertParams[6]).toBe(0);
    });

    it('throws when db.get returns null after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 99 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(
        leadService.createScoringRule({
          name: 'Rule',
          fieldName: 'priority',
          operator: 'equals',
          thresholdValue: 'high',
          points: 10
        })
      ).rejects.toThrow('Failed to create scoring rule');
    });
  });

  describe('updateScoringRule', () => {
    it('updates only provided fields', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeScoringRuleRow({ name: 'Updated Rule' }));

      const result = await leadService.updateScoringRule(1, { name: 'Updated Rule' });

      expect(mockDb.run).toHaveBeenCalledOnce();
      expect(result.name).toBe('Updated Rule');
    });

    it('updates all fields when all are provided', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeScoringRuleRow());

      await leadService.updateScoringRule(1, {
        name: 'New Name',
        description: 'New desc',
        fieldName: 'project_type',
        operator: 'contains',
        thresholdValue: 'web',
        points: 15,
        isActive: false
      });

      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('name = ?');
      expect(sql).toContain('description = ?');
      expect(sql).toContain('field_name = ?');
      expect(sql).toContain('operator = ?');
      expect(sql).toContain('threshold_value = ?');
      expect(sql).toContain('points = ?');
      expect(sql).toContain('is_active = ?');
    });

    it('skips db.run when no updates provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeScoringRuleRow());

      await leadService.updateScoringRule(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('throws when rule not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.updateScoringRule(1, { name: 'X' })).rejects.toThrow(
        'Scoring rule not found'
      );
    });
  });

  describe('deleteScoringRule', () => {
    it('executes DELETE query', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.deleteScoringRule(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM lead_scoring_rules WHERE id = ?',
        [1]
      );
    });
  });
});

// =====================================================
// LEAD SCORE CALCULATION
// =====================================================

describe('LeadService - calculateLeadScore', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when project not found', async () => {
    mockDb.get.mockResolvedValueOnce(null); // project query

    await expect(leadService.calculateLeadScore(99)).rejects.toThrow('Project not found');
  });

  it('calculates score with equals operator match', async () => {
    const project = makeProjectRow({ budget_range: 'high' });
    mockDb.get.mockResolvedValueOnce(project); // project
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ operator: 'equals', threshold_value: 'high', points: 20 })
    ]); // getScoringRules
    mockDb.run.mockResolvedValueOnce({}); // UPDATE projects

    const result = await leadService.calculateLeadScore(10);

    expect(result.score).toBe(20);
    expect(result.breakdown[0].matched).toBe(true);
  });

  it('calculates score with contains operator match', async () => {
    const project = makeProjectRow({ description: 'enterprise software solution' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'description', operator: 'contains', threshold_value: 'enterprise', points: 15 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);

    expect(result.score).toBe(15);
    expect(result.breakdown[0].matched).toBe(true);
  });

  it('calculates score with greater_than operator match', async () => {
    // budget_range "200" → parseFloat(200) > 100 → true
    const project = makeProjectRow({ budget_range: '200' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'budget_range', operator: 'greater_than', threshold_value: '100', points: 10 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(true);
    expect(result.score).toBe(10);
  });

  it('calculates score with greater_than operator no match', async () => {
    // budget_range "50" → parseFloat(50) > 100 → false
    const project = makeProjectRow({ budget_range: '50' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'budget_range', operator: 'greater_than', threshold_value: '100', points: 10 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(false);
  });

  it('calculates score with less_than operator match', async () => {
    const project = makeProjectRow({ expected_close_date: '50' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'timeline', operator: 'less_than', threshold_value: '100', points: 10 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(true);
  });

  it('calculates score with in operator match', async () => {
    const project = makeProjectRow({ project_type: 'web' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'project_type', operator: 'in', threshold_value: 'web,mobile,api', points: 10 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(true);
  });

  it('calculates score with not_empty operator match', async () => {
    const project = makeProjectRow({ description: 'Has content' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'description', operator: 'not_empty', threshold_value: '', points: 5 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(true);
  });

  it('not_empty returns false for empty string', async () => {
    const project = makeProjectRow({ description: '   ' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ field_name: 'description', operator: 'not_empty', threshold_value: '', points: 5 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.breakdown[0].matched).toBe(false);
  });

  it('caps score at 100', async () => {
    const project = makeProjectRow({ budget_range: 'high' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ operator: 'equals', threshold_value: 'high', points: 60 }),
      makeScoringRuleRow({ id: 2, operator: 'equals', threshold_value: 'high', points: 60 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.score).toBe(100);
  });

  it('returns 0 score when no rules match', async () => {
    const project = makeProjectRow({ budget_range: 'low' });
    mockDb.get.mockResolvedValueOnce(project);
    mockDb.all.mockResolvedValueOnce([
      makeScoringRuleRow({ operator: 'equals', threshold_value: 'high', points: 20 })
    ]);
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.score).toBe(0);
    expect(result.breakdown[0].matched).toBe(false);
  });

  it('returns score 0 when no scoring rules exist', async () => {
    mockDb.get.mockResolvedValueOnce(makeProjectRow());
    mockDb.all.mockResolvedValueOnce([]); // no rules
    mockDb.run.mockResolvedValueOnce({});

    const result = await leadService.calculateLeadScore(10);
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual([]);
  });
});

// =====================================================
// updateAllLeadScores
// =====================================================

describe('LeadService - updateAllLeadScores', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns count of leads updated', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // SELECT leads

    // For each calculateLeadScore call (id=1, id=2):
    mockDb.get.mockResolvedValueOnce(makeProjectRow({ id: 1 }));
    mockDb.all.mockResolvedValueOnce([]); // no scoring rules
    mockDb.run.mockResolvedValueOnce({});

    mockDb.get.mockResolvedValueOnce(makeProjectRow({ id: 2 }));
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.run.mockResolvedValueOnce({});

    const count = await leadService.updateAllLeadScores();
    expect(count).toBe(2);
  });

  it('returns 0 when no leads exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const count = await leadService.updateAllLeadScores();
    expect(count).toBe(0);
  });
});

// =====================================================
// PIPELINE MANAGEMENT
// =====================================================

describe('LeadService - Pipeline Management', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getPipelineStages', () => {
    it('returns all pipeline stages ordered by sort_order', async () => {
      mockDb.all.mockResolvedValueOnce([makePipelineStageRow()]);

      const result = await leadService.getPipelineStages();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Prospecting');
    });

    it('returns empty array when no stages exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getPipelineStages();
      expect(result).toEqual([]);
    });
  });

  describe('moveToStage', () => {
    it('throws when stage not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.moveToStage(10, 999)).rejects.toThrow('Pipeline stage not found');
    });

    it('moves lead to a regular stage', async () => {
      mockDb.get.mockResolvedValueOnce(makePipelineStageRow({ is_won: 0, is_lost: 0 }));
      mockDb.run.mockResolvedValueOnce({});

      await leadService.moveToStage(10, 1);

      expect(mockDb.run).toHaveBeenCalledOnce();
      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('pipeline_stage_id = ?');
      expect(sql).not.toContain('won_at');
      expect(sql).not.toContain('lost_at');
    });

    it('sets won_at when moving to a won stage', async () => {
      mockDb.get.mockResolvedValueOnce(makePipelineStageRow({ is_won: 1, auto_convert_to_project: 0 }));
      mockDb.run.mockResolvedValueOnce({});

      await leadService.moveToStage(10, 2);

      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('won_at = CURRENT_TIMESTAMP');
    });

    it('sets status to in-progress when auto_convert_to_project is true', async () => {
      mockDb.get.mockResolvedValueOnce(makePipelineStageRow({ is_won: 1, auto_convert_to_project: 1 }));
      mockDb.run.mockResolvedValueOnce({});

      await leadService.moveToStage(10, 2);

      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('status = \'in-progress\'');
    });

    it('sets lost_at and status on-hold when moving to a lost stage', async () => {
      mockDb.get.mockResolvedValueOnce(makePipelineStageRow({ is_lost: 1 }));
      mockDb.run.mockResolvedValueOnce({});

      await leadService.moveToStage(10, 3);

      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('lost_at = CURRENT_TIMESTAMP');
      expect(sql).toContain('status = \'on-hold\'');
    });
  });

  describe('getPipelineView', () => {
    it('returns stages with leads and calculated values', async () => {
      const stage = makePipelineStageRow({ win_probability: 0.5 });
      const lead = makeProjectRow({ expected_value: '1000' });

      // getPipelineStages
      mockDb.all.mockResolvedValueOnce([stage]);
      // leads per stage
      mockDb.all.mockResolvedValueOnce([lead]);
      // unstaged leads
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getPipelineView();

      expect(result.stages).toHaveLength(1);
      expect(result.totalValue).toBe(1000);
      expect(result.weightedValue).toBe(500);
    });

    it('appends unstaged leads to the first stage if it exists', async () => {
      const stage = makePipelineStageRow({ id: 1 });

      mockDb.all.mockResolvedValueOnce([stage]); // getPipelineStages
      mockDb.all.mockResolvedValueOnce([]); // staged leads for stage 1
      mockDb.all.mockResolvedValueOnce([makeProjectRow({ id: 20 })]); // unstaged leads

      const result = await leadService.getPipelineView();

      expect(result.stages[0].leads).toHaveLength(1);
    });

    it('handles no stages gracefully', async () => {
      mockDb.all.mockResolvedValueOnce([]); // no stages
      mockDb.all.mockResolvedValueOnce([]); // no unstaged leads

      const result = await leadService.getPipelineView();

      expect(result.stages).toHaveLength(0);
      expect(result.totalValue).toBe(0);
    });
  });

  describe('getPipelineStats', () => {
    it('returns stats with correct conversion rate', async () => {
      mockDb.get.mockResolvedValueOnce({ total_leads: 10, total_value: '50000', avg_days: 14 });
      mockDb.get.mockResolvedValueOnce({ count: 3 }); // won
      mockDb.get.mockResolvedValueOnce({ count: 2 }); // lost
      mockDb.all.mockResolvedValueOnce([]); // getPipelineStages

      const result = await leadService.getPipelineStats();

      expect(result.totalLeads).toBe(10);
      expect(result.totalValue).toBe(50000);
      expect(result.conversionRate).toBeCloseTo(0.6); // 3 / (3+2)
      expect(result.avgDaysInPipeline).toBe(14);
    });

    it('returns conversionRate 0 when no closed leads', async () => {
      mockDb.get.mockResolvedValueOnce({ total_leads: 5, total_value: '0', avg_days: 0 });
      mockDb.get.mockResolvedValueOnce({ count: 0 }); // won
      mockDb.get.mockResolvedValueOnce({ count: 0 }); // lost
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getPipelineStats();

      expect(result.conversionRate).toBe(0);
    });

    it('handles null stats gracefully', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getPipelineStats();

      expect(result.totalLeads).toBe(0);
      expect(result.totalValue).toBe(0);
      expect(result.avgDaysInPipeline).toBe(0);
    });

    it('includes stage breakdown per pipeline stage', async () => {
      mockDb.get.mockResolvedValueOnce({ total_leads: 5, total_value: '2000', avg_days: 7 });
      mockDb.get.mockResolvedValueOnce({ count: 1 });
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.all.mockResolvedValueOnce([makePipelineStageRow()]); // getPipelineStages
      mockDb.get.mockResolvedValueOnce({ count: 3, value: '1500' }); // stage stats

      const result = await leadService.getPipelineStats();

      expect(result.stageBreakdown).toHaveLength(1);
      expect(result.stageBreakdown[0].count).toBe(3);
      expect(result.stageBreakdown[0].value).toBe(1500);
    });
  });
});

// =====================================================
// TASK MANAGEMENT
// =====================================================

describe('LeadService - Task Management', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(1);
  });

  describe('createTask', () => {
    it('creates a task and returns mapped result', async () => {
      const task = makeTaskRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      // no dueDate update
      mockDb.get.mockResolvedValueOnce(task);

      const result = await leadService.createTask(10, { title: 'Follow up' });

      expect(result.title).toBe('Follow up');
      expect(mockDb.run).toHaveBeenCalledOnce();
    });

    it('updates next_follow_up_at when dueDate is provided', async () => {
      const task = makeTaskRow({ due_date: '2026-04-01' });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.run.mockResolvedValueOnce({}); // UPDATE next_follow_up_at
      mockDb.get.mockResolvedValueOnce(task);

      await leadService.createTask(10, { title: 'Call', dueDate: '2026-04-01' });

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      const secondRunSql: string = mockDb.run.mock.calls[1][0];
      expect(secondRunSql).toContain('next_follow_up_at');
    });

    it('uses default taskType follow_up when not provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeTaskRow());

      await leadService.createTask(10, { title: 'Task' });

      const insertParams = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertParams[3]).toBe('follow_up');
    });

    it('uses default priority medium when not provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeTaskRow());

      await leadService.createTask(10, { title: 'Task' });

      const insertParams = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertParams[7]).toBe('medium');
    });

    it('throws when task not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.createTask(10, { title: 'Task' })).rejects.toThrow(
        'Failed to create task'
      );
    });
  });

  describe('getTasks', () => {
    it('returns tasks for a project', async () => {
      mockDb.all.mockResolvedValueOnce([makeTaskRow(), makeTaskRow({ id: 2 })]);

      const result = await leadService.getTasks(10);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no tasks exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getTasks(10);
      expect(result).toEqual([]);
    });
  });

  describe('updateTask', () => {
    it('updates task fields and returns mapped result', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeTaskRow({ title: 'Updated' }));

      const result = await leadService.updateTask(1, { title: 'Updated', priority: 'high' });

      expect(result.title).toBe('Updated');
      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('title = ?');
      expect(sql).toContain('priority = ?');
    });

    it('calls getUserIdByEmail when assignedTo is provided', async () => {
      vi.mocked(userService.getUserIdByEmail).mockResolvedValueOnce(5);
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeTaskRow());

      await leadService.updateTask(1, { assignedTo: 'bob@example.com' });

      expect(userService.getUserIdByEmail).toHaveBeenCalledWith('bob@example.com');
    });

    it('skips db.run when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeTaskRow());

      await leadService.updateTask(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('updates status field', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeTaskRow({ status: 'completed' }));

      await leadService.updateTask(1, { status: 'completed' });

      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('status = ?');
    });

    it('throws when task not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.updateTask(1, { title: 'X' })).rejects.toThrow('Task not found');
    });
  });

  describe('completeTask', () => {
    it('marks task as completed with default completedBy', async () => {
      const task = makeTaskRow({ status: 'completed', project_id: 10 });
      mockDb.run.mockResolvedValueOnce({}); // UPDATE status
      mockDb.get.mockResolvedValueOnce(task);
      mockDb.run.mockResolvedValueOnce({}); // UPDATE last_activity_at

      const result = await leadService.completeTask(1);

      expect(result.status).toBe('completed');
      const updateCall = mockDb.run.mock.calls[0];
      expect((updateCall[1] as unknown[])[0]).toBe('admin'); // default completedBy
    });

    it('marks task as completed with provided completedBy', async () => {
      const task = makeTaskRow({ status: 'completed', project_id: 10 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(task);
      mockDb.run.mockResolvedValueOnce({});

      await leadService.completeTask(1, 'alice@example.com');

      const completedByParam = mockDb.run.mock.calls[0][1] as unknown[];
      expect(completedByParam[0]).toBe('alice@example.com');
    });

    it('updates project last_activity_at after task completion', async () => {
      const task = makeTaskRow({ project_id: 10 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(task);
      mockDb.run.mockResolvedValueOnce({});

      await leadService.completeTask(1);

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      const lastActivitySql: string = mockDb.run.mock.calls[1][0];
      expect(lastActivitySql).toContain('last_activity_at');
    });

    it('throws when task not found after completion', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.completeTask(1)).rejects.toThrow('Task not found');
    });
  });

  describe('getOverdueTasks', () => {
    it('returns overdue tasks with projectName', async () => {
      const row = { ...makeTaskRow(), project_name: 'Acme Website' };
      mockDb.all.mockResolvedValueOnce([row]);

      const result = await leadService.getOverdueTasks();

      expect(result).toHaveLength(1);
      expect(result[0].projectName).toBe('Acme Website');
    });

    it('returns empty array when no overdue tasks', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getOverdueTasks();
      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingTasks', () => {
    it('returns upcoming tasks within default 7 days', async () => {
      const row = { ...makeTaskRow(), project_name: 'Acme Website' };
      mockDb.all.mockResolvedValueOnce([row]);

      const result = await leadService.getUpcomingTasks();

      expect(result).toHaveLength(1);
      expect(result[0].projectName).toBe('Acme Website');
      const params = mockDb.all.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe(7);
    });

    it('passes custom days parameter', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await leadService.getUpcomingTasks(14);

      const params = mockDb.all.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe(14);
    });
  });
});

// =====================================================
// NOTES
// =====================================================

describe('LeadService - Notes', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmailOrName).mockResolvedValue(1);
  });

  describe('addNote', () => {
    it('creates a note and updates last_activity_at', async () => {
      const note = makeNoteRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.run.mockResolvedValueOnce({}); // UPDATE last_activity_at
      mockDb.get.mockResolvedValueOnce(note);

      const result = await leadService.addNote(10, 'alice@example.com', 'Great lead');

      expect(result.content).toBe('Interesting lead');
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('looks up author user ID', async () => {
      vi.mocked(userService.getUserIdByEmailOrName).mockResolvedValueOnce(42);
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeNoteRow());

      await leadService.addNote(10, 'alice', 'Content');

      expect(userService.getUserIdByEmailOrName).toHaveBeenCalledWith('alice');
      const insertParams = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertParams[1]).toBe(42);
    });

    it('throws when note not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.addNote(10, 'alice', 'Content')).rejects.toThrow(
        'Failed to create note'
      );
    });
  });

  describe('getNotes', () => {
    it('returns notes ordered by pinned then date', async () => {
      mockDb.all.mockResolvedValueOnce([makeNoteRow(), makeNoteRow({ id: 2, is_pinned: 1 })]);

      const result = await leadService.getNotes(10);

      expect(result).toHaveLength(2);
      const sql: string = mockDb.all.mock.calls[0][0];
      expect(sql).toContain('is_pinned DESC');
    });

    it('returns empty array when no notes exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getNotes(10);
      expect(result).toEqual([]);
    });
  });

  describe('togglePinNote', () => {
    it('toggles pin status and returns updated note', async () => {
      const note = makeNoteRow({ is_pinned: 1 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(note);

      const result = await leadService.togglePinNote(1);

      expect(result.isPinned).toBe(true);
      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('is_pinned = NOT is_pinned');
    });

    it('throws when note not found after toggle', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.togglePinNote(999)).rejects.toThrow('Note not found');
    });
  });

  describe('deleteNote', () => {
    it('executes DELETE query', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.deleteNote(1);

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM lead_notes WHERE id = ?', [1]);
    });
  });
});

// =====================================================
// LEAD SOURCES
// =====================================================

describe('LeadService - Lead Sources', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getLeadSources', () => {
    it('returns active sources by default', async () => {
      mockDb.all.mockResolvedValueOnce([makeLeadSourceRow()]);

      const result = await leadService.getLeadSources();

      expect(result).toHaveLength(1);
      const sql: string = mockDb.all.mock.calls[0][0];
      expect(sql).toContain('is_active = 1');
    });

    it('returns all sources when includeInactive is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeLeadSourceRow(), makeLeadSourceRow({ id: 2, is_active: 0 })]);

      const result = await leadService.getLeadSources(true);

      expect(result).toHaveLength(2);
      const sql: string = mockDb.all.mock.calls[0][0];
      expect(sql).not.toContain('is_active = 1');
    });
  });

  describe('setLeadSource', () => {
    it('updates lead source for a project', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.setLeadSource(10, 3);

      expect(mockDb.run).toHaveBeenCalledOnce();
      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe(3);
      expect(params[1]).toBe(10);
    });
  });
});

// =====================================================
// ASSIGNMENT
// =====================================================

describe('LeadService - Assignment', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('assignLead', () => {
    it('updates assigned_to for a project', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.assignLead(10, 'bob@example.com');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('bob@example.com');
      expect(params[1]).toBe(10);
    });
  });

  describe('getMyLeads', () => {
    it('returns leads assigned to the given assignee', async () => {
      mockDb.all.mockResolvedValueOnce([makeProjectRow()]);

      const result = await leadService.getMyLeads('alice@example.com');

      expect(result).toHaveLength(1);
      const params = mockDb.all.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('alice@example.com');
    });

    it('returns empty array when no leads assigned', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getMyLeads('nobody@example.com');
      expect(result).toEqual([]);
    });
  });

  describe('getUnassignedLeads', () => {
    it('returns unassigned leads', async () => {
      mockDb.all.mockResolvedValueOnce([makeProjectRow({ assigned_to: null })]);

      const result = await leadService.getUnassignedLeads();

      expect(result).toHaveLength(1);
      const sql: string = mockDb.all.mock.calls[0][0];
      expect(sql).toContain('assigned_to IS NULL');
    });

    it('returns empty array when all leads are assigned', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getUnassignedLeads();
      expect(result).toEqual([]);
    });
  });
});

// =====================================================
// DUPLICATE DETECTION
// =====================================================

describe('LeadService - Duplicate Detection', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('findDuplicates', () => {
    it('throws when lead not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(leadService.findDuplicates(99)).rejects.toThrow('Lead not found');
    });

    it('returns empty array when no potential matches', async () => {
      mockDb.get.mockResolvedValueOnce(makeProjectRow({ id: 10 }));
      mockDb.all.mockResolvedValueOnce([]); // no potential matches

      const result = await leadService.findDuplicates(10);

      expect(result).toEqual([]);
    });

    it('creates a new duplicate record on email match', async () => {
      const lead = makeProjectRow({ id: 10, client_email: 'shared@example.com' });
      const match = makeProjectRow({ id: 11, client_email: 'shared@example.com' });

      mockDb.get.mockResolvedValueOnce(lead); // get lead
      mockDb.all.mockResolvedValueOnce([match]); // potential matches
      mockDb.get.mockResolvedValueOnce(null); // no existing duplicate record
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // insert duplicate

      const result = await leadService.findDuplicates(10);

      expect(result).toHaveLength(1);
      expect(result[0].leadId1).toBe(10);
      expect(result[0].leadId2).toBe(11);
      expect(result[0].matchFields).toContain('email');
      expect(mockDb.run).toHaveBeenCalledOnce();
    });

    it('returns existing pending duplicate without creating a new record', async () => {
      const lead = makeProjectRow({ id: 10, client_email: 'shared@example.com' });
      const match = makeProjectRow({ id: 11, client_email: 'shared@example.com' });
      const existingDup = makeDuplicateRow({ status: 'pending' });

      mockDb.get.mockResolvedValueOnce(lead);
      mockDb.all.mockResolvedValueOnce([match]);
      mockDb.get.mockResolvedValueOnce(existingDup); // existing duplicate found

      const result = await leadService.findDuplicates(10);

      expect(result).toHaveLength(1);
      expect(mockDb.run).not.toHaveBeenCalled(); // no new insert
    });

    it('skips already-resolved duplicates', async () => {
      const lead = makeProjectRow({ id: 10, client_email: 'shared@example.com' });
      const match = makeProjectRow({ id: 11, client_email: 'shared@example.com' });
      const resolvedDup = makeDuplicateRow({ status: 'not_duplicate' });

      mockDb.get.mockResolvedValueOnce(lead);
      mockDb.all.mockResolvedValueOnce([match]);
      mockDb.get.mockResolvedValueOnce(resolvedDup); // exists but resolved

      const result = await leadService.findDuplicates(10);

      expect(result).toHaveLength(0);
    });

    it('skips matches with score below 0.5', async () => {
      const lead = makeProjectRow({ id: 10, client_email: null, company_name: null, contact_name: null });
      const match = makeProjectRow({ id: 11, client_email: null, company_name: null, contact_name: null });

      mockDb.get.mockResolvedValueOnce(lead);
      mockDb.all.mockResolvedValueOnce([match]);

      const result = await leadService.findDuplicates(10);

      expect(result).toHaveLength(0);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('detects company name similarity above 0.8', async () => {
      const lead = makeProjectRow({ id: 10, company_name: 'Acme Corporation', client_email: null });
      const match = makeProjectRow({ id: 11, company_name: 'Acme Corporation', client_email: null });

      mockDb.get.mockResolvedValueOnce(lead);
      mockDb.all.mockResolvedValueOnce([match]);
      mockDb.get.mockResolvedValueOnce(null); // no existing record
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });

      const result = await leadService.findDuplicates(10);

      expect(result).toHaveLength(1);
      expect(result[0].matchFields).toContain('company_name');
    });
  });

  describe('getAllPendingDuplicates', () => {
    it('returns all pending duplicate records', async () => {
      mockDb.all.mockResolvedValueOnce([makeDuplicateRow()]);

      const result = await leadService.getAllPendingDuplicates();

      expect(result).toHaveLength(1);
      const sql: string = mockDb.all.mock.calls[0][0];
      expect(sql).toContain('status = \'pending\'');
    });

    it('returns empty array when no pending duplicates', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getAllPendingDuplicates();
      expect(result).toEqual([]);
    });
  });

  describe('resolveDuplicate', () => {
    it('marks duplicate as merged', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.resolveDuplicate(1, 'merged', 'admin@example.com');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('merged');
      expect(params[2]).toBe(1);
    });

    it('marks duplicate as not_duplicate', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.resolveDuplicate(1, 'not_duplicate', 'admin@example.com');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('not_duplicate');
    });

    it('marks duplicate as dismissed', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await leadService.resolveDuplicate(1, 'dismissed', 'admin@example.com');

      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('dismissed');
    });
  });
});

// =====================================================
// BULK OPERATIONS
// =====================================================

describe('LeadService - Bulk Operations', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('bulkUpdateStatus', () => {
    it('updates status for multiple projects and returns change count', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 3 });

      const count = await leadService.bulkUpdateStatus([1, 2, 3], 'active');

      expect(count).toBe(3);
      const sql: string = mockDb.run.mock.calls[0][0];
      expect(sql).toContain('IN (?,?,?)');
      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('active');
    });

    it('returns 0 when no rows changed', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 0 });
      const count = await leadService.bulkUpdateStatus([99], 'active');
      expect(count).toBe(0);
    });

    it('handles undefined changes gracefully', async () => {
      mockDb.run.mockResolvedValueOnce({});
      const count = await leadService.bulkUpdateStatus([1], 'active');
      expect(count).toBe(0);
    });
  });

  describe('bulkAssign', () => {
    it('assigns multiple projects and returns change count', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 2 });

      const count = await leadService.bulkAssign([1, 2], 'bob@example.com');

      expect(count).toBe(2);
      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('bob@example.com');
    });
  });

  describe('bulkMoveToStage', () => {
    it('moves multiple projects to a stage and returns change count', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 4 });

      const count = await leadService.bulkMoveToStage([1, 2, 3, 4], 2);

      expect(count).toBe(4);
      const params = mockDb.run.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe(2); // stageId first
    });
  });
});

// =====================================================
// ANALYTICS
// =====================================================

describe('LeadService - Analytics', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getLeadAnalytics', () => {
    it('returns complete analytics with all data', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 25 }); // totalLeads
      mockDb.get.mockResolvedValueOnce({ count: 5 });  // newLeadsThisMonth
      mockDb.get.mockResolvedValueOnce({ count: 10 }); // wonCount
      mockDb.get.mockResolvedValueOnce({ count: 5 });  // lostCount
      mockDb.get.mockResolvedValueOnce({ avg: 72.5 }); // avgScore
      mockDb.get.mockResolvedValueOnce({ avg: 21.3 }); // avgDays
      mockDb.all.mockResolvedValueOnce([
        { source_id: 1, source_name: 'Website', lead_count: 10, total_value: '15000', won_count: 4 }
      ]); // topSources
      mockDb.all.mockResolvedValueOnce([
        { range: '80-100', count: 5 },
        { range: '60-79', count: 8 }
      ]); // scoreDistribution

      const result = await leadService.getLeadAnalytics();

      expect(result.totalLeads).toBe(25);
      expect(result.newLeadsThisMonth).toBe(5);
      expect(result.conversionRate).toBeCloseTo(10 / 15);
      expect(result.avgLeadScore).toBe(73); // Math.round(72.5)
      expect(result.avgDaysToClose).toBe(21);
      expect(result.topSources).toHaveLength(1);
      expect(result.topSources[0].conversionRate).toBeCloseTo(4 / 10);
      expect(result.scoreDistribution).toHaveLength(2);
    });

    it('returns zero values when no data', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({ avg: null });
      mockDb.get.mockResolvedValueOnce({ avg: null });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getLeadAnalytics();

      expect(result.totalLeads).toBe(0);
      expect(result.newLeadsThisMonth).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.avgLeadScore).toBe(0);
      expect(result.avgDaysToClose).toBe(0);
    });

    it('computes source conversionRate as 0 when lead_count is 0', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.get.mockResolvedValueOnce({ avg: null });
      mockDb.get.mockResolvedValueOnce({ avg: null });
      mockDb.all.mockResolvedValueOnce([
        { source_id: 1, source_name: 'Referral', lead_count: 0, total_value: '0', won_count: 0 }
      ]);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getLeadAnalytics();

      expect(result.topSources[0].conversionRate).toBe(0);
    });
  });

  describe('getConversionFunnel', () => {
    it('returns funnel data with stages', async () => {
      const stage1 = makePipelineStageRow({ id: 1, name: 'Prospecting' });
      const stage2 = makePipelineStageRow({ id: 2, name: 'Won' });

      mockDb.all.mockResolvedValueOnce([stage1, stage2]); // getPipelineStages
      mockDb.get.mockResolvedValueOnce({ count: 10, value: '5000' }); // stage1 stats
      mockDb.get.mockResolvedValueOnce({ count: 3, value: '1500' });  // stage2 stats

      const result = await leadService.getConversionFunnel();

      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].name).toBe('Prospecting');
      expect(result.stages[0].count).toBe(10);
      expect(result.stages[0].conversionRate).toBe(1); // first stage, previousCount = 0
      expect(result.stages[1].conversionRate).toBeCloseTo(3 / 10);
      expect(result.overallConversionRate).toBeCloseTo(3 / 10);
    });

    it('returns 0 overallConversionRate when no stages', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await leadService.getConversionFunnel();

      expect(result.stages).toHaveLength(0);
      expect(result.overallConversionRate).toBe(0);
    });

    it('returns 0 overallConversionRate when first stage has no leads', async () => {
      const stage = makePipelineStageRow({ id: 1, name: 'Prospecting' });
      mockDb.all.mockResolvedValueOnce([stage]);
      mockDb.get.mockResolvedValueOnce({ count: 0, value: null });

      const result = await leadService.getConversionFunnel();

      expect(result.overallConversionRate).toBe(0);
    });

    it('skips updating previousCount when stage count is 0', async () => {
      const stage1 = makePipelineStageRow({ id: 1, name: 'Prospecting' });
      const stage2 = makePipelineStageRow({ id: 2, name: 'Qualified' });

      mockDb.all.mockResolvedValueOnce([stage1, stage2]);
      mockDb.get.mockResolvedValueOnce({ count: 5, value: '2500' }); // stage1 has 5
      mockDb.get.mockResolvedValueOnce({ count: 0, value: null }); // stage2 has 0

      const result = await leadService.getConversionFunnel();

      // stage2 count=0, so previousCount stays 5 (not updated to 0)
      expect(result.stages[1].conversionRate).toBe(0 / 5); // 0
    });
  });

  describe('getSourcePerformance', () => {
    it('returns source performance stats', async () => {
      mockDb.all.mockResolvedValueOnce([
        { source_id: 1, source_name: 'Website', lead_count: 20, total_value: '30000', won_count: 8 }
      ]);

      const result = await leadService.getSourcePerformance();

      expect(result).toHaveLength(1);
      expect(result[0].sourceId).toBe(1);
      expect(result[0].leadCount).toBe(20);
      expect(result[0].totalValue).toBe(30000);
      expect(result[0].conversionRate).toBe(8 / 20);
    });

    it('returns conversionRate 0 when lead_count is 0', async () => {
      mockDb.all.mockResolvedValueOnce([
        { source_id: 2, source_name: 'Cold Call', lead_count: 0, total_value: '0', won_count: 0 }
      ]);

      const result = await leadService.getSourcePerformance();

      expect(result[0].conversionRate).toBe(0);
    });

    it('returns empty array when no sources', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await leadService.getSourcePerformance();
      expect(result).toEqual([]);
    });
  });
});
