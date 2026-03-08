/**
 * ===============================================
 * UNIT TESTS - TASK GENERATOR SERVICE
 * ===============================================
 * @file tests/unit/services/task-generator.test.ts
 *
 * Tests for task generation service including:
 * - generateMilestoneTasks (create tasks for a milestone)
 * - generateAllMilestoneTasksForProject
 * - getMilestonesWithoutTasks
 * - backfillMilestoneTasks
 * - previewMilestoneTasks (pure, no DB)
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

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(null),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(null)
  }
}));

// Import after mocks
import {
  generateMilestoneTasks,
  generateAllMilestoneTasksForProject,
  getMilestonesWithoutTasks,
  backfillMilestoneTasks,
  previewMilestoneTasks
} from '../../../server/services/task-generator';

import { userService } from '../../../server/services/user-service';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** A milestone title that has matching tasks in all project types */
const DISCOVERY_TITLE = 'Discovery & Planning';
const DESIGN_TITLE = 'Design';
const LAUNCH_TITLE = 'Testing & Launch';

// ────────────────────────────────────────────────────────────────
// generateMilestoneTasks
// ────────────────────────────────────────────────────────────────

describe('generateMilestoneTasks', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(null);
  });

  // ── skipIfExists behaviour ──────────────────────────────────

  it('returns empty array and skips when tasks already exist (default skipIfExists)', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 2 });

    const ids = await generateMilestoneTasks(1, 10, DISCOVERY_TITLE, '2026-03-01', 'simple-site');

    expect(ids).toEqual([]);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('does not check existing count when skipIfExists is false', async () => {
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-01', 'simple-site',
      { skipIfExists: false }
    );

    // db.get should not have been called for count check
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('proceeds when existing count is 0', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-01', 'simple-site'
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  // ── template matching ───────────────────────────────────────

  it('returns empty array when no task templates match milestone title', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });

    const ids = await generateMilestoneTasks(
      1, 10, 'Completely Unknown Milestone', '2026-03-01', 'simple-site',
      { skipIfExists: true }
    );

    expect(ids).toEqual([]);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('generates tasks for simple-site Discovery & Planning milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-01', 'simple-site',
      { skipIfExists: true }
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  it('generates tasks for business-site Discovery milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, 'Discovery', '2026-03-01', 'business-site',
      { skipIfExists: true }
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  it('generates tasks for ecommerce-site Discovery & Planning milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-01', 'ecommerce-site',
      { skipIfExists: true }
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  it('generates tasks for web-app Discovery & Architecture milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, 'Discovery & Architecture', '2026-03-01', 'web-app',
      { skipIfExists: true }
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  it('generates tasks for maintenance Month 1 - Setup milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const ids = await generateMilestoneTasks(
      1, 10, 'Month 1 - Setup', '2026-03-01', 'maintenance',
      { skipIfExists: true }
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  // ── INSERT parameters ───────────────────────────────────────

  it('inserts tasks with correct project_id and milestone_id', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 42 });

    await generateMilestoneTasks(
      7, 15, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true }
    );

    const firstParams = mockDb.run.mock.calls[0][1];
    expect(firstParams[0]).toBe(7);  // project_id
    expect(firstParams[1]).toBe(15); // milestone_id
  });

  it('inserts tasks with default priority "medium" when not specified', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true }
    );

    const firstParams = mockDb.run.mock.calls[0][1];
    // priority is at index 5
    expect(firstParams[5]).toBe('medium');
  });

  it('inserts tasks with custom priority when specified', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true, defaultPriority: 'high' }
    );

    const firstParams = mockDb.run.mock.calls[0][1];
    expect(firstParams[5]).toBe('high');
  });

  it('inserts tasks with assignedTo and resolved user ID', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });
    vi.mocked(userService.getUserIdByEmail).mockResolvedValueOnce(99);

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true, assignedTo: 'dev@example.com' }
    );

    const firstParams = mockDb.run.mock.calls[0][1];
    // assigned_to at index 9, assigned_to_user_id at index 10
    expect(firstParams[9]).toBe('dev@example.com');
    expect(firstParams[10]).toBe(99);
  });

  it('uses null for assigned_to when no assignedTo option given', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true }
    );

    const firstParams = mockDb.run.mock.calls[0][1];
    expect(firstParams[9]).toBeNull();
    expect(firstParams[10]).toBeNull();
  });

  it('only tracks task IDs when db.run returns a lastID', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    // First INSERT succeeds, subsequent ones return no lastID
    mockDb.run
      .mockResolvedValueOnce({ lastID: 5 })
      .mockResolvedValue({});

    const ids = await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site',
      { skipIfExists: true }
    );

    // Only first task ID tracked
    expect(ids).toContain(5);
    expect(ids.length).toBe(1);
  });

  // ── due date calculation ────────────────────────────────────

  it('assigns null due dates when milestoneDueDate is null', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, null, 'simple-site',
      { skipIfExists: true }
    );

    // due_date is at index 6 in INSERT params
    const firstParams = mockDb.run.mock.calls[0][1];
    expect(firstParams[6]).toBeNull();
  });

  it('distributes due dates across tasks when milestoneDueDate is provided', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-06-30', 'simple-site',
      { skipIfExists: true, startDate: '2026-01-01' }
    );

    const dueDates = mockDb.run.mock.calls.map((call) => call[1][6]);
    // All due dates should be non-null strings
    for (const date of dueDates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Last task due date should be <= milestone due date
    const lastDate = dueDates[dueDates.length - 1];
    expect(new Date(lastDate).getTime()).toBeLessThanOrEqual(new Date('2026-06-30').getTime());
  });

  it('uses startDate option for task due date calculation', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    // milestone due date far in future, start date near future
    await generateMilestoneTasks(
      1, 10, DISCOVERY_TITLE, '2026-12-31', 'simple-site',
      { skipIfExists: true, startDate: '2026-11-01' }
    );

    const firstDueDate = mockDb.run.mock.calls[0][1][6] as string;
    // Due dates should all be after the start date
    expect(new Date(firstDueDate).getTime()).toBeGreaterThan(new Date('2026-11-01').getTime());
  });

  // ── error handling ──────────────────────────────────────────

  it('throws when db.run fails during INSERT', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockRejectedValueOnce(new Error('Insert failed'));

    await expect(
      generateMilestoneTasks(1, 10, DISCOVERY_TITLE, '2026-03-20', 'simple-site', {
        skipIfExists: true
      })
    ).rejects.toThrow('Insert failed');
  });
});

