import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectStats, ApiResponse } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { decodeArrayFields } from '../utils/decodeText';

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
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.PROJECTS, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle various response formats:
      // 1. { projects: [...], stats: {...} } - most common
      // 2. { success, data: { projects: [...] } }
      // 3. { success, data: [...] }
      // 4. Direct array [...]
      let projectsArray: Project[] = [];
      if (data.projects && Array.isArray(data.projects)) {
        projectsArray = data.projects;
      } else if (data.success && data.data) {
        projectsArray = Array.isArray(data.data) ? data.data : data.data.projects || [];
      } else if (Array.isArray(data)) {
        projectsArray = data;
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }

      // Decode HTML entities in text fields to prevent double-encoding
      setProjects(decodeArrayFields(projectsArray, PROJECT_TEXT_FIELDS));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useProjects] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Update a single project
  const updateProject = useCallback(
    async (id: number, updates: Partial<Project>): Promise<boolean> => {
      try {
        const token = getAuthToken?.();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${id}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const data: ApiResponse<Project> = await response.json();

        if (data.success) {
          // Update local state
          setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
          return true;
        }
        throw new Error(data.error || 'Failed to update project');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        console.error('[useProjects] Update error:', message);
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
        const token = getAuthToken?.();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Try bulk endpoint first
        const response = await fetch(API_ENDPOINTS.ADMIN.PROJECTS_BULK_DELETE, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ projectIds: ids })
        });

        if (response.ok) {
          const data: ApiResponse<{ deleted: number }> = await response.json();
          if (data.success) {
            success = data.data?.deleted || ids.length;
            // Remove from local state
            setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
          }
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
        console.error('[useProjects] Bulk delete error:', err);
        failed = ids.length;
      }

      return { success, failed };
    },
    [getAuthToken]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchProjects();
    }
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
