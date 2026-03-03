import * as React from 'react';
import { FolderKanban, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { ClientProject } from '../../types';
import { PROJECT_STATUS_CONFIG } from '../../types';

interface ProjectsTabProps {
  projects: ClientProject[];
  onViewProject?: (projectId: number) => void;
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get progress bar color
 */
function getProgressColor(progress: number, status: string): string {
  if (status === 'completed') return 'tw-bg-[var(--status-completed)]';
  if (status === 'cancelled') return 'tw-bg-[var(--status-cancelled)]';
  if (progress >= 75) return 'tw-bg-[var(--status-completed)]';
  if (progress >= 50) return 'tw-bg-[var(--color-brand-primary)]';
  if (progress >= 25) return 'tw-bg-[var(--status-warning)]';
  return 'tw-bg-[var(--portal-text-muted)]';
}

/**
 * ProjectsTab
 * Shows client's projects
 */
export function ProjectsTab({ projects, onViewProject }: ProjectsTabProps) {
  // Group projects by status
  const activeProjects = projects.filter(
    (p) => p.status === 'active' || p.status === 'in-progress'
  );
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const otherProjects = projects.filter(
    (p) =>
      p.status !== 'active' &&
      p.status !== 'in-progress' &&
      p.status !== 'completed'
  );

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <FolderKanban className="icon-xl tw-mb-3" />
        <p>No projects yet</p>
        <p className="">
          Projects associated with this client will appear here
        </p>
      </div>
    );
  }

  const renderProjectCard = (project: ClientProject) => {
    const progress = project.progress ?? 0;
    const statusConfig = PROJECT_STATUS_CONFIG[project.status as keyof typeof PROJECT_STATUS_CONFIG];

    return (
      <div
        key={project.id}
        className="tw-card tw-group"
      >
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
          <div className="tw-flex-1 tw-min-w-0">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
              <h4 className="tw-heading tw-truncate ">
                {project.project_name}
              </h4>
              <span className="tw-badge tw-text-xs">
                {statusConfig?.label || project.status}
              </span>
            </div>

            <div className="tw-flex tw-items-center tw-gap-2 tw-text-muted tw-text-sm">
              <Clock className="icon-xs" />
              <span>Created {formatDate(project.created_at)}</span>
            </div>
          </div>

          <button
            className="btn-ghost tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity"
            onClick={() => onViewProject?.(project.id)}
          >
            <ExternalLink className="icon-md" />
            View
          </button>
        </div>

        {/* Progress bar */}
        {(project.status === 'active' || project.status === 'in-progress') && (
          <div className="tw-mt-3">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
              <span className="tw-label">Progress</span>
              <span className="tw-text-muted tw-text-sm">
                {progress}%
              </span>
            </div>
            <div className="tw-progress-track">
              <div
                className="tw-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    projectList: ClientProject[],
    emptyMessage?: string
  ) => {
    if (projectList.length === 0 && !emptyMessage) return null;

    return (
      <div>
        <h3 className="tw-section-title ">
          {title} ({projectList.length})
        </h3>
        {projectList.length === 0 ? (
          <p className="tw-text-muted  tw-text-muted tw-italic">
            {emptyMessage}
          </p>
        ) : (
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            {projectList.map(renderProjectCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <h2 className="tw-heading tw-text-lg">
          Projects ({projects.length})
        </h2>

        {/* Summary stats */}
        <div className="tw-flex tw-items-center tw-gap-4">
          <div className="tw-text-center">
            <span className="tw-stat-value tw-text-lg">
              {activeProjects.length}
            </span>
            <span className="tw-text-muted tw-ml-1 tw-text-sm">Active</span>
          </div>
          <div className="tw-text-center">
            <span className="tw-stat-value tw-text-lg">
              {completedProjects.length}
            </span>
            <span className="tw-text-muted tw-ml-1 tw-text-sm">
              Completed
            </span>
          </div>
        </div>
      </div>

      {/* Project sections */}
      {renderSection('Active Projects', activeProjects, 'No active projects')}
      {renderSection('Completed', completedProjects)}
      {renderSection('Other', otherProjects)}
    </div>
  );
}
