/**
 * ===============================================
 * UNIT TESTS - PROJECT SERVICE
 * ===============================================
 * @file tests/unit/services/project-service.test.ts
 *
 * Tests for project management service including:
 * - Task CRUD operations
 * - Task dependencies
 * - Task comments and checklists
 * - Time tracking
 * - Project templates
 * - Project metrics (burndown, velocity)
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../../server/services/progress-calculator', () => ({
  checkAndUpdateMilestoneCompletion: vi.fn().mockResolvedValue(undefined),
  updateProjectProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import service after mocks
import { projectService } from '../../../server/services/project-service';

describe('ProjectService - Task Management', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createTask', () => {
    it('creates a task with required fields', async () => {
      const mockTask = {
        id: 1,
        project_id: 1,
        title: 'New Task',
        status: 'pending',
        priority: 'medium',
        sort_order: 1,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.get.mockResolvedValueOnce({ max_order: 0 }); // Max sort order
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockTask);

      const result = await projectService.createTask(1, { title: 'New Task' });

      expect(result).toBeDefined();
      expect(result.title).toBe('New Task');
      expect(result.status).toBe('pending');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('throws error if task creation fails', async () => {
      mockDb.get.mockResolvedValueOnce({ max_order: 0 });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null); // No task found

      await expect(projectService.createTask(1, { title: 'Test' })).rejects.toThrow(
        'Failed to create task'
      );
    });
  });

  describe('getTasks', () => {
    it('returns all tasks for a project', async () => {
      const mockTasks = [
        {
          id: 1,
          project_id: 1,
          title: 'Task 1',
          status: 'pending',
          priority: 'medium',
          sort_order: 1,
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
        {
          id: 2,
          project_id: 1,
          title: 'Task 2',
          status: 'completed',
          priority: 'high',
          sort_order: 2,
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockTasks);

      const result = await projectService.getTasks(1);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task 1');
      expect(result[1].title).toBe('Task 2');
    });

    it('filters tasks by status', async () => {
      const mockTasks = [
        {
          id: 2,
          project_id: 1,
          title: 'Completed Task',
          status: 'completed',
          priority: 'high',
          sort_order: 1,
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockTasks);

      const result = await projectService.getTasks(1, { status: 'completed' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('filters tasks by milestone', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await projectService.getTasks(1, { milestoneId: 5 });

      expect(mockDb.all).toHaveBeenCalled();
      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(5);
    });
  });

  describe('getTask', () => {
    it('returns a single task by ID', async () => {
      const mockTask = {
        id: 1,
        project_id: 1,
        title: 'Single Task',
        status: 'pending',
        priority: 'medium',
        sort_order: 1,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.get.mockResolvedValueOnce(mockTask);
      mockDb.all.mockResolvedValueOnce([]); // Subtasks
      mockDb.all.mockResolvedValueOnce([]); // Dependencies
      mockDb.all.mockResolvedValueOnce([]); // Checklist items

      const result = await projectService.getTask(1);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Single Task');
    });

    it('returns null for non-existent task', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await projectService.getTask(999);

      expect(result).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('updates task title', async () => {
      const currentTask = {
        milestone_id: null,
        project_id: 1,
      };
      const updatedTask = {
        id: 1,
        project_id: 1,
        title: 'Updated Title',
        status: 'pending',
        priority: 'medium',
        sort_order: 1,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      // First db.get checks if task exists
      mockDb.get.mockResolvedValueOnce(currentTask);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // getTask after update needs: task, subtasks, dependencies, checklist
      mockDb.get.mockResolvedValueOnce(updatedTask);
      mockDb.all.mockResolvedValueOnce([]); // Subtasks
      mockDb.all.mockResolvedValueOnce([]); // Dependencies
      mockDb.all.mockResolvedValueOnce([]); // Checklist

      const result = await projectService.updateTask(1, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('updates task status and triggers progress update', async () => {
      const currentTask = {
        milestone_id: 2,
        project_id: 1,
      };
      const updatedTask = {
        id: 1,
        project_id: 1,
        milestone_id: 2,
        title: 'Task',
        status: 'completed',
        priority: 'medium',
        sort_order: 1,
        completed_at: '2026-02-27T00:00:00Z',
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      // First db.get checks if task exists
      mockDb.get.mockResolvedValueOnce(currentTask);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // getTask after update needs: task, subtasks, dependencies, checklist
      mockDb.get.mockResolvedValueOnce(updatedTask);
      mockDb.all.mockResolvedValueOnce([]); // Subtasks
      mockDb.all.mockResolvedValueOnce([]); // Dependencies
      mockDb.all.mockResolvedValueOnce([]); // Checklist

      const result = await projectService.updateTask(1, { status: 'completed' });

      expect(result.status).toBe('completed');
    });
  });

  describe('deleteTask', () => {
    it('deletes a task', async () => {
      // First getTask to find the task before delete
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        milestone_id: 1,
        project_id: 1,
      });
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // Delete checklist items
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // Delete comments
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // Delete dependencies (as dependent)
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // Delete dependencies (as dependency)
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // Delete task

      await expect(projectService.deleteTask(1)).resolves.not.toThrow();

      expect(mockDb.run).toHaveBeenCalled();
    });
  });
});

describe('ProjectService - Task Dependencies', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addDependency', () => {
    it('adds a dependency between tasks', async () => {
      const mockDependency = {
        id: 1,
        task_id: 2,
        depends_on_task_id: 1,
        dependency_type: 'finish_to_start',
        created_at: '2026-02-27T00:00:00Z',
      };

      // Check no circular dependency
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockDependency);

      const result = await projectService.addDependency(2, 1, 'finish_to_start');

      expect(result).toBeDefined();
      expect(result.taskId).toBe(2);
      expect(result.dependsOnTaskId).toBe(1);
    });

    it('prevents circular dependencies', async () => {
      // Task 1 already depends on Task 2
      mockDb.all.mockResolvedValueOnce([{ depends_on_task_id: 2 }]);

      await expect(projectService.addDependency(2, 1, 'finish_to_start')).rejects.toThrow();
    });
  });

  describe('removeDependency', () => {
    it('removes a dependency', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await expect(projectService.removeDependency(2, 1)).resolves.not.toThrow();
    });
  });

  describe('getBlockedTasks', () => {
    it('returns tasks blocked by incomplete dependencies', async () => {
      const mockBlockedTasks = [
        {
          id: 3,
          project_id: 1,
          title: 'Blocked Task',
          status: 'blocked',
          priority: 'medium',
          sort_order: 1,
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockBlockedTasks);

      const result = await projectService.getBlockedTasks(1);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('blocked');
    });
  });
});

describe('ProjectService - Task Comments', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addTaskComment', () => {
    it('adds a comment to a task', async () => {
      const mockComment = {
        id: 1,
        task_id: 1,
        author_name: 'admin@example.com', // The schema maps author from author_name column
        author_user_id: 1,
        content: 'Test comment',
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockComment);

      const result = await projectService.addTaskComment(1, 'admin@example.com', 'Test comment');

      expect(result.content).toBe('Test comment');
      expect(result.author).toBe('admin@example.com');
    });
  });

  describe('getTaskComments', () => {
    it('returns all comments for a task', async () => {
      const mockComments = [
        {
          id: 1,
          task_id: 1,
          author: 'user1@example.com',
          content: 'First comment',
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
        {
          id: 2,
          task_id: 1,
          author: 'user2@example.com',
          content: 'Second comment',
          created_at: '2026-02-27T01:00:00Z',
          updated_at: '2026-02-27T01:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockComments);

      const result = await projectService.getTaskComments(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteTaskComment', () => {
    it('deletes a comment', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await expect(projectService.deleteTaskComment(1)).resolves.not.toThrow();
    });
  });
});

describe('ProjectService - Checklist Items', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addChecklistItem', () => {
    it('adds a checklist item to a task', async () => {
      const mockItem = {
        id: 1,
        task_id: 1,
        content: 'Checklist item',
        is_completed: 0,
        sort_order: 1,
        created_at: '2026-02-27T00:00:00Z',
      };

      mockDb.get.mockResolvedValueOnce({ max_order: 0 });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockItem);

      const result = await projectService.addChecklistItem(1, 'Checklist item');

      expect(result.content).toBe('Checklist item');
      expect(result.isCompleted).toBe(false);
    });
  });

  describe('deleteChecklistItem', () => {
    it('deletes a checklist item', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await expect(projectService.deleteChecklistItem(1)).resolves.not.toThrow();
    });
  });
});

describe('ProjectService - Time Tracking', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getTimeEntries', () => {
    it('returns time entries for a project', async () => {
      const mockEntries = [
        {
          id: 1,
          project_id: 1,
          task_id: 1,
          user_name: 'developer',
          description: 'Development work',
          hours: 4,
          date: '2026-02-27',
          billable: 1,
          hourly_rate: 100,
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockEntries);

      const result = await projectService.getTimeEntries(1);

      expect(result).toHaveLength(1);
      expect(result[0].hours).toBe(4);
      expect(result[0].billable).toBe(true);
    });

    it('filters time entries by date range', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await projectService.getTimeEntries(1, { startDate: '2026-02-01', endDate: '2026-02-28' });

      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  describe('updateTimeEntry', () => {
    it('updates a time entry', async () => {
      const updatedEntry = {
        id: 1,
        project_id: 1,
        user_name: 'developer',
        hours: 6,
        date: '2026-02-27',
        billable: 1,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(updatedEntry);

      const result = await projectService.updateTimeEntry(1, { hours: 6 });

      expect(result.hours).toBe(6);
    });
  });

  describe('deleteTimeEntry', () => {
    it('deletes a time entry', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await expect(projectService.deleteTimeEntry(1)).resolves.not.toThrow();
    });
  });

  describe('getProjectTimeStats', () => {
    it('returns time statistics for a project', async () => {
      mockDb.get.mockResolvedValueOnce({
        total: 40,
        billable: 35,
        non_billable: 5,
        amount: 3500,
      });
      mockDb.all.mockResolvedValueOnce([
        { user_name: 'dev1', hours: 25, amount: 2500 },
        { user_name: 'dev2', hours: 15, amount: 1000 },
      ]);
      mockDb.all.mockResolvedValueOnce([
        { task_id: 1, task_title: 'Task 1', hours: 20 },
        { task_id: 2, task_title: 'Task 2', hours: 20 },
      ]);
      mockDb.all.mockResolvedValueOnce([
        { week_start: '2026-02-17', hours: 20 },
        { week_start: '2026-02-24', hours: 20 },
      ]);

      const result = await projectService.getProjectTimeStats(1);

      expect(result.totalHours).toBe(40);
      expect(result.billableHours).toBe(35);
      expect(result.totalAmount).toBe(3500);
      expect(result.byUser).toHaveLength(2);
      expect(result.byTask).toHaveLength(2);
      expect(result.byWeek).toHaveLength(2);
    });
  });
});

describe('ProjectService - Templates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createTemplate', () => {
    it('creates a project template', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Web Project Template',
        description: 'Standard web project setup',
        project_type: 'web',
        default_milestones: '[]',
        default_tasks: '[]',
        estimated_hours: 100,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockTemplate);

      const result = await projectService.createTemplate({
        name: 'Web Project Template',
        description: 'Standard web project setup',
        projectType: 'web',
        defaultMilestones: [],
        defaultTasks: [],
        estimatedHours: 100,
      });

      expect(result.name).toBe('Web Project Template');
    });
  });

  describe('getTemplates', () => {
    it('returns all templates', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          project_type: 'web',
          default_milestones: '[]',
          default_tasks: '[]',
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
        {
          id: 2,
          name: 'Template 2',
          project_type: 'mobile',
          default_milestones: '[]',
          default_tasks: '[]',
          created_at: '2026-02-27T00:00:00Z',
          updated_at: '2026-02-27T00:00:00Z',
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockTemplates);

      const result = await projectService.getTemplates();

      expect(result).toHaveLength(2);
    });

    it('filters templates by project type', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await projectService.getTemplates('web');

      expect(mockDb.all).toHaveBeenCalled();
      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain('web');
    });
  });

  describe('getTemplate', () => {
    it('returns a template by ID', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Template 1',
        project_type: 'web',
        default_milestones: '[]',
        default_tasks: '[]',
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };

      mockDb.get.mockResolvedValueOnce(mockTemplate);

      const result = await projectService.getTemplate(1);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Template 1');
    });

    it('returns null for non-existent template', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await projectService.getTemplate(999);

      expect(result).toBeNull();
    });
  });
});

describe('ProjectService - Tags', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addTagToProject', () => {
    it('adds a tag to a project', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      await expect(projectService.addTagToProject(1, 5)).resolves.not.toThrow();

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('removeTagFromProject', () => {
    it('removes a tag from a project', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await expect(projectService.removeTagFromProject(1, 5)).resolves.not.toThrow();
    });
  });

  describe('getProjectTags', () => {
    it('returns tags for a project', async () => {
      const mockTags = [
        { id: 1, name: 'urgent', color: '#ff0000' },
        { id: 2, name: 'feature', color: '#00ff00' },
      ];

      mockDb.all.mockResolvedValueOnce(mockTags);

      const result = await projectService.getProjectTags(1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('urgent');
    });
  });
});

describe('ProjectService - Metrics', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getProjectBurndown', () => {
    it('returns burndown data for a project', async () => {
      // Project with dates
      mockDb.get.mockResolvedValueOnce({
        start_date: '2026-02-20',
        estimated_end_date: '2026-02-22',
        estimated_hours: 24,
      });
      // For each day, it queries time entries
      mockDb.get.mockResolvedValueOnce({ hours: 8 });
      mockDb.get.mockResolvedValueOnce({ hours: 16 });
      mockDb.get.mockResolvedValueOnce({ hours: 24 });

      const result = await projectService.getProjectBurndown(1);

      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(3);
      expect(result.plannedHours).toHaveLength(3);
      expect(result.actualHours).toHaveLength(3);
      expect(result.remainingHours).toHaveLength(3);
    });

    it('returns empty arrays for project without dates', async () => {
      mockDb.get.mockResolvedValueOnce({});

      const result = await projectService.getProjectBurndown(1);

      expect(result.dates).toHaveLength(0);
      expect(result.plannedHours).toHaveLength(0);
    });
  });

  describe('getProjectVelocity', () => {
    it('returns velocity data for a project', async () => {
      mockDb.all.mockResolvedValueOnce([
        { week_start: '2026-02-17', hours: 40, tasks: 5 },
        { week_start: '2026-02-10', hours: 32, tasks: 4 },
      ]);

      const result = await projectService.getProjectVelocity(1);

      expect(result).toBeDefined();
      expect(result.weeks).toHaveLength(2);
      expect(result.hoursCompleted).toHaveLength(2);
      expect(result.tasksCompleted).toHaveLength(2);
    });
  });
});

describe('ProjectService - getAllTasks', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all tasks across projects', async () => {
    const mockTasks = [
      {
        id: 1,
        project_id: 1,
        title: 'Task 1',
        status: 'pending',
        priority: 'high',
        sort_order: 1,
        project_name: 'Project 1',
        client_name: 'Client 1',
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      },
    ];

    mockDb.all.mockResolvedValueOnce(mockTasks);

    const result = await projectService.getAllTasks({ limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task 1');
    expect(result[0].projectName).toBe('Project 1');
  });

  it('filters tasks by status', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await projectService.getAllTasks({ status: 'completed' });

    expect(mockDb.all).toHaveBeenCalled();
  });

  it('filters tasks by priority', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    await projectService.getAllTasks({ priority: 'urgent' });

    expect(mockDb.all).toHaveBeenCalled();
  });
});
