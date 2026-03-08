/**
 * ===============================================
 * UNIT TESTS - MILESTONE GENERATOR SERVICE
 * ===============================================
 * @file tests/unit/services/milestone-generator.test.ts
 *
 * Tests for milestone generation service including:
 * - generateDefaultMilestones (create milestones for a project)
 * - previewMilestones (preview without DB writes)
 * - regenerateMilestones (delete + regenerate)
 * - getProjectsWithoutMilestones
 * - backfillMilestones
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

// Mock task generator — keep it simple so milestone tests aren't polluted by task logic
vi.mock('../../../server/services/task-generator', () => ({
  generateMilestoneTasks: vi.fn().mockResolvedValue([101, 102, 103])
}));

// Import after mocks
import {
  generateDefaultMilestones,
  previewMilestones,
  regenerateMilestones,
  getProjectsWithoutMilestones,
  backfillMilestones
} from '../../../server/services/milestone-generator';

import { generateMilestoneTasks } from '../../../server/services/task-generator';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Build a fixed start date so due-date calculations are deterministic */
const FIXED_START = new Date('2026-01-01T00:00:00.000Z');

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('generateDefaultMilestones', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(generateMilestoneTasks).mockReset();
    vi.mocked(generateMilestoneTasks).mockResolvedValue([101, 102]);
  });

  it('skips generation when milestones already exist (skipIfExists default)', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 3 });

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    expect(result).toEqual({ milestonesCreated: 0, tasksCreated: 0 });
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('does NOT skip check when skipIfExists is true (default behaviour)', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 10 });

    await generateDefaultMilestones(5, 'simple-site', { startDate: FIXED_START, skipIfExists: true });

    // The existence check should have been made
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*) as count FROM milestones'),
      [5]
    );
  });

  it('bypasses existence check when skipIfExists is false', async () => {
    mockDb.run.mockResolvedValue({ lastID: 20 });

    const result = await generateDefaultMilestones(2, 'simple-site', {
      startDate: FIXED_START,
      skipIfExists: false
    });

    // db.get should NOT have been called for the count check
    expect(mockDb.get).not.toHaveBeenCalled();
    // simple-site has 3 milestones
    expect(result.milestonesCreated).toBe(3);
  });

  it('creates the correct number of milestones for simple-site', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    // simple-site has 3 milestone templates
    expect(result.milestonesCreated).toBe(3);
    expect(mockDb.run).toHaveBeenCalledTimes(3);
  });

  it('creates the correct number of milestones for business-site', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'business-site', { startDate: FIXED_START });

    // business-site has 5 milestone templates
    expect(result.milestonesCreated).toBe(5);
  });

  it('creates the correct number of milestones for ecommerce-site', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'ecommerce-site', { startDate: FIXED_START });

    expect(result.milestonesCreated).toBe(5);
  });

  it('creates the correct number of milestones for web-app', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'web-app', { startDate: FIXED_START });

    expect(result.milestonesCreated).toBe(5);
  });

  it('creates the correct number of milestones for maintenance', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'maintenance', { startDate: FIXED_START });

    expect(result.milestonesCreated).toBe(3);
  });

  it('falls back to "other" template for unknown project type', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'totally-unknown-type', { startDate: FIXED_START });

    // "other" has 3 milestone templates
    expect(result.milestonesCreated).toBe(3);
  });

  it('falls back to "other" template when projectType is null', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, null, { startDate: FIXED_START });

    expect(result.milestonesCreated).toBe(3);
  });

  it('falls back to "other" template when projectType is undefined', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, undefined, { startDate: FIXED_START });

    expect(result.milestonesCreated).toBe(3);
  });

  it('accumulates tasksCreated from generateMilestoneTasks', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    // Return 2 task IDs per call; simple-site has 3 milestones → 6 total
    vi.mocked(generateMilestoneTasks).mockResolvedValue([1, 2]);
    mockDb.run.mockResolvedValue({ lastID: 10 });

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    expect(result.tasksCreated).toBe(6);
  });

  it('passes correct due dates to each milestone INSERT', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    const calls = mockDb.run.mock.calls;
    // Due dates for simple-site: +3 days, +10 days, +14 days from 2026-01-01
    expect(calls[0][1][3]).toBe('2026-01-04');
    expect(calls[1][1][3]).toBe('2026-01-11');
    expect(calls[2][1][3]).toBe('2026-01-15');
  });

  it('stores serialised deliverables as JSON string', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    const firstCallParams = mockDb.run.mock.calls[0][1];
    // deliverables (index 4) should be a JSON string
    expect(typeof firstCallParams[4]).toBe('string');
    const parsed = JSON.parse(firstCallParams[4]);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('uses today as start date when no startDate option is provided', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const before = new Date();
    await generateDefaultMilestones(1, 'simple-site');
    const after = new Date();

    const calls = mockDb.run.mock.calls;
    // Due date for first simple-site milestone is startDate + 3 days
    const dueDateStr = calls[0][1][3] as string;
    const dueDate = new Date(dueDateStr);
    // The due date should be approximately 3 days from now
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 2);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 4);
    expect(dueDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(dueDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });

  it('continues generating other milestones when task generation fails for one', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    // First call throws, subsequent calls succeed
    vi.mocked(generateMilestoneTasks)
      .mockRejectedValueOnce(new Error('task error'))
      .mockResolvedValue([1, 2]);

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    // All 3 milestones should still be created
    expect(result.milestonesCreated).toBe(3);
    // Only 2 task calls succeeded (first threw)
    expect(result.tasksCreated).toBe(4);
  });

  it('does not push milestoneId when db.run returns no lastID', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    // Return null-ish result — no lastID
    mockDb.run.mockResolvedValue({});

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    // No milestones get pushed to milestoneIds array
    expect(result.milestonesCreated).toBe(0);
  });

  it('throws and logs when db.run throws', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockRejectedValueOnce(new Error('DB insert failed'));

    await expect(
      generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START })
    ).rejects.toThrow('DB insert failed');
  });

  it('skips existence check when count result is null', async () => {
    // db.get returns null — treat as 0 existing, skip anyway since null > 0 is false
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await generateDefaultMilestones(1, 'simple-site', { startDate: FIXED_START });

    // null count means 0 existing, so we proceed
    expect(result.milestonesCreated).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────

describe('previewMilestones', () => {
  it('returns templates with due dates for simple-site', () => {
    const previews = previewMilestones('simple-site', FIXED_START);

    expect(previews).toHaveLength(3);
    expect(previews[0].dueDate).toBe('2026-01-04');
    expect(previews[1].dueDate).toBe('2026-01-11');
    expect(previews[2].dueDate).toBe('2026-01-15');
  });

  it('returns templates for business-site with correct count', () => {
    const previews = previewMilestones('business-site', FIXED_START);

    expect(previews).toHaveLength(5);
  });

  it('returns templates for ecommerce-site with correct count', () => {
    const previews = previewMilestones('ecommerce-site', FIXED_START);

    expect(previews).toHaveLength(5);
  });

  it('returns templates for web-app with correct count', () => {
    const previews = previewMilestones('web-app', FIXED_START);

    expect(previews).toHaveLength(5);
  });

  it('returns templates for maintenance with correct count', () => {
    const previews = previewMilestones('maintenance', FIXED_START);

    expect(previews).toHaveLength(3);
  });

  it('falls back to "other" for null project type', () => {
    const previews = previewMilestones(null, FIXED_START);

    expect(previews).toHaveLength(3);
  });

  it('falls back to "other" for undefined project type', () => {
    const previews = previewMilestones(undefined, FIXED_START);

    expect(previews).toHaveLength(3);
  });

  it('falls back to "other" for unrecognised project type', () => {
    const previews = previewMilestones('mystery-type', FIXED_START);

    expect(previews).toHaveLength(3);
  });

  it('preserves original template properties alongside dueDate', () => {
    const previews = previewMilestones('simple-site', FIXED_START);

    expect(previews[0]).toHaveProperty('name');
    expect(previews[0]).toHaveProperty('description');
    expect(previews[0]).toHaveProperty('estimatedDays');
    expect(previews[0]).toHaveProperty('order');
    expect(previews[0]).toHaveProperty('dueDate');
  });

  it('uses today when no startDate is provided', () => {
    const before = new Date();
    const previews = previewMilestones('simple-site');
    const after = new Date();

    const dueDate = new Date(previews[0].dueDate);
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 2);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 4);

    expect(dueDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(dueDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });

  it('does not write to the database', () => {
    previewMilestones('simple-site', FIXED_START);

    expect(mockDb.get).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
    expect(mockDb.all).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────

describe('regenerateMilestones', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(generateMilestoneTasks).mockReset();
    vi.mocked(generateMilestoneTasks).mockResolvedValue([1, 2]);
  });

  it('deletes existing milestones before generating new ones', async () => {
    // DELETE call returns success
    mockDb.run.mockResolvedValueOnce({});
    // Existence check for generateDefaultMilestones with skipIfExists:false — skipped
    // INSERT calls for milestones (3 for simple-site)
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await regenerateMilestones(7, 'simple-site', FIXED_START);

    const firstCall = mockDb.run.mock.calls[0];
    expect(firstCall[0]).toMatch(/DELETE FROM milestones WHERE project_id/i);
    expect(firstCall[1]).toEqual([7]);
  });

  it('returns counts of newly created milestones and tasks', async () => {
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await regenerateMilestones(7, 'simple-site', FIXED_START);

    expect(result.milestonesCreated).toBe(3);
    expect(result.tasksCreated).toBe(6); // 3 milestones × 2 tasks each
  });

  it('uses today as start date when startDate is not provided', async () => {
    mockDb.run.mockResolvedValue({ lastID: 1 });

    // Should not throw
    const result = await regenerateMilestones(7, 'web-app');

    expect(result.milestonesCreated).toBe(5);
  });

  it('throws and logs when DELETE fails', async () => {
    mockDb.run.mockRejectedValueOnce(new Error('DELETE failed'));

    await expect(regenerateMilestones(7, 'simple-site', FIXED_START)).rejects.toThrow(
      'DELETE failed'
    );
  });
});

// ────────────────────────────────────────────────────────────────

describe('getProjectsWithoutMilestones', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
  });

  it('returns an array of project IDs', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 5 }]);

    const ids = await getProjectsWithoutMilestones();

    expect(ids).toEqual([1, 2, 5]);
  });

  it('returns empty array when all projects have milestones', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const ids = await getProjectsWithoutMilestones();

    expect(ids).toEqual([]);
  });

  it('returns empty array when db.all returns null', async () => {
    mockDb.all.mockResolvedValueOnce(null);

    const ids = await getProjectsWithoutMilestones();

    expect(ids).toEqual([]);
  });

  it('executes query that joins projects with milestones', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await getProjectsWithoutMilestones();

    const query: string = mockDb.all.mock.calls[0][0];
    expect(query).toMatch(/LEFT JOIN milestones/i);
    expect(query).toMatch(/WHERE m\.id IS NULL/i);
  });
});

