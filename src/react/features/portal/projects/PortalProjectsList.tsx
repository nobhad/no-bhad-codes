/**
 * PortalProjectsList
 * Client portal projects list with project cards showing status and progress
 */

import * as React from 'react';
import { FolderOpen, RefreshCw, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import type { PortalProject, PortalProjectStatus } from '../types';

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

  // Fetch projects from API
  const fetchProjects = React.useCallback(async () => {
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

      const response = await fetch('/api/projects', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle various response formats
      if (data.projects && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else if (data.success && data.data) {
        const projectsArray = Array.isArray(data.data) ? data.data : (data.data.projects || []);
        setProjects(projectsArray);
      } else if (Array.isArray(data)) {
        setProjects(data);
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[PortalProjectsList] Error:', message);
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
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading projects...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={fetchProjects}>
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div ref={containerRef} className="tw-empty-state">
        <FolderOpen className="tw-h-8 tw-w-8" />
        <span>No projects yet. Your projects will appear here once they begin.</span>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <FolderOpen className="tw-h-4 tw-w-4 tw-text-muted" />
          <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 400 }}>
            {project.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span className="tw-badge">{statusLabel}</span>
          <ChevronRight className="tw-h-4 tw-w-4 tw-text-muted" />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="tw-text-muted" style={{ fontSize: '12px', marginBottom: '0.5rem' }}>
          {project.description}
        </p>
      )}

      {/* Progress Bar */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span className="tw-label">Progress</span>
          <span className="tw-text-primary" style={{ fontSize: '12px' }}>{project.progress}%</span>
        </div>
        <div className="tw-progress-track">
          <div
            className="tw-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
          />
        </div>
      </div>

      {/* Footer: Date and Preview */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="tw-text-muted" style={{ fontSize: '11px' }}>
          {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
        </span>
        {project.preview_url && (
          <button className="tw-btn-icon" onClick={onPreviewClick} title="View Preview">
            <ExternalLink className="tw-h-4 tw-w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
