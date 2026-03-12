/**
 * ProjectSnapshot
 * Split into two parts:
 * - ProjectHeader: project name, status badge, preview link (no panel wrapper)
 * - ProjectProgress: progress bar, timeline, current deliverable (for panel wrapping)
 */

import * as React from 'react';
import { Calendar, ExternalLink, Target } from 'lucide-react';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { ProgressBar } from '@react/components/portal';
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

export interface CurrentDeliverableInfo {
  id: number;
  title: string;
  status: string;
  type: string;
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

const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  in_review: 'In Review'
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ProjectHeaderProps {
  project: ProjectInfo;
}

/** Page-level project context: name + status + preview link. No panel wrapper. */
export const ProjectHeader = React.memo(({ project }: ProjectHeaderProps) => {
  const statusLabel = PROJECT_STATUS_LABELS[project.status] ?? project.status;

  return (
    <div className="project-snapshot-header">
      <div className="project-snapshot-header-left">
        <div className="project-snapshot-title">
          <h2>{project.name}</h2>
          <StatusBadge status={getStatusVariant(project.status)}>
            {statusLabel}
          </StatusBadge>
        </div>

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
  );
});

interface ProjectProgressProps {
  project: ProjectInfo;
  currentDeliverable?: CurrentDeliverableInfo | null;
}

/** Progress bar, timeline, current deliverable. Intended to be wrapped in .panel. */
export const ProjectProgress = React.memo(({ project, currentDeliverable }: ProjectProgressProps) => {
  const progressPercent = Math.min(project.progress ?? 0, PROGRESS_MAX);

  return (
    <>
      {/* Progress bar */}
      <ProgressBar value={progressPercent} />


      {/* Current Deliverable/Milestone */}
      {currentDeliverable && (
        <div className="project-snapshot-milestone">
          <Target className="icon-xs" />
          <span>
            Current: {currentDeliverable.title}
            {' \u2014 '}
            <StatusBadge status={getStatusVariant(currentDeliverable.status)}>
              {DELIVERABLE_STATUS_LABELS[currentDeliverable.status] ?? currentDeliverable.status}
            </StatusBadge>
          </span>
        </div>
      )}
    </>
  );
});
