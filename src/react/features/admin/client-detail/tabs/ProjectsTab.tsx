import * as React from 'react';
import { FolderKanban, ExternalLink, Clock } from 'lucide-react';
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
        className="portal-card tw-group"
      >
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
          <div className="tw-flex-1 tw-min-w-0">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
              <h4 className="heading tw-truncate ">
                {project.project_name}
              </h4>
              <span className="tw-badge tw-text-xs">
                {statusConfig?.label || project.status}
              </span>
            </div>

            <div className="tw-flex tw-items-center tw-gap-2 text-muted tw-text-sm">
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
              <span className="label">Progress</span>
              <span className="text-muted tw-text-sm">
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
        <h3 className="section-title ">
          {title} ({projectList.length})
        </h3>
        {projectList.length === 0 ? (
          <p className="text-muted  text-muted tw-italic">
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
        <h2 className="heading tw-text-lg">
          Projects ({projects.length})
        </h2>

        {/* Summary stats */}
        <div className="tw-flex tw-items-center tw-gap-4">
          <div className="tw-text-center">
            <span className="stat-value tw-text-lg">
              {activeProjects.length}
            </span>
            <span className="text-muted tw-ml-1 tw-text-sm">Active</span>
          </div>
          <div className="tw-text-center">
            <span className="stat-value tw-text-lg">
              {completedProjects.length}
            </span>
            <span className="text-muted tw-ml-1 tw-text-sm">
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
