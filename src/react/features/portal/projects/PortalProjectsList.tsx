/**
 * PortalProjectsList
 * Client portal projects list with project cards showing status and progress
 */

import * as React from 'react';
import { FolderOpen, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import type { PortalProject, PortalProjectStatus } from '../types';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalProjectsList');

/**
 * Transform API response to PortalProject interface
 * Maps project_name to name for compatibility
 */
function transformProject(apiProject: Record<string, unknown>): PortalProject {
  return {
    id: apiProject.id as number,
    name: (apiProject.name || apiProject.project_name || 'Untitled Project') as string,
    description: apiProject.description as string | undefined,
    status: (apiProject.status || 'pending') as PortalProjectStatus,
    progress: (apiProject.progress || 0) as number,
    start_date: apiProject.start_date as string | undefined,
    end_date: (apiProject.end_date || apiProject.estimated_end_date) as string | undefined,
    preview_url: apiProject.preview_url as string | undefined,
    client_id: apiProject.client_id as number | undefined,
    created_at: apiProject.created_at as string | undefined,
    updated_at: apiProject.updated_at as string | undefined,
  };
}

interface PortalProjectsListProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * PortalProjectsList Component
 */
export function PortalProjectsList({
  getAuthToken,
  onSelectProject,
  showNotification,
}: PortalProjectsListProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const cardsRef = useStaggerChildren<HTMLDivElement>(0.08, 0.1);

  const [projects, setProjects] = React.useState<PortalProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // AbortController ref for cleanup on unmount
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Fetch projects from API
  const fetchProjects = React.useCallback(async () => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.PROJECTS, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle various response formats and transform to PortalProject interface
      let rawProjects: Record<string, unknown>[] = [];

      if (data.projects && Array.isArray(data.projects)) {
        rawProjects = data.projects;
      } else if (data.success && data.data) {
        rawProjects = Array.isArray(data.data) ? data.data : (data.data.projects || []);
      } else if (Array.isArray(data)) {
        rawProjects = data;
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }

      // Transform API response to match PortalProject interface (maps project_name to name)
      const transformedProjects = rawProjects.map(transformProject);
      setProjects(transformedProjects);
    } catch (err) {
      // Don't set error state if request was aborted (component unmounted)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[PortalProjectsList] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Fetch on mount
  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle project selection
  const handleProjectClick = (project: PortalProject) => {
    onSelectProject?.(String(project.id));
  };

  // Handle preview link click
  const handlePreviewClick = (e: React.MouseEvent, project: PortalProject) => {
    e.stopPropagation();
    if (project.preview_url) {
      window.open(project.preview_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading projects...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="btn-secondary" onClick={fetchProjects}>
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div ref={containerRef}>
        <EmptyState
          icon={<FolderOpen className="tw-h-6 tw-w-6" />}
          message="No projects yet. Your projects will appear here once they begin."
        />
      </div>
    );
  }

  // Group projects by status for summary
  const activeCount = projects.filter(p => p.status === 'active' || p.status === 'in-progress').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  return (
    <div ref={containerRef} className="tw-section">
      {/* Summary Stats */}
      <div className="tw-grid-stats">
        <div className="tw-stat-card">
          <span className="tw-stat-label">Total</span>
          <span className="tw-stat-value">{projects.length}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Active</span>
          <span className="tw-stat-value">{activeCount}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Completed</span>
          <span className="tw-stat-value">{completedCount}</span>
        </div>
      </div>

      {/* Project Cards */}
      <div ref={cardsRef} className="tw-section">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => handleProjectClick(project)}
            onPreviewClick={(e) => handlePreviewClick(e, project)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ProjectCard Component
 */
interface ProjectCardProps {
  project: PortalProject;
  onClick: () => void;
  onPreviewClick: (e: React.MouseEvent) => void;
}

function ProjectCard({ project, onClick, onPreviewClick }: ProjectCardProps) {
  const statusConfig = PORTAL_PROJECT_STATUS_CONFIG[project.status as PortalProjectStatus];
  const statusLabel = statusConfig?.label || project.status;

  return (
    <div onClick={onClick} className="tw-card-hover">
      {/* Header: Name and Status */}
      <div className="projlist-header">
        <div className="projlist-name-wrap">
          <FolderOpen className="tw-h-4 tw-w-4" />
          <span className="tw-text-primary projlist-name">
            {decodeHtmlEntities(project.name)}
          </span>
        </div>
        <div className="projlist-status-wrap">
          <span className="tw-badge">{statusLabel}</span>
          <ChevronRight className="tw-h-4 tw-w-4" />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="tw-text-muted projlist-desc">
          {decodeHtmlEntities(project.description)}
        </p>
      )}

      {/* Progress Bar */}
      <div className="projlist-progress">
        <div className="projlist-progress-header">
          <span className="tw-label">Progress</span>
          <span className="tw-text-primary tw-text-sm">{project.progress}%</span>
        </div>
        <div className="tw-progress-track">
          <div
            className="tw-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
          />
        </div>
      </div>

      {/* Footer: Date and Preview */}
      <div className="projlist-footer">
        <span className="tw-text-muted tw-text-xs">
          {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
        </span>
        {project.preview_url && (
          <IconButton action="external-link" onClick={onPreviewClick} title="View Preview" />
        )}
      </div>
    </div>
  );
}