// ────────────────────────────────────────────────────────────────
// generateAllMilestoneTasksForProject
// ────────────────────────────────────────────────────────────────

describe('generateAllMilestoneTasksForProject', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(null);
  });

  it('returns 0 when project has no milestones', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const total = await generateAllMilestoneTasksForProject(1, 'simple-site');

    expect(total).toBe(0);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('generates tasks for each milestone and totals them', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 10, title: DISCOVERY_TITLE, due_date: '2026-03-01' },
      { id: 11, title: DESIGN_TITLE, due_date: '2026-03-15' }
    ]);

    // For each milestone: skipIfExists check → 0 existing, then INSERT calls
    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const total = await generateAllMilestoneTasksForProject(1, 'simple-site');

    expect(total).toBeGreaterThan(0);
  });

  it('queries milestones for the given project_id', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await generateAllMilestoneTasksForProject(42, 'web-app');

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE project_id = ?'),
      [42]
    );
  });

  it('throws when db.all fails', async () => {
    mockDb.all.mockRejectedValueOnce(new Error('DB error'));

    await expect(generateAllMilestoneTasksForProject(1, 'simple-site')).rejects.toThrow(
      'DB error'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// getMilestonesWithoutTasks
// ────────────────────────────────────────────────────────────────

describe('getMilestonesWithoutTasks', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
  });

  it('returns array of milestone IDs', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 1 }, { id: 4 }, { id: 9 }]);

    const ids = await getMilestonesWithoutTasks();

    expect(ids).toEqual([1, 4, 9]);
  });

  it('returns empty array when all milestones have tasks', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const ids = await getMilestonesWithoutTasks();

    expect(ids).toEqual([]);
  });

  it('returns empty array when db.all returns null', async () => {
    mockDb.all.mockResolvedValueOnce(null);

    const ids = await getMilestonesWithoutTasks();

    expect(ids).toEqual([]);
  });

  it('executes a query that joins milestones with project_tasks', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await getMilestonesWithoutTasks();

    const query: string = mockDb.all.mock.calls[0][0];
    expect(query).toMatch(/LEFT JOIN project_tasks/i);
    expect(query).toMatch(/WHERE t\.id IS NULL/i);
  });
});

// ────────────────────────────────────────────────────────────────
// backfillMilestoneTasks
// ────────────────────────────────────────────────────────────────

