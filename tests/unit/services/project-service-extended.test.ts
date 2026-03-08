/**
 * ===============================================
 * PROJECT SERVICE EXTENDED TESTS
 * ===============================================
 * @file tests/unit/services/project-service-extended.test.ts
 *
 * Extended unit tests covering previously untested functions in project-service.ts:
 * - moveTask
 * - completeTask
 * - toggleChecklistItem
 * - logTime (with and without taskId)
 * - getTeamTimeReport
 * - createProjectFromTemplate
 * - calculateProjectHealth (multiple health scenarios)
 * - archiveProject
 * - unarchiveProject
 * - updateTask error paths (task not found)
 * - deleteTask error path (task not found)
 * - addDependency (failed creation path)
 * - getTasks with includeSubtasks
 * - getAllTasks with comma-separated statuses
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
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock('../../../server/services/progress-calculator', () => ({
  checkAndUpdateMilestoneCompletion: vi.fn().mockResolvedValue(undefined),
  updateProjectProgress: vi.fn().mockResolvedValue(undefined)
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
import { projectService } from '../../../server/services/project-service';

// ============================================================
// MOVE TASK
// ============================================================

describe('ProjectService - moveTask', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('moves task down to a higher sort order', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      project_id: 10,
      milestone_id: null,
      sort_order: 2
    });
    mockDb.run.mockResolvedValue({});

    await expect(projectService.moveTask(1, 5)).resolves.not.toThrow();

    // Moving down: decrement tasks between old and new position
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('sort_order = sort_order - 1'),
      expect.any(Array)
    );
    // Final update on the task itself
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE project_tasks SET sort_order = ?'),
      [5, null, 1]
    );
  });

  it('moves task up to a lower sort order', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      project_id: 10,
      milestone_id: 2,
      sort_order: 5
    });
    mockDb.run.mockResolvedValue({});

    await expect(projectService.moveTask(1, 2)).resolves.not.toThrow();

    // Moving up: increment tasks between new and old position
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('sort_order = sort_order + 1'),
      expect.any(Array)
    );
  });

  it('throws when task not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(projectService.moveTask(999, 3)).rejects.toThrow('Task not found');
  });

  it('uses provided milestoneId when moving', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      project_id: 10,
      milestone_id: null,
      sort_order: 3
    });
    mockDb.run.mockResolvedValue({});

    await projectService.moveTask(1, 1, 7);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE project_tasks SET sort_order = ?'),
      [1, 7, 1]
    );
  });
});

// ============================================================
// COMPLETE TASK
// ============================================================

describe('ProjectService - completeTask', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('marks a task as completed', async () => {
    const currentTask = { milestone_id: 1, project_id: 10 };
    const completedTask = {
      id: 1,
      project_id: 10,
      milestone_id: 1,
      title: 'Task',
      status: 'completed',
      priority: 'medium',
      sort_order: 1,
      completed_at: '2026-03-08T12:00:00Z',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-08T12:00:00Z'
    };

    mockDb.get.mockResolvedValueOnce(currentTask);
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(completedTask);
    mockDb.all.mockResolvedValueOnce([]); // Subtasks
    mockDb.all.mockResolvedValueOnce([]); // Dependencies
    mockDb.all.mockResolvedValueOnce([]); // Checklist

    const result = await projectService.completeTask(1);

    expect(result.status).toBe('completed');
  });
});

// ============================================================
// TOGGLE CHECKLIST ITEM
// ============================================================

describe('ProjectService - toggleChecklistItem', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('toggles a checklist item to completed', async () => {
    const toggledItem = {
      id: 5,
      task_id: 1,
      content: 'Write tests',
      is_completed: 1,
      completed_at: '2026-03-08T12:00:00Z',
      sort_order: 1,
      created_at: '2026-03-01T00:00:00Z'
    };

    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(toggledItem);

    const result = await projectService.toggleChecklistItem(5);

    expect(result.isCompleted).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('is_completed = NOT is_completed'),
      [5]
    );
  });

  it('throws when checklist item not found after toggle', async () => {
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(null);

    await expect(projectService.toggleChecklistItem(999)).rejects.toThrow(
      'Checklist item not found'
    );
  });
});

// ============================================================
// LOG TIME
// ============================================================

describe('ProjectService - logTime', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('logs time without a taskId', async () => {
    const timeEntry = {
      id: 1,
      project_id: 10,
      task_id: null,
      user_name: 'developer',
      hours: 3,
      date: '2026-03-08',
      billable: 1,
      hourly_rate: null,
      created_at: '2026-03-08T12:00:00Z',
      updated_at: '2026-03-08T12:00:00Z'
    };

    mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // Insert time entry
    mockDb.run.mockResolvedValueOnce({}); // Update project actual hours
    mockDb.get.mockResolvedValueOnce(timeEntry);

    const result = await projectService.logTime(10, {
      userName: 'developer',
      hours: 3,
      date: '2026-03-08'
    });

    expect(result.hours).toBe(3);
    expect(result.billable).toBe(true);

    // Should NOT update task actual hours
    const taskUpdateCall = mockDb.run.mock.calls.find(
      (call) => String(call[0]).includes('actual_hours = COALESCE(actual_hours, 0) +') &&
                String(call[0]).includes('project_tasks')
    );
    expect(taskUpdateCall).toBeUndefined();
  });

  it('logs time with a taskId and updates task actual hours', async () => {
    const timeEntry = {
      id: 2,
      project_id: 10,
      task_id: 5,
      user_name: 'developer',
      hours: 4,
      date: '2026-03-08',
      billable: 1,
      hourly_rate: 100,
      created_at: '2026-03-08T12:00:00Z',
      updated_at: '2026-03-08T12:00:00Z'
    };

    mockDb.run.mockResolvedValueOnce({ lastID: 2 }); // Insert time entry
    mockDb.run.mockResolvedValueOnce({}); // Update task actual hours
    mockDb.run.mockResolvedValueOnce({}); // Update project actual hours
    mockDb.get.mockResolvedValueOnce(timeEntry);

    const result = await projectService.logTime(10, {
      userName: 'developer',
      taskId: 5,
      hours: 4,
      date: '2026-03-08',
      billable: true,
      hourlyRate: 100
    });

    expect(result.hours).toBe(4);

    // Should update task actual hours
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('actual_hours = COALESCE(actual_hours, 0) +'),
      [4, 5]
    );
  });

  it('throws when time entry cannot be retrieved after insert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 99 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(null);

    await expect(
      projectService.logTime(10, { userName: 'dev', hours: 1, date: '2026-03-08' })
    ).rejects.toThrow('Failed to log time');
  });

  it('logs non-billable time', async () => {
    const timeEntry = {
      id: 3,
      project_id: 10,
      task_id: null,
      user_name: 'developer',
      hours: 2,
      date: '2026-03-08',
      billable: 0,
      created_at: '2026-03-08T12:00:00Z',
      updated_at: '2026-03-08T12:00:00Z'
    };

    mockDb.run.mockResolvedValueOnce({ lastID: 3 });
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(timeEntry);

    const result = await projectService.logTime(10, {
      userName: 'developer',
      hours: 2,
      date: '2026-03-08',
      billable: false
    });

    expect(result.billable).toBe(false);
  });
});

// ============================================================
// GET TEAM TIME REPORT
// ============================================================

describe('ProjectService - getTeamTimeReport', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns team time report with user breakdowns', async () => {
    mockDb.all
      .mockResolvedValueOnce([
        {
          user_id: 1,
          user_name: 'Alice',
          total_hours: 40,
          billable_hours: 35,
          total_amount: 3500
        },
        {
          user_id: 2,
          user_name: 'Bob',
          total_hours: 20,
          billable_hours: 20,
          total_amount: 2000
        }
      ])
      .mockResolvedValueOnce([
        { project_id: 10, project_name: 'Project A', hours: 40 }
      ])
      .mockResolvedValueOnce([
        { project_id: 11, project_name: 'Project B', hours: 20 }
      ]);

    const result = await projectService.getTeamTimeReport('2026-03-01', '2026-03-31');

    expect(result.startDate).toBe('2026-03-01');
    expect(result.endDate).toBe('2026-03-31');
    expect(result.totalHours).toBe(60);
    expect(result.byUser).toHaveLength(2);
    expect(result.byUser[0].userName).toBe('Alice');
    expect(result.byUser[0].projects).toHaveLength(1);
  });

  it('returns empty report when no time entries', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await projectService.getTeamTimeReport('2026-03-01', '2026-03-31');

    expect(result.totalHours).toBe(0);
    expect(result.byUser).toHaveLength(0);
  });
});

// ============================================================
// CREATE PROJECT FROM TEMPLATE
// ============================================================

describe('ProjectService - createProjectFromTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('creates project with milestones and tasks from template', async () => {
    // getTemplate call
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      name: 'Web Template',
      project_type: 'web',
      default_milestones: JSON.stringify([
        { name: 'Design Phase', order: 0, estimatedDays: 7 }
      ]),
      default_tasks: JSON.stringify([
        { title: 'Create wireframes', milestoneIndex: 0, priority: 'high', estimatedHours: 8 }
      ]),
      default_hourly_rate: 100,
      estimated_duration_days: 30,
      is_active: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });

    mockDb.run.mockResolvedValueOnce({ lastID: 50 }); // Create project
    mockDb.run.mockResolvedValueOnce({ lastID: 101 }); // Create milestone
    mockDb.run.mockResolvedValueOnce({ lastID: 201 }); // Create task

    const result = await projectService.createProjectFromTemplate(
      1,
      5,
      'My Web Project',
      '2026-03-01'
    );

    expect(result.projectId).toBe(50);
    expect(result.milestoneIds).toContain(101);
    expect(result.taskIds).toContain(201);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO projects"),
      expect.any(Array)
    );
  });

  it('throws when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(
      projectService.createProjectFromTemplate(999, 5, 'Project', '2026-03-01')
    ).rejects.toThrow('Template not found');
  });

  it('handles template with no milestones or tasks', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 2,
      name: 'Empty Template',
      project_type: null,
      default_milestones: '[]',
      default_tasks: '[]',
      default_hourly_rate: null,
      estimated_duration_days: null,
      is_active: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });

    mockDb.run.mockResolvedValueOnce({ lastID: 55 });

    const result = await projectService.createProjectFromTemplate(
      2,
      5,
      'Empty Project',
      '2026-03-01'
    );

    expect(result.projectId).toBe(55);
    expect(result.milestoneIds).toHaveLength(0);
    expect(result.taskIds).toHaveLength(0);
  });
});

// ============================================================
// CALCULATE PROJECT HEALTH
// ============================================================

describe('ProjectService - calculateProjectHealth', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns on_track when all metrics are healthy', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: 100,
        actual_hours: 50,
        estimated_end_date: '2027-01-01',
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 10, completed: 8, blocked: 0 })
      .mockResolvedValueOnce({ total: 3, completed: 2, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    expect(result.status).toBe('on_track');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.issues).toHaveLength(0);
  });

  it('reports overdue schedule issues', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: null,
        actual_hours: null,
        estimated_end_date: '2025-01-01', // Past date
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 5, completed: 2, blocked: 0 })
      .mockResolvedValueOnce({ total: 2, completed: 1, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const overdueIssue = result.issues.find((i) => i.includes('overdue'));
    expect(overdueIssue).toBeDefined();
    expect(result.factors.scheduleHealth).toBe(30);
  });

  it('reports budget concerns when actual hours exceed estimates', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: 100,
        actual_hours: 130, // 30% over
        estimated_end_date: '2027-01-01',
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 10, completed: 5, blocked: 0 })
      .mockResolvedValueOnce({ total: 3, completed: 2, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const budgetIssue = result.issues.find((i) => i.includes('over estimated hours'));
    expect(budgetIssue).toBeDefined();
    expect(result.factors.budgetHealth).toBe(30);
  });

  it('reports blocked tasks as issues', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: null,
        actual_hours: null,
        estimated_end_date: '2027-01-01',
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 5, completed: 2, blocked: 2 })
      .mockResolvedValueOnce({ total: 2, completed: 1, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const blockedIssue = result.issues.find((i) => i.includes('blocked'));
    expect(blockedIssue).toBeDefined();
  });

  it('reports overdue milestones', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: null,
        actual_hours: null,
        estimated_end_date: '2027-01-01',
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 5, completed: 4, blocked: 0 })
      .mockResolvedValueOnce({ total: 3, completed: 1, overdue: 2 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const milestoneIssue = result.issues.find((i) => i.includes('milestone'));
    expect(milestoneIssue).toBeDefined();
  });

  it('returns off_track when score is below 40', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: 100,
        actual_hours: 200, // 100% over
        estimated_end_date: '2020-01-01', // Far in the past
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 10, completed: 1, blocked: 5 })
      .mockResolvedValueOnce({ total: 5, completed: 0, overdue: 5 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    expect(result.status).toBe('off_track');
    expect(result.score).toBeLessThan(40);
  });

  it('throws when project not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(projectService.calculateProjectHealth(999)).rejects.toThrow('Project not found');
  });

  it('reports approaching deadline when less than 7 days remain', async () => {
    // Set up a date that is 3 days in the future
    const nearFuture = new Date();
    nearFuture.setDate(nearFuture.getDate() + 3);
    const nearDateStr = nearFuture.toISOString().split('T')[0];

    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: null,
        actual_hours: null,
        estimated_end_date: nearDateStr,
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 5, completed: 3, blocked: 0 })
      .mockResolvedValueOnce({ total: 2, completed: 1, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const deadlineIssue = result.issues.find((i) => i.includes('deadline'));
    expect(deadlineIssue).toBeDefined();
    expect(result.factors.scheduleHealth).toBe(60);
  });

  it('reports approaching budget when ratio is between 0.9 and 1.2', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        estimated_hours: 100,
        actual_hours: 95, // 95% of estimate
        estimated_end_date: '2027-01-01',
        budget_range: null
      })
      .mockResolvedValueOnce({ total: 5, completed: 3, blocked: 0 })
      .mockResolvedValueOnce({ total: 2, completed: 1, overdue: 0 });
    mockDb.run.mockResolvedValue({});

    const result = await projectService.calculateProjectHealth(1);

    const budgetIssue = result.issues.find((i) => i.includes('estimated hours'));
    expect(budgetIssue).toBeDefined();
    expect(result.factors.budgetHealth).toBe(70);
  });
});

// ============================================================
// ARCHIVE & UNARCHIVE PROJECT
// ============================================================

describe('ProjectService - archiveProject / unarchiveProject', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('archives a project by setting archived_at', async () => {
    mockDb.run.mockResolvedValue({});

    await expect(projectService.archiveProject(10)).resolves.not.toThrow();

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('archived_at = CURRENT_TIMESTAMP'),
      [10]
    );
  });

  it('unarchives a project by clearing archived_at', async () => {
    mockDb.run.mockResolvedValue({});

    await expect(projectService.unarchiveProject(10)).resolves.not.toThrow();

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('archived_at = NULL'),
      [10]
    );
  });
});

// ============================================================
// UPDATE TASK - error paths
// ============================================================

describe('ProjectService - updateTask error paths', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws Task not found when task does not exist', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(projectService.updateTask(999, { title: 'New' })).rejects.toThrow(
      'Task not found'
    );
  });

  it('throws Task not found after update when getTask returns null', async () => {
    mockDb.get.mockResolvedValueOnce({ milestone_id: null, project_id: 1 });
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(null); // getTask returns null after update

    await expect(projectService.updateTask(1, { title: 'Updated' })).rejects.toThrow(
      'Task not found after update'
    );
  });
});

// ============================================================
// DELETE TASK - error path
// ============================================================

describe('ProjectService - deleteTask error path', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when task not found before delete', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(projectService.deleteTask(999)).rejects.toThrow('Task not found');
  });
});

// ============================================================
// ADD DEPENDENCY - failed creation path
// ============================================================

describe('ProjectService - addDependency failed creation', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when dependency row not returned after insert', async () => {
    mockDb.all.mockResolvedValueOnce([]); // No circular dependency
    mockDb.run.mockResolvedValueOnce({ lastID: 99 });
    mockDb.get.mockResolvedValueOnce(null); // Dependency fetch fails

    await expect(projectService.addDependency(2, 1, 'finish_to_start')).rejects.toThrow(
      'Failed to create dependency'
    );
  });
});

// ============================================================
// GET TASKS - includeSubtasks option
// ============================================================

describe('ProjectService - getTasks with includeSubtasks', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('attaches subtasks to parent tasks when includeSubtasks is true', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        project_id: 10,
        title: 'Parent Task',
        status: 'pending',
        priority: 'high',
        sort_order: 1,
        parent_task_id: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z'
      },
      {
        id: 2,
        project_id: 10,
        title: 'Subtask',
        status: 'pending',
        priority: 'medium',
        sort_order: 1,
        parent_task_id: 1,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z'
      }
    ]);

    const result = await projectService.getTasks(10, { includeSubtasks: true });

    // Only root tasks should be returned; subtask is nested
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Parent Task');
    expect(result[0].subtasks).toHaveLength(1);
    expect(result[0].subtasks![0].title).toBe('Subtask');
  });

  it('filters by assignedTo when provided', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await projectService.getTasks(10, { assignedTo: 'alice@example.com' });

    const callArgs = mockDb.all.mock.calls[0];
    expect(String(callArgs[0])).toContain('display_name = ?');
    expect(callArgs[1]).toContain('alice@example.com');
  });
});

// ============================================================
// GET ALL TASKS - comma-separated statuses
// ============================================================

describe('ProjectService - getAllTasks with comma-separated statuses', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('filters by multiple comma-separated statuses using IN clause', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await projectService.getAllTasks({ status: 'pending,in_progress,blocked' });

    const callArgs = mockDb.all.mock.calls[0];
    expect(String(callArgs[0])).toContain('IN (');
    expect(callArgs[1]).toContain('pending');
    expect(callArgs[1]).toContain('in_progress');
    expect(callArgs[1]).toContain('blocked');
  });

  it('applies limit correctly', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await projectService.getAllTasks({ limit: 5 });

    const callArgs = mockDb.all.mock.calls[0];
    expect(callArgs[1]).toContain(5);
  });
});
