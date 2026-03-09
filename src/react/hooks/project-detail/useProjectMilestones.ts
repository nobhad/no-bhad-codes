/**
 * useProjectMilestones
 * Handles CRUD operations for project milestones and progress calculation.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ProjectMilestone } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectMilestones');

const PERCENTAGE_MULTIPLIER = 100;

interface UseProjectMilestonesReturn {
  milestones: ProjectMilestone[];
  setMilestones: React.Dispatch<React.SetStateAction<ProjectMilestone[]>>;
  progress: number;
  fetchMilestones: () => Promise<ProjectMilestone[]>;
  addMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  updateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  deleteMilestone: (id: number) => Promise<boolean>;
  toggleMilestoneComplete: (id: number) => Promise<boolean>;
}

export function useProjectMilestones({
  projectId
}: ProjectDetailHookOptions): UseProjectMilestonesReturn {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);

  const progress = useMemo(() => {
    if (milestones.length === 0) return 0;
    const completed = milestones.filter((m) => m.is_completed).length;
    return Math.round((completed / milestones.length) * PERCENTAGE_MULTIPLIER);
  }, [milestones]);

  const fetchMilestones = useCallback(async (): Promise<ProjectMilestone[]> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ milestones: ProjectMilestone[] }>(json);
      return parsed.milestones || [];
    } catch (err) {
      logger.error('Error fetching milestones:', err);
      return [];
    }
  }, [projectId]);

  const addMilestone = useCallback(
    async (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>): Promise<boolean> => {
      try {
        const response = await apiPost(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones`, milestone);

        if (!response.ok) {
          throw new Error(`Failed to add milestone: ${response.statusText}`);
        }

        const json = await response.json();
        const newMilestone = unwrapApiData<ProjectMilestone>(json);
        setMilestones((prev) => [...prev, newMilestone]);
        return true;
      } catch (err) {
        logger.error('Add milestone error:', err);
        return false;
      }
    },
    [projectId]
  );

  const updateMilestone = useCallback(
    async (id: number, updates: Partial<ProjectMilestone>): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones/${id}`, updates);

        if (!response.ok) {
          throw new Error(`Failed to update milestone: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<ProjectMilestone>(json);
        setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
        return true;
      } catch (err) {
        logger.error('Update milestone error:', err);
        return false;
      }
    },
    [projectId]
  );

  const deleteMilestone = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await apiDelete(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones/${id}`);

        if (!response.ok) {
          throw new Error(`Failed to delete milestone: ${response.statusText}`);
        }

        setMilestones((prev) => prev.filter((m) => m.id !== id));
        return true;
      } catch (err) {
        logger.error('Delete milestone error:', err);
        return false;
      }
    },
    [projectId]
  );

  const toggleMilestoneComplete = useCallback(
    async (id: number): Promise<boolean> => {
      const milestone = milestones.find((m) => m.id === id);
      if (!milestone) return false;

      const updates = {
        is_completed: !milestone.is_completed,
        completed_date: !milestone.is_completed ? new Date().toISOString() : undefined
      };

      return updateMilestone(id, updates);
    },
    [milestones, updateMilestone]
  );

  return {
    milestones,
    setMilestones,
    progress,
    fetchMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneComplete
  };
}