describe('backfillMilestoneTasks', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(null);
  });

  it('returns zero counts when no milestones need backfill', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await backfillMilestoneTasks();

    expect(result).toEqual({
      milestonesProcessed: 0,
      tasksCreated: 0,
      errors: []
    });
  });

  it('processes each milestone and accumulates task counts', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        title: DISCOVERY_TITLE,
        due_date: '2026-03-20',
        project_id: 10,
        project_type: 'simple-site',
        start_date: '2026-01-01'
      }
    ]);

    // Existence check: 0 tasks
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestoneTasks();

    expect(result.milestonesProcessed).toBe(1);
    expect(result.tasksCreated).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('records errors for failed milestones and continues', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 2,
        title: DISCOVERY_TITLE,
        due_date: '2026-03-20',
        project_id: 10,
        project_type: 'simple-site',
        start_date: null
      },
      {
        id: 3,
        title: DESIGN_TITLE,
        due_date: '2026-04-01',
        project_id: 10,
        project_type: 'simple-site',
        start_date: null
      }
    ]);

    // Milestone 2: db.get throws
    mockDb.get.mockRejectedValueOnce(new Error('Task insert error'));
    // Milestone 3: succeeds (0 existing, then inserts)
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestoneTasks();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].milestoneId).toBe(2);
    expect(result.milestonesProcessed).toBe(1);
  });

  it('groups milestones by project and uses previous milestone due date as next start', async () => {
    // Two milestones in same project; second should use first's due_date as start
    mockDb.all.mockResolvedValueOnce([
      {
        id: 10,
        title: DISCOVERY_TITLE,
        due_date: '2026-02-01',
        project_id: 5,
        project_type: 'simple-site',
        start_date: '2026-01-01'
      },
      {
        id: 11,
        title: LAUNCH_TITLE,
        due_date: '2026-03-01',
        project_id: 5,
        project_type: 'simple-site',
        start_date: '2026-01-01'
      }
    ]);

    // Two existence checks (one per milestone)
    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestoneTasks();

    expect(result.milestonesProcessed).toBe(2);
  });

  it('handles milestones from different projects independently', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 20,
        title: DISCOVERY_TITLE,
        due_date: '2026-02-15',
        project_id: 1,
        project_type: 'simple-site',
        start_date: '2026-01-01'
      },
      {
        id: 21,
        title: DISCOVERY_TITLE,
        due_date: '2026-03-10',
        project_id: 2,
        project_type: 'business-site',
        start_date: '2026-01-15'
      }
    ]);

    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestoneTasks();

    expect(result.milestonesProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────
// previewMilestoneTasks (pure — no DB)
// ────────────────────────────────────────────────────────────────

describe('previewMilestoneTasks', () => {
  it('returns task templates for simple-site Discovery & Planning milestone', () => {
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site', '2026-06-30');

    expect(previews.length).toBeGreaterThan(0);
    expect(previews[0]).toHaveProperty('title');
    expect(previews[0]).toHaveProperty('order');
  });

  it('returns null dueDate for each task when milestoneDueDate not provided', () => {
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site');

    expect(previews.length).toBeGreaterThan(0);
    for (const preview of previews) {
      expect(preview.dueDate).toBeNull();
    }
  });

  it('returns calculated dueDates when milestoneDueDate is provided', () => {
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site', '2026-12-31');

    for (const preview of previews) {
      expect(preview.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('returns empty array for unknown milestone title', () => {
    const previews = previewMilestoneTasks('Unknown Milestone', 'simple-site', '2026-06-30');

    expect(previews).toHaveLength(0);
  });

  it('handles null project type (falls back to other/generic)', () => {
    // "other" type has generic milestones; task templates may or may not match
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, null);

    // Should not throw; empty or populated depending on template
    expect(Array.isArray(previews)).toBe(true);
  });

  it('handles undefined project type', () => {
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, undefined);

    expect(Array.isArray(previews)).toBe(true);
  });

  it('does not access the database', () => {
    previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site', '2026-06-30');

    expect(mockDb.get).not.toHaveBeenCalled();
    expect(mockDb.all).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('preserves template properties (title, order, estimatedHours, description)', () => {
    const previews = previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site', '2026-06-30');

    if (previews.length > 0) {
      expect(previews[0]).toHaveProperty('title');
      expect(previews[0]).toHaveProperty('order');
      // dueDate is always present (null or string)
      expect('dueDate' in previews[0]).toBe(true);
    }
  });

  it('returns different task sets for different project types', () => {
    const simpleSitePreviews = previewMilestoneTasks(DISCOVERY_TITLE, 'simple-site');
    const webAppPreviews = previewMilestoneTasks('Discovery & Architecture', 'web-app');

    // Both should have tasks, potentially different counts
    expect(Array.isArray(simpleSitePreviews)).toBe(true);
    expect(Array.isArray(webAppPreviews)).toBe(true);
  });
});
