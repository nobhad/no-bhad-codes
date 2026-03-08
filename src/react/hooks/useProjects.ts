import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectStats } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '../../utils/api-client';
import { decodeArrayFields } from '../utils/decodeText';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useProjects');

/** Text fields in Project that may contain HTML entities */
const PROJECT_TEXT_FIELDS = ['project_name', 'description', 'notes'] as const;

interface UseProjectsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Auth token getter */
  getAuthToken?: () => string | null;
}

interface UseProjectsReturn {
  /** Project data */
  projects: Project[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Computed stats */
  stats: ProjectStats;
  /** Refetch data */
  refetch: () => Promise<void>;
  /** Update a single project */
  updateProject: (id: number, updates: Partial<Project>) => Promise<boolean>;
  /** Delete multiple projects */
  bulkDelete: (ids: number[]) => Promise<{ success: number; failed: number }>;
}

/**
 * Hook for fetching and managing projects data
 */
export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const { autoFetch = true, getAuthToken } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute stats from projects
  const stats: ProjectStats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active' || p.status === 'in-progress').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    onHold: projects.filter((p) => p.status === 'on-hold').length,
    pending: projects.filter((p) => p.status === 'pending').length
  };

  // Fetch projects from API
  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.PROJECTS, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const json = await response.json();
      const data = unwrapApiData<{ projects: Project[] }>(json);
      const projectsArray = data.projects || [];

      // Decode HTML entities in text fields to prevent double-encoding
      setProjects(decodeArrayFields(projectsArray, PROJECT_TEXT_FIELDS));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[useProjects] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Update a single project
  const updateProject = useCallback(
    async (id: number, updates: Partial<Project>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${id}`, {
          method: 'PUT',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Project>(json);
        // Update local state
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        logger.error('[useProjects] Update error:', message);
        return false;
      }
    },
    [getAuthToken]
  );

  // Delete multiple projects
  const bulkDelete = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      try {
        const headers = buildAuthHeaders(getAuthToken);

        // Try bulk endpoint first
        const response = await fetch(API_ENDPOINTS.ADMIN.PROJECTS_BULK_DELETE, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ projectIds: ids })
        });

        if (response.ok) {
          const json = await response.json();
          const data = unwrapApiData<{ deleted: number }>(json);
          success = data.deleted || ids.length;
          // Remove from local state
          setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
        } else {
          // Fallback to individual deletes
          for (const id of ids) {
            const deleteResponse = await fetch(`${API_ENDPOINTS.PROJECTS}/${id}`, {
              method: 'DELETE',
              headers,
              credentials: 'include'
            });
            if (deleteResponse.ok) {
              success++;
            } else {
              failed++;
            }
          }
          // Remove successful deletes from local state
          if (success > 0) {
            setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
          }
        }
      } catch (err) {
        logger.error('[useProjects] Bulk delete error:', err);
        failed = ids.length;
      }

      return { success, failed };
    },
    [getAuthToken]
  );

  // Auto-fetch on mount with AbortController cleanup
  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    fetchProjects(controller.signal);
    return () => controller.abort();
  }, [autoFetch, fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    stats,
    refetch: fetchProjects,
    updateProject,
    bulkDelete
  };
}
