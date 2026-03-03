/**
 * PortalProjectDetail
 * Client portal project detail view with milestones and updates timeline
 */

import * as React from 'react';
import {
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Flag,
  FileText,
  ListTodo,
  Activity,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { IconButton, TabList, TabPanel } from '@react/factories';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import type {
  PortalProject,
  PortalProjectStatus,
  PortalProjectMilestone,
  PortalProjectUpdate,
} from '../types';
import { createLogger } from '../../../../utils/logger';
import { buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalProjectDetail');

interface PortalProjectDetailProps {
  /** Project ID to display */
  projectId: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to projects list */
  onBack?: () => void;
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
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateString);
}

/**
 * Get update type icon
 */
function getUpdateIcon(type: PortalProjectUpdate['update_type']) {
  switch (type) {
    case 'milestone':
      return <Flag />;
    case 'status':
      return <CheckCircle2 />;
    case 'deliverable':
      return <FileText />;
    default:
      return <MessageSquare />;
  }
}

// Tab configuration
type PortalProjectTab = 'milestones' | 'updates';

const TABS: Array<{ id: PortalProjectTab; label: string }> = [
  { id: 'milestones', label: 'Milestones' },
  { id: 'updates', label: 'Updates' },
];

/**
 * PortalProjectDetail Component
 */
export function PortalProjectDetail({
  projectId,
  getAuthToken,
  onBack,
  showNotification,
}: PortalProjectDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const milestonesRef = useStaggerChildren<HTMLDivElement>(0.06, 0.15);
  const updatesRef = useStaggerChildren<HTMLDivElement>(0.06, 0.2);

  const [project, setProject] = React.useState<PortalProject | null>(null);
  const [milestones, setMilestones] = React.useState<PortalProjectMilestone[]>([]);
  const [updates, setUpdates] = React.useState<PortalProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<PortalProjectTab>('milestones');

  // Build headers helper
  const getHeaders = React.useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  // Fetch project details
  const fetchProjectDetails = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch project
      const projectResponse = await fetch(buildEndpoint.project(projectId), {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!projectResponse.ok) {
        throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
      }

      const projectData = await projectResponse.json();

      // Handle various response formats
      let projectResult: PortalProject;
      if (projectData.project) {
        projectResult = projectData.project;
      } else if (projectData.success && projectData.data?.project) {
        projectResult = projectData.data.project;
      } else if (projectData.success && projectData.data) {
        projectResult = projectData.data;
      } else {
        throw new Error(projectData.error || 'Failed to load project');
      }

      setProject(projectResult);

      // Fetch milestones
      try {
        const milestonesResponse = await fetch(buildEndpoint.projectMilestones(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include',
        });

        if (milestonesResponse.ok) {
          const milestonesData = await milestonesResponse.json();
          const milestonesArray = milestonesData.milestones
            || milestonesData.data?.milestones
            || (Array.isArray(milestonesData) ? milestonesData : []);
          setMilestones(milestonesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch milestones:', err);
      }

      // Fetch updates/activity
      try {
        const updatesResponse = await fetch(buildEndpoint.projectUpdates(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include',
        });

        if (updatesResponse.ok) {
          const updatesData = await updatesResponse.json();
          const updatesArray = updatesData.updates
            || updatesData.data?.updates
            || (Array.isArray(updatesData) ? updatesData : []);
          setUpdates(updatesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch updates:', err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[PortalProjectDetail] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, getHeaders]);

  // Fetch on mount and when projectId changes
  React.useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId, fetchProjectDetails]);

  // Handle preview click
  const handlePreviewClick = () => {
    if (project?.preview_url) {
      window.open(project.preview_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <span className="loading-spinner" />
        <span>Loading project...</span>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="error-state">
        <p>{error || 'Project not found'}</p>
        <div className="tw-flex tw-gap-2">
          {onBack && (
            <button className="btn-secondary" onClick={onBack}>
              Go Back
            </button>
          )}
          <button className="btn-secondary" onClick={fetchProjectDetails}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = PORTAL_PROJECT_STATUS_CONFIG[project.status as PortalProjectStatus];
  const statusLabel = statusConfig?.label || project.status;
  const completedMilestones = milestones.filter(m => m.is_completed).length;
  const progress = milestones.length > 0
    ? Math.round((completedMilestones / milestones.length) * 100)
    : project.progress;

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-flex tw-items-center tw-gap-3">
          {/* Back Button */}
          {onBack && (
            <IconButton action="back" onClick={onBack} title="Back to projects" />
          )}

          {/* Project Info */}
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <div className="tw-flex tw-items-center tw-gap-2">
              <h2 className="tw-heading tw-text-lg tw-m-0">{project.name}</h2>
              <span className="tw-badge">{statusLabel}</span>
            </div>
            {project.description && (
              <p className="tw-text-muted tw-text-sm tw-m-0">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {project.preview_url && (
          <button className="btn-secondary" onClick={handlePreviewClick}>
            <ExternalLink className="tw-h-4 tw-w-4" />
            Preview
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div className="tw-panel">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
          <span className="tw-label">Overall Progress</span>
          <span className="tw-text-primary">{progress}%</span>
        </div>
        <div className="tw-progress-track">
          <div
            className="tw-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="tw-flex tw-items-center tw-justify-between tw-mt-2">
          <span className="tw-text-muted tw-text-xs">
            {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
          </span>
          {milestones.length > 0 && (
            <span className="tw-text-muted tw-text-xs">
              {completedMilestones}/{milestones.length} milestones
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <TabList
        tabs={TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ariaLabel="Project detail tabs"
      />

      {/* Tab Content */}
      <TabPanel tabId="milestones" isActive={activeTab === 'milestones'}>
        <MilestonesList
          milestones={milestones}
          containerRef={milestonesRef}
        />
      </TabPanel>

      <TabPanel tabId="updates" isActive={activeTab === 'updates'}>
        <UpdatesTimeline
          updates={updates}
          containerRef={updatesRef}
        />
      </TabPanel>
    </div>
  );
}

/**
 * MilestonesList Component
 */
interface MilestonesListProps {
  milestones: PortalProjectMilestone[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function MilestonesList({ milestones, containerRef }: MilestonesListProps) {
  if (milestones.length === 0) {
    return (
      <div className="empty-state">
        <ListTodo className="tw-h-6 tw-w-6" />
        <span>No milestones defined yet</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-flex tw-flex-col tw-gap-3">
      {milestones.map((milestone) => (
        <div key={milestone.id} className="tw-card">
          <div className="tw-flex tw-gap-3">
            {/* Status Icon */}
            <div className="tw-flex-shrink-0">
              {milestone.is_completed ? (
                <CheckCircle2 className="tw-h-4 tw-w-4 tw-text-[var(--status-completed)]" />
              ) : (
                <Circle className="tw-h-4 tw-w-4" />
              )}
            </div>

            {/* Content */}
            <div className="tw-flex-1">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span
                  className={cn(
                    milestone.is_completed ? 'tw-text-muted tw-line-through' : 'tw-text-primary'
                  )}
                >
                  {milestone.title}
                </span>
                {milestone.due_date && (
                  <div className="tw-flex tw-items-center tw-gap-1 tw-text-muted">
                    <Clock className="tw-h-3 tw-w-3" />
                    <span className="tw-text-xs">{formatDate(milestone.due_date)}</span>
                  </div>
                )}
              </div>
              {milestone.description && (
                <p className="tw-text-muted tw-text-sm tw-m-0 tw-mt-1">
                  {milestone.description}
                </p>
              )}
              {milestone.is_completed && milestone.completed_date && (
                <span className="tw-text-xs tw-text-muted">
                  Completed {formatDate(milestone.completed_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * UpdatesTimeline Component
 */
interface UpdatesTimelineProps {
  updates: PortalProjectUpdate[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function UpdatesTimeline({ updates, containerRef }: UpdatesTimelineProps) {
  if (updates.length === 0) {
    return (
      <div className="empty-state">
        <Activity className="tw-h-6 tw-w-6" />
        <span>No updates yet</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-relative">
      {/* Timeline line */}
      <div className="tw-absolute tw-left-2 tw-top-0 tw-bottom-0 tw-w-px tw-bg-[var(--portal-border)]" />

      {/* Updates */}
      <div className="tw-flex tw-flex-col tw-gap-3">
        {updates.map((update) => (
          <div key={update.id} className="tw-flex tw-gap-3 tw-relative">
            {/* Timeline dot */}
            <div className="tw-flex-shrink-0 tw-w-4 tw-h-4 tw-flex tw-items-center tw-justify-center tw-bg-[var(--portal-bg)] tw-z-10">
              <span className="tw-text-muted">{getUpdateIcon(update.update_type)}</span>
            </div>

            {/* Content */}
            <div className="tw-card tw-flex-1">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span className="tw-text-primary">{update.title}</span>
                <span className="tw-text-muted tw-text-xs">{formatRelativeTime(update.created_at)}</span>
              </div>
              <p className="tw-text-muted tw-text-sm tw-m-0 tw-mt-1">{update.content}</p>
              {update.created_by && (
                <span className="tw-text-xs tw-text-muted">
                  by {update.created_by}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
