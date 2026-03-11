/**
 * useProjectTasks
 * Fetches and manages project_tasks for the deliverables view.
 * Tasks are the actual work items linked to milestones.
 */

import { useState, useCallback } from 'react';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPut } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';
import type { ProjectTaskResponse } from '@/types/api';

const logger = createLogger('useProjectTasks');

export interface UseProjectTasksReturn {
  tasks: ProjectTaskResponse[];
  setTasks: React.Dispatch<React.SetStateAction<ProjectTaskResponse[]>>;
  fetchTasks: () => Promise<ProjectTaskResponse[]>;
  toggleTaskComplete: (taskId: number) => Promise<boolean>;
  assignTaskToMilestone: (taskId: number, milestoneId: number) => Promise<boolean>;
}

export function useProjectTasks({
  projectId
}: ProjectDetailHookOptions): UseProjectTasksReturn {
  const [tasks, setTasks] = useState<ProjectTaskResponse[]>([]);

  const fetchTasks = useCallback(async (): Promise<ProjectTaskResponse[]> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/tasks`);
      if (!response.ok) return [];

      const json = await response.json();
      const parsed = unwrapApiData<{ tasks: ProjectTaskResponse[] }>(json);
      return parsed.tasks || [];
    } catch (err) {
      logger.error('Error fetching tasks:', err);
      return [];
    }
  }, [projectId]);

  const toggleTaskComplete = useCallback(
    async (taskId: number): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;

      const newStatus = task.status === 'completed' ? 'pending' : 'completed';

      try {
        const response = await apiPut(
          `${API_ENDPOINTS.PROJECTS}/tasks/${taskId}`,
          { status: newStatus }
        );

        if (!response.ok) return false;

        const json = await response.json();
        const updated = unwrapApiData<{ task: ProjectTaskResponse }>(json);

        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updated.task } : t))
        );
        return true;
      } catch (err) {
        logger.error('Toggle task error:', err);
        return false;
      }
    },
    [tasks]
  );

  const assignTaskToMilestone = useCallback(
    async (taskId: number, milestoneId: number): Promise<boolean> => {
      try {
        const response = await apiPut(
          `${API_ENDPOINTS.PROJECTS}/tasks/${taskId}`,
          { milestoneId }
        );

        if (!response.ok) return false;

        const json = await response.json();
        const updated = unwrapApiData<{ task: ProjectTaskResponse }>(json);

        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updated.task } : t))
        );
        return true;
      } catch (err) {
        logger.error('Assign task to milestone error:', err);
        return false;
      }
    },
    []
  );

  return {
    tasks,
    setTasks,
    fetchTasks,
    toggleTaskComplete,
    assignTaskToMilestone
  };
}
