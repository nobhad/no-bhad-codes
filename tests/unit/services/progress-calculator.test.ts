/**
 * ===============================================
 * UNIT TESTS - PROGRESS CALCULATOR SERVICE
 * ===============================================
 * @file tests/unit/services/progress-calculator.test.ts
 *
 * Tests for progress calculation service including:
 * - calculateMilestoneProgress
 * - calculateProjectProgress
 * - checkAndUpdateMilestoneCompletion
 * - updateProjectProgress
 * - recalculateProjectProgress
 * - getMilestonesWithProgress
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

vi.mock('../../../server/database/row-helpers', () => ({
  getBoolean: vi.fn()
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks
import {
  calculateMilestoneProgress,
  calculateProjectProgress,
  checkAndUpdateMilestoneCompletion,
  updateProjectProgress,
  recalculateProjectProgress,
  getMilestonesWithProgress
} from '../../../server/services/progress-calculator';

import { getBoolean } from '../../../server/database/row-helpers';

// ────────────────────────────────────────────────────────────────
// calculateMilestoneProgress
// ────────────────────────────────────────────────────────────────

describe('calculateMilestoneProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('returns correct progress when all tasks are completed', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 4,
      completed: 4,
      in_progress: 0,
      pending: 0
    });

    const progress = await calculateMilestoneProgress(1);

    expect(progress.total).toBe(4);
    expect(progress.completed).toBe(4);
    expect(progress.inProgress).toBe(0);
    expect(progress.pending).toBe(0);
    expect(progress.percentage).toBe(100);
  });

  it('returns 0% progress when no tasks are completed', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 5,
      completed: 0,
      in_progress: 2,
      pending: 3
    });

    const progress = await calculateMilestoneProgress(2);

    expect(progress.percentage).toBe(0);
    expect(progress.inProgress).toBe(2);
    expect(progress.pending).toBe(3);
  });

  it('calculates percentage correctly for partial completion', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 4,
      completed: 1,
      in_progress: 1,
      pending: 2
    });

    const progress = await calculateMilestoneProgress(3);

    expect(progress.percentage).toBe(25); // 1/4 = 25%
  });

  it('rounds percentage correctly', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 3,
      completed: 1,
      in_progress: 0,
      pending: 2
    });

    const progress = await calculateMilestoneProgress(4);

    expect(progress.percentage).toBe(33); // Math.round(1/3 * 100) = 33
  });

  it('returns 0% when milestone has no tasks', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 0,
      completed: 0,
      in_progress: 0,
      pending: 0
    });

    const progress = await calculateMilestoneProgress(5);

    expect(progress.percentage).toBe(0);
    expect(progress.total).toBe(0);
  });

  it('handles null result from db.get gracefully', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const progress = await calculateMilestoneProgress(6);

    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.inProgress).toBe(0);
    expect(progress.pending).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('handles result with null fields (e.g. SUM returns null when no rows)', async () => {
    mockDb.get.mockResolvedValueOnce({
      total: 0,
      completed: null,
      in_progress: null,
      pending: null
    });

    const progress = await calculateMilestoneProgress(7);

    expect(progress.completed).toBe(0);
    expect(progress.inProgress).toBe(0);
    expect(progress.pending).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('queries with correct milestoneId', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0, in_progress: 0, pending: 0 });

    await calculateMilestoneProgress(99);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE milestone_id = ?'),
      [99]
    );
  });

  it('throws and rethrows when db.get fails', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('DB query failed'));

    await expect(calculateMilestoneProgress(1)).rejects.toThrow('DB query failed');
  });
});

// ────────────────────────────────────────────────────────────────
// calculateProjectProgress
// ────────────────────────────────────────────────────────────────

describe('calculateProjectProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('calculates overall progress from milestone and standalone tasks', async () => {
    // First call: milestone tasks
    mockDb.get.mockResolvedValueOnce({ total: 6, completed: 3 });
    // Second call: standalone tasks
    mockDb.get.mockResolvedValueOnce({ total: 4, completed: 4 });

    const progress = await calculateProjectProgress(1);

    expect(progress.milestoneTasks).toBe(6);
    expect(progress.completedMilestoneTasks).toBe(3);
    expect(progress.standaloneTasks).toBe(4);
    expect(progress.completedStandaloneTasks).toBe(4);
    expect(progress.totalTasks).toBe(10);
    expect(progress.completedTasks).toBe(7);
    expect(progress.overallProgress).toBe(70); // 7/10 = 70%
  });

  it('calculates milestoneProgress correctly', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 4, completed: 2 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    const progress = await calculateProjectProgress(1);

    expect(progress.milestoneProgress).toBe(50); // 2/4 = 50%
  });

  it('calculates standaloneProgress correctly', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 5, completed: 5 });

    const progress = await calculateProjectProgress(1);

    expect(progress.standaloneProgress).toBe(100);
  });

  it('returns 0 for milestoneProgress when no milestone tasks exist', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 1 });

    const progress = await calculateProjectProgress(1);

    expect(progress.milestoneProgress).toBe(0);
  });

  it('returns 0 for standaloneProgress when no standalone tasks exist', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 2 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    const progress = await calculateProjectProgress(1);

    expect(progress.standaloneProgress).toBe(0);
  });

  it('returns 0 overall when project has no tasks', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    const progress = await calculateProjectProgress(1);

    expect(progress.overallProgress).toBe(0);
    expect(progress.totalTasks).toBe(0);
    expect(progress.completedTasks).toBe(0);
  });

  it('handles null db results gracefully', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.get.mockResolvedValueOnce(null);

    const progress = await calculateProjectProgress(1);

    expect(progress.totalTasks).toBe(0);
    expect(progress.overallProgress).toBe(0);
  });

  it('queries with correct projectId for both queries', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    await calculateProjectProgress(42);

    expect(mockDb.get.mock.calls[0][1]).toEqual([42]);
    expect(mockDb.get.mock.calls[1][1]).toEqual([42]);
  });

  it('separates milestone tasks from standalone tasks correctly', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    await calculateProjectProgress(1);

    const milestoneQuery: string = mockDb.get.mock.calls[0][0];
    const standaloneQuery: string = mockDb.get.mock.calls[1][0];

    expect(milestoneQuery).toMatch(/milestone_id IS NOT NULL/i);
    expect(standaloneQuery).toMatch(/milestone_id IS NULL/i);
  });

  it('rounds percentages using Math.round', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 1 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });

    const progress = await calculateProjectProgress(1);

    expect(progress.milestoneProgress).toBe(33); // Math.round(1/3 * 100)
    expect(progress.overallProgress).toBe(33);
  });

  it('throws when db.get fails', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('DB error'));

    await expect(calculateProjectProgress(1)).rejects.toThrow('DB error');
  });
});

// ────────────────────────────────────────────────────────────────
// checkAndUpdateMilestoneCompletion
// ────────────────────────────────────────────────────────────────

describe('checkAndUpdateMilestoneCompletion', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    vi.mocked(getBoolean).mockReset();
  });

  it('returns false when milestone does not exist', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const changed = await checkAndUpdateMilestoneCompletion(99);

    expect(changed).toBe(false);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('marks milestone as complete when all tasks are done and it was incomplete', async () => {
    // First db.get: milestone record
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 });
    // Second db.get: task progress (from calculateMilestoneProgress)
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 3, in_progress: 0, pending: 0 });

    vi.mocked(getBoolean).mockReturnValueOnce(false); // was not completed

    const changed = await checkAndUpdateMilestoneCompletion(1);

    expect(changed).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE milestones'),
      [true, true, 1]
    );
  });

  it('marks milestone as incomplete when tasks are not all done and it was complete', async () => {
    mockDb.get.mockResolvedValueOnce({ is_completed: 1 });
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 2, in_progress: 1, pending: 0 });

    vi.mocked(getBoolean).mockReturnValueOnce(true); // was completed

    const changed = await checkAndUpdateMilestoneCompletion(2);

    expect(changed).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE milestones'),
      [false, false, 2]
    );
  });

  it('returns false without updating when status has not changed (already complete)', async () => {
    mockDb.get.mockResolvedValueOnce({ is_completed: 1 });
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 3, in_progress: 0, pending: 0 });

    vi.mocked(getBoolean).mockReturnValueOnce(true); // already completed

    const changed = await checkAndUpdateMilestoneCompletion(3);

    expect(changed).toBe(false);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('returns false without updating when status has not changed (still incomplete)', async () => {
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 1, in_progress: 0, pending: 2 });

    vi.mocked(getBoolean).mockReturnValueOnce(false); // already not completed

    const changed = await checkAndUpdateMilestoneCompletion(4);

    expect(changed).toBe(false);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('does NOT mark milestone complete when it has 0 tasks', async () => {
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0, in_progress: 0, pending: 0 });

    vi.mocked(getBoolean).mockReturnValueOnce(false);

    const changed = await checkAndUpdateMilestoneCompletion(5);

    // shouldBeCompleted = total > 0 && completed === total → false (total is 0)
    expect(changed).toBe(false);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('queries milestone by correct ID', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    await checkAndUpdateMilestoneCompletion(77);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('SELECT is_completed FROM milestones WHERE id = ?'),
      [77]
    );
  });

  it('throws when db.get throws', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('DB error'));

    await expect(checkAndUpdateMilestoneCompletion(1)).rejects.toThrow('DB error');
  });
});

// ────────────────────────────────────────────────────────────────
// updateProjectProgress
// ────────────────────────────────────────────────────────────────

describe('updateProjectProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
  });

  it('calculates progress and updates projects table', async () => {
    // Milestone tasks
    mockDb.get.mockResolvedValueOnce({ total: 10, completed: 5 });
    // Standalone tasks
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    // UPDATE run
    mockDb.run.mockResolvedValueOnce({});

    const result = await updateProjectProgress(1);

    expect(result).toBe(50);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE projects'),
      [50, 1]
    );
  });

  it('returns 100 when all tasks are completed', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 8, completed: 8 });
    mockDb.get.mockResolvedValueOnce({ total: 2, completed: 2 });
    mockDb.run.mockResolvedValueOnce({});

    const result = await updateProjectProgress(2);

    expect(result).toBe(100);
  });

  it('returns 0 when no tasks exist', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.run.mockResolvedValueOnce({});

    const result = await updateProjectProgress(3);

    expect(result).toBe(0);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE projects'),
      [0, 3]
    );
  });

  it('throws when db.run fails', async () => {
    mockDb.get.mockResolvedValueOnce({ total: 5, completed: 3 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.run.mockRejectedValueOnce(new Error('Update failed'));

    await expect(updateProjectProgress(1)).rejects.toThrow('Update failed');
  });
});

// ────────────────────────────────────────────────────────────────
// recalculateProjectProgress
// ────────────────────────────────────────────────────────────────

describe('recalculateProjectProgress', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(getBoolean).mockReset();
  });

  it('returns zero milestonesUpdated when project has no milestones', async () => {
    // db.all for milestone list
    mockDb.all.mockResolvedValueOnce([]);
    // calculateProjectProgress: milestone tasks
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    // calculateProjectProgress: standalone tasks
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    // updateProjectProgress UPDATE
    mockDb.run.mockResolvedValueOnce({});

    const result = await recalculateProjectProgress(1);

    expect(result.milestonesUpdated).toBe(0);
    expect(result.projectProgress).toBe(0);
  });

  it('updates completion status for each milestone', async () => {
    // db.all: two milestones
    mockDb.all.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);

    // Milestone 10: checkAndUpdateMilestoneCompletion
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 }); // milestone record
    mockDb.get.mockResolvedValueOnce({ total: 2, completed: 2, in_progress: 0, pending: 0 }); // tasks
    vi.mocked(getBoolean).mockReturnValueOnce(false); // was incomplete → should be complete → UPDATE
    mockDb.run.mockResolvedValueOnce({}); // UPDATE milestone 10

    // Milestone 11: checkAndUpdateMilestoneCompletion
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 }); // milestone record
    mockDb.get.mockResolvedValueOnce({ total: 3, completed: 1, in_progress: 0, pending: 2 }); // tasks
    vi.mocked(getBoolean).mockReturnValueOnce(false); // was incomplete → still incomplete → no change

    // updateProjectProgress: calculateProjectProgress + UPDATE
    mockDb.get.mockResolvedValueOnce({ total: 5, completed: 3 }); // milestone tasks
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 }); // standalone tasks
    mockDb.run.mockResolvedValueOnce({}); // UPDATE projects

    const result = await recalculateProjectProgress(1);

    expect(result.milestonesUpdated).toBe(1); // only milestone 10 changed
    expect(result.projectProgress).toBe(60); // 3/5 = 60%
  });

  it('increments milestonesUpdated for each milestone that changed', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 20 }, { id: 21 }]);

    // Milestone 20: was incomplete, all tasks done → changes to complete
    mockDb.get.mockResolvedValueOnce({ is_completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 2, completed: 2, in_progress: 0, pending: 0 });
    vi.mocked(getBoolean).mockReturnValueOnce(false);
    mockDb.run.mockResolvedValueOnce({});

    // Milestone 21: was complete, not all tasks done → changes to incomplete
    mockDb.get.mockResolvedValueOnce({ is_completed: 1 });
    mockDb.get.mockResolvedValueOnce({ total: 2, completed: 1, in_progress: 0, pending: 1 });
    vi.mocked(getBoolean).mockReturnValueOnce(true);
    mockDb.run.mockResolvedValueOnce({});

    // updateProjectProgress
    mockDb.get.mockResolvedValueOnce({ total: 4, completed: 3 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.run.mockResolvedValueOnce({});

    const result = await recalculateProjectProgress(1);

    expect(result.milestonesUpdated).toBe(2);
  });

  it('queries milestones with correct projectId', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0 });
    mockDb.run.mockResolvedValueOnce({});

    await recalculateProjectProgress(55);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE project_id = ?'),
      [55]
    );
  });

  it('throws when db.all fails', async () => {
    mockDb.all.mockRejectedValueOnce(new Error('Milestone query failed'));

    await expect(recalculateProjectProgress(1)).rejects.toThrow('Milestone query failed');
  });
});

// ────────────────────────────────────────────────────────────────
// getMilestonesWithProgress
// ────────────────────────────────────────────────────────────────

describe('getMilestonesWithProgress', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
  });

  it('returns milestones with computed progress_percentage', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Discovery',
        description: 'Phase 1',
        due_date: '2026-03-01',
        is_completed: false,
        total_tasks: 4,
        completed_tasks: 2
      }
    ]);

    const result = await getMilestonesWithProgress(1);

    expect(result).toHaveLength(1);
    expect(result[0].progress_percentage).toBe(50);
    expect(result[0].id).toBe(1);
    expect(result[0].title).toBe('Discovery');
  });

  it('returns 0 progress_percentage when milestone has no tasks', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 2,
        title: 'Design',
        description: 'Phase 2',
        due_date: '2026-04-01',
        is_completed: false,
        total_tasks: 0,
        completed_tasks: 0
      }
    ]);

    const result = await getMilestonesWithProgress(1);

    expect(result[0].progress_percentage).toBe(0);
  });

  it('returns 100% when all tasks are completed', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 3,
        title: 'Launch',
        description: 'Go live',
        due_date: '2026-05-01',
        is_completed: true,
        total_tasks: 5,
        completed_tasks: 5
      }
    ]);

    const result = await getMilestonesWithProgress(1);

    expect(result[0].progress_percentage).toBe(100);
  });

  it('rounds progress_percentage correctly', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 4,
        title: 'Dev',
        description: 'Build',
        due_date: null,
        is_completed: false,
        total_tasks: 3,
        completed_tasks: 1
      }
    ]);

    const result = await getMilestonesWithProgress(1);

    expect(result[0].progress_percentage).toBe(33); // Math.round(1/3 * 100)
  });

  it('returns empty array when project has no milestones', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await getMilestonesWithProgress(1);

    expect(result).toEqual([]);
  });

  it('returns multiple milestones with correct percentages', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 5, title: 'M1', description: '', due_date: null,
        is_completed: true, total_tasks: 4, completed_tasks: 4
      },
      {
        id: 6, title: 'M2', description: '', due_date: null,
        is_completed: false, total_tasks: 4, completed_tasks: 2
      },
      {
        id: 7, title: 'M3', description: '', due_date: null,
        is_completed: false, total_tasks: 0, completed_tasks: 0
      }
    ]);

    const result = await getMilestonesWithProgress(1);

    expect(result).toHaveLength(3);
    expect(result[0].progress_percentage).toBe(100);
    expect(result[1].progress_percentage).toBe(50);
    expect(result[2].progress_percentage).toBe(0);
  });

  it('queries with correct projectId', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await getMilestonesWithProgress(77);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE m.project_id = ?'),
      [77]
    );
  });

  it('preserves all milestone fields from db result', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 8,
        title: 'Phase X',
        description: 'Details here',
        due_date: '2026-07-01',
        is_completed: false,
        total_tasks: 2,
        completed_tasks: 1
      }
    ]);

    const result = await getMilestonesWithProgress(1);
    const m = result[0];

    expect(m.id).toBe(8);
    expect(m.title).toBe('Phase X');
    expect(m.description).toBe('Details here');
    expect(m.due_date).toBe('2026-07-01');
    expect(m.is_completed).toBe(false);
    expect(m.total_tasks).toBe(2);
    expect(m.completed_tasks).toBe(1);
    expect(m.progress_percentage).toBe(50);
  });

  it('throws when db.all fails', async () => {
    mockDb.all.mockRejectedValueOnce(new Error('DB query failed'));

    await expect(getMilestonesWithProgress(1)).rejects.toThrow('DB query failed');
  });
});
