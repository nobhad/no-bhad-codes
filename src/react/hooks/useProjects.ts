import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectStats } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPut, apiPost, apiDelete } from '../../utils/api-client';
import { decodeArrayFields } from '../utils/decodeText';
import { createLogger } from '../../utils/logger';
import { formatErrorMessage } from '@/utils/error-utils';

const logger = createLogger('useProjects');

/** Text fields in Project that may contain HTML entities */
const PROJECT_TEXT_FIELDS = ['project_name', 'description', 'notes'] as const;

interface UseProjectsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
}

export interface CreateProjectData {
  clientId?: string | number;
  newClient?: {
    contactName: string;
    email: string;
    companyName?: string;
    phone?: string;
  } | null;
  projectType: string;
  description: string;
  budget: string;
  timeline: string;
  notes?: string;
  features?: string;
  pageCount?: string;
  integrations?: string;
  addons?: string;
  designLevel?: string;
  contentStatus?: string;
  brandAssets?: string;
  techComfort?: string;
  hostingPreference?: string;
  currentSite?: string;
  inspiration?: string;
  challenges?: string;
  additionalInfo?: string;
  referralSource?: string;
}

export interface CreateProjectResult {
  projectId: number;
  projectName: string;
  clientId: number;
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
  /** Create a new project */
  createProject: (data: CreateProjectData) => Promise<CreateProjectResult | null>;
  /** Update a single project */
  updateProject: (id: number, updates: Partial<Project>) => Promise<boolean>;
  /** Delete multiple projects */
  bulkDelete: (ids: number[]) => Promise<{ success: number; failed: number }>;
}

/**
 * Hook for fetching and managing projects data
 */
export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const { autoFetch = true } = options;

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
      const response = await apiFetch(API_ENDPOINTS.PROJECTS, { signal });

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
      const message = formatErrorMessage(err, 'An error occurred');
      setError(message);
      logger.error('[useProjects] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new project
  const createProject = useCallback(
    async (data: CreateProjectData): Promise<CreateProjectResult | null> => {
      try {
        const response = await apiPost(API_ENDPOINTS.ADMIN.PROJECTS, data);
        if (!response.ok) {
          throw new Error(`Failed to create project: ${response.statusText}`);
        }
        const json = await response.json();
        const result = unwrapApiData<CreateProjectResult>(json);
        await fetchProjects();
        return result;
      } catch (err) {
        const message = formatErrorMessage(err, 'An error occurred');
        logger.error('[useProjects] Create error:', message);
        return null;
      }
    },
    [fetchProjects]
  );

  // Update a single project
  const updateProject = useCallback(
    async (id: number, updates: Partial<Project>): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.PROJECTS}/${id}`, updates);

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Project>(json);
        // Update local state
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
        return true;
      } catch (err) {
        const message = formatErrorMessage(err, 'An error occurred');
        logger.error('[useProjects] Update error:', message);
        return false;
      }
    },
    []
  );

  // Delete multiple projects
  const bulkDelete = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      try {
        // Try bulk endpoint first
        const response = await apiPost(API_ENDPOINTS.ADMIN.PROJECTS_BULK_DELETE, { projectIds: ids });

        if (response.ok) {
          const json = await response.json();
          const data = unwrapApiData<{ deleted: number }>(json);
          success = data.deleted || ids.length;
          // Remove from local state
          setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
        } else {
          // Fallback to individual deletes
          for (const id of ids) {
            const deleteResponse = await apiDelete(`${API_ENDPOINTS.PROJECTS}/${id}`);
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
    []
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
    createProject,
    updateProject,
    bulkDelete
  };
}
