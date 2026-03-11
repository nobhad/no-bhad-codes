/**
 * ProjectSnapshot
 * Displays the active project header with name, status, progress, timeline.
 */

import * as React from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { formatCardDate } from '@react/utils/cardFormatters';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectInfo {
  id: number;
  name: string;
  status: string;
  progress?: number;
  startDate?: string;
  endDate?: string;
  previewUrl?: string;
}

interface ProjectSnapshotProps {
  project: ProjectInfo;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROGRESS_MAX = 100;

const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  completed: 'Completed',
  'on-hold': 'On Hold',
  cancelled: 'Cancelled'
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ProjectSnapshot = React.memo(({ project }: ProjectSnapshotProps) => {
  const progressPercent = Math.min(project.progress ?? 0, PROGRESS_MAX);
  const statusLabel = PROJECT_STATUS_LABELS[project.status] ?? project.status;

  return (
    <div className="project-snapshot">
      <div className="project-snapshot-header">
        <div className="project-snapshot-title">
          <h2>{project.name}</h2>
          <StatusBadge status={getStatusVariant(project.status)}>
            {statusLabel}
          </StatusBadge>
        </div>

        {project.previewUrl && (
          <a
            href={project.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-sm"
            aria-label="View preview site"
          >
            <ExternalLink className="icon-xs" />
            Preview Site
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="project-snapshot-progress">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={PROGRESS_MAX}
            aria-label={`Project progress: ${progressPercent}%`}
          />
        </div>
        <span className="progress-bar-label">{progressPercent}%</span>
      </div>

      {/* Timeline */}
      {(project.startDate || project.endDate) && (
        <div className="project-snapshot-timeline">
          <Calendar className="icon-xs" />
          <span>
            {project.startDate ? formatCardDate(project.startDate) : 'TBD'}
            {' \u2192 '}
            {project.endDate ? formatCardDate(project.endDate) : 'TBD'}
          </span>
        </div>
      )}
    </div>
  );
});
