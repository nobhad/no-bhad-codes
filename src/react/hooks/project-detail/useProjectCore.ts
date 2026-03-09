/**
 * useProjectCore
 * Handles fetching and updating the project entity itself.
 */

import { useState, useCallback } from 'react';
import type { Project } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPut } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectCore');

interface UseProjectCoreReturn {
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  fetchProject: () => Promise<Project>;
  updateProject: (updates: Partial<Project>) => Promise<boolean>;
}

export function useProjectCore({
  projectId
}: ProjectDetailHookOptions): UseProjectCoreReturn {
  const [project, setProject] = useState<Project | null>(null);

  const fetchProject = useCallback(async (): Promise<Project> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.PROJECTS}/${projectId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ project: Project } | Project>(json);

      if ('project' in parsed && parsed.project) {
        return parsed.project;
      }
      return parsed as Project;
    } catch (err) {
      logger.error('Error fetching project:', err);
      throw err;
    }
  }, [projectId]);

  const updateProject = useCallback(
    async (updates: Partial<Project>): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.PROJECTS}/${projectId}`, updates);

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Project>(json);
        setProject((prev) => (prev ? { ...prev, ...updates } : null));
        return true;
      } catch (err) {
        logger.error('Update project error:', err);
        return false;
      }
    },
    [projectId]
  );

  return { project, setProject, fetchProject, updateProject };
}
