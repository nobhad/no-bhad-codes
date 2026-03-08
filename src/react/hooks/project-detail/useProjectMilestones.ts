/**
 * useProjectMilestones
 * Handles CRUD operations for project milestones and progress calculation.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ProjectMilestone } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '@/utils/api-client';
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
  projectId,
  getAuthToken
}: ProjectDetailHookOptions): UseProjectMilestonesReturn {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);

  const progress = useMemo(() => {
    if (milestones.length === 0) return 0;
    const completed = milestones.filter((m) => m.is_completed).length;
    return Math.round((completed / milestones.length) * PERCENTAGE_MULTIPLIER);
  }, [milestones]);

  const fetchMilestones = useCallback(async (): Promise<ProjectMilestone[]> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

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
  }, [projectId, getAuthToken]);

  const addMilestone = useCallback(
    async (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones`, {
          method: 'POST',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(milestone)
        });

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
    [projectId, getAuthToken]
  );

  const updateMilestone = useCallback(
    async (id: number, updates: Partial<ProjectMilestone>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones/${id}`, {
          method: 'PUT',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

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
    [projectId, getAuthToken]
  );

  const deleteMilestone = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/milestones/${id}`, {
          method: 'DELETE',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include'
        });

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
    [projectId, getAuthToken]
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