// ────────────────────────────────────────────────────────────────

describe('backfillMilestones', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(generateMilestoneTasks).mockReset();
    vi.mocked(generateMilestoneTasks).mockResolvedValue([1]);
  });

  it('returns zero counts when no projects need backfill', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await backfillMilestones();

    expect(result).toEqual({
      projectsProcessed: 0,
      milestonesCreated: 0,
      tasksCreated: 0,
      errors: []
    });
  });

  it('processes each project and accumulates milestone/task counts', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 1, project_type: 'simple-site', start_date: '2026-01-01' },
      { id: 2, project_type: 'simple-site', start_date: '2026-02-01' }
    ]);

    // For each project: existence check → 0, then 3 INSERT runs
    // Project 1: check
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    // Project 2: check
    mockDb.get.mockResolvedValueOnce({ count: 0 });

    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestones();

    expect(result.projectsProcessed).toBe(2);
    expect(result.milestonesCreated).toBe(6); // 3 per project × 2 projects
    expect(result.errors).toHaveLength(0);
  });

  it('records errors for projects that fail and continues processing', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 3, project_type: 'simple-site', start_date: null },
      { id: 4, project_type: 'simple-site', start_date: null }
    ]);

    // Project 3: existence check → throws
    mockDb.get.mockRejectedValueOnce(new Error('DB error for project 3'));
    // Project 4: existence check → 0, then success
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const result = await backfillMilestones();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].projectId).toBe(3);
    expect(result.projectsProcessed).toBe(1);
  });

  it('uses project start_date when available', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 5, project_type: 'other', start_date: '2025-06-15' }
    ]);
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await backfillMilestones();

    // The due date for the first "other" milestone (+7 days from 2025-06-15) should be 2025-06-22
    const insertCall = mockDb.run.mock.calls[0];
    expect(insertCall[1][3]).toBe('2025-06-22');
  });

  it('uses today as start when project start_date is null', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 6, project_type: 'other', start_date: null }
    ]);
    mockDb.get.mockResolvedValueOnce({ count: 0 });
    mockDb.run.mockResolvedValue({ lastID: 1 });

    const before = new Date();
    await backfillMilestones();
    const after = new Date();

    const insertCall = mockDb.run.mock.calls[0];
    const dueDate = new Date(insertCall[1][3] as string);
    // "other" first milestone is +7 days
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 6);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 8);
    expect(dueDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(dueDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });
});
