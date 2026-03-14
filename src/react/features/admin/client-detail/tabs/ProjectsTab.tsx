import * as React from 'react';
import { FolderKanban, Clock } from 'lucide-react';
import { EmptyState } from '@react/components/portal/EmptyState';
import { ProgressBar } from '@react/components/portal';
import type { ClientProject } from '../../types';
import { PROJECT_STATUS_CONFIG } from '../../types';
import { formatDate } from '@/utils/format-utils';

interface ProjectsTabProps {
  projects: ClientProject[];
  onViewProject?: (projectId: number) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

/**
 * ProjectsTab
 * Shows client's projects
 */
export function ProjectsTab({ projects, onViewProject, onNavigate }: ProjectsTabProps) {
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
      <EmptyState
        icon={<FolderKanban className="icon-lg" />}
        message="No projects yet. Projects associated with this client will appear here."
      />
    );
  }

  const handleCardClick = (project: ClientProject) => {
    if (onNavigate) {
      onNavigate('project-detail', String(project.id));
    } else {
      onViewProject?.(project.id);
    }
  };

  const renderProjectCard = (project: ClientProject) => {
    const progress = project.progress ?? 0;
    const statusConfig = PROJECT_STATUS_CONFIG[project.status as keyof typeof PROJECT_STATUS_CONFIG];

    return (
      <div
        key={project.id}
        className="portal-card clickable"
        onClick={() => handleCardClick(project)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(project); }}
      >
        <div className="project-card-header">
          <div className="project-card-info">
            <div className="project-title-row">
              <h4 className="heading truncate">
                {project.project_name}
              </h4>
              <span className="badge">
                {statusConfig?.label || project.status}
              </span>
            </div>

            <div className="project-date-row text-muted text-sm">
              <Clock className="icon-xs" />
              <span>Created {formatDate(project.created_at, 'label')}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {(project.status === 'active' || project.status === 'in-progress') && (
          <ProgressBar value={progress} />
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
        <div className="data-table-header">
          <h3><span className="title-full">{title} ({projectList.length})</span></h3>
        </div>
        {projectList.length === 0 ? (
          <p className="text-muted empty-text-italic">
            {emptyMessage}
          </p>
        ) : (
          <div className="grid-2col gap-3">
            {projectList.map(renderProjectCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="subsection">
      <div className="panel">
        <div className="data-table-header">
          <h3><span className="title-full">Projects ({projects.length})</span></h3>
          <div className="summary-stats-inline">
            <div className="stat-inline">
              <span className="stat-value text-lg">
                {activeProjects.length}
              </span>
              <span className="text-muted text-sm stat-inline-label">Active</span>
            </div>
            <div className="stat-inline">
              <span className="stat-value text-lg">
                {completedProjects.length}
              </span>
              <span className="text-muted text-sm stat-inline-label">
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
    </div>
  );
}
