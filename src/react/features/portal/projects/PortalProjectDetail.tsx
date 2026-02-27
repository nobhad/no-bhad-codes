/**
 * PortalProjectDetail
 * Client portal project detail view with milestones and updates timeline
 */

import * as React from 'react';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Flag,
  FileText,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import type {
  PortalProject,
  PortalProjectStatus,
  PortalProjectMilestone,
  PortalProjectUpdate,
} from '../types';

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
  const iconClass = 'tw-h-3.5 tw-w-3.5';
  switch (type) {
    case 'milestone':
      return <Flag className={iconClass} />;
    case 'status':
      return <CheckCircle2 className={iconClass} />;
    case 'deliverable':
      return <FileText className={iconClass} />;
    default:
      return <MessageSquare className={iconClass} />;
  }
}

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
  const [activeTab, setActiveTab] = React.useState<'milestones' | 'updates'>('milestones');

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
      const projectResponse = await fetch(`/api/projects/${projectId}`, {
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
        const milestonesResponse = await fetch(`/api/projects/${projectId}/milestones`, {
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
        console.warn('[PortalProjectDetail] Could not fetch milestones:', err);
      }

      // Fetch updates/activity
      try {
        const updatesResponse = await fetch(`/api/projects/${projectId}/updates`, {
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
        console.warn('[PortalProjectDetail] Could not fetch updates:', err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[PortalProjectDetail] Error:', message);
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
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading project...</span>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error || 'Project not found'}</div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {onBack && (
            <button className="tw-btn-secondary" onClick={onBack}>
              Go Back
            </button>
          )}
          <button className="tw-btn-secondary" onClick={fetchProjectDetails}>
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        {onBack && (
          <button className="tw-btn-icon" onClick={onBack} title="Back to projects">
            <ArrowLeft className="tw-h-4 tw-w-4" />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 className="tw-heading" style={{ fontSize: '16px' }}>{project.name}</h2>
            <span className="tw-badge">{statusLabel}</span>
          </div>
          {project.description && (
            <p className="tw-text-muted" style={{ fontSize: '12px', marginTop: '0.25rem' }}>
              {project.description}
            </p>
          )}
        </div>
        {project.preview_url && (
          <button className="tw-btn-secondary" onClick={handlePreviewClick}>
            <ExternalLink className="tw-h-4 tw-w-4" />
            Preview
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div className="tw-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span className="tw-label">Overall Progress</span>
          <span className="tw-text-primary" style={{ fontSize: '14px' }}>{progress}%</span>
        </div>
        <div className="tw-progress-track" style={{ height: '6px' }}>
          <div
            className="tw-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span className="tw-text-muted" style={{ fontSize: '11px' }}>
            {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
          </span>
          {milestones.length > 0 && (
            <span className="tw-text-muted" style={{ fontSize: '11px' }}>
              {completedMilestones}/{milestones.length} milestones
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tw-tab-list">
        <button
          onClick={() => setActiveTab('milestones')}
          className={activeTab === 'milestones' ? 'tw-tab-active' : 'tw-tab'}
        >
          Milestones ({milestones.length})
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={activeTab === 'updates' ? 'tw-tab-active' : 'tw-tab'}
        >
          Updates ({updates.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'milestones' ? (
        <MilestonesList
          milestones={milestones}
          containerRef={milestonesRef}
        />
      ) : (
        <UpdatesTimeline
          updates={updates}
          containerRef={updatesRef}
        />
      )}
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
      <div className="tw-empty-state">No milestones defined yet.</div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {milestones.map((milestone) => (
        <div key={milestone.id} className="tw-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            {/* Status Icon */}
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              {milestone.is_completed ? (
                <CheckCircle2 className="tw-h-4 tw-w-4" style={{ color: 'var(--portal-text-light)' }} />
              ) : (
                <Circle className="tw-h-4 tw-w-4 tw-text-muted" />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span
                  className={milestone.is_completed ? 'tw-text-muted' : 'tw-text-primary'}
                  style={{
                    fontSize: '14px',
                    textDecoration: milestone.is_completed ? 'line-through' : 'none'
                  }}
                >
                  {milestone.title}
                </span>
                {milestone.due_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="tw-text-muted">
                    <Clock className="tw-h-3 tw-w-3" />
                    <span style={{ fontSize: '11px' }}>{formatDate(milestone.due_date)}</span>
                  </div>
                )}
              </div>
              {milestone.description && (
                <p className="tw-text-muted" style={{ fontSize: '12px', marginTop: '0.25rem' }}>
                  {milestone.description}
                </p>
              )}
              {milestone.is_completed && milestone.completed_date && (
                <span style={{ fontSize: '11px', marginTop: '0.25rem', display: 'block', color: 'var(--portal-text-light)' }}>
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
      <div className="tw-empty-state">No updates yet.</div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: '11px',
        top: '1rem',
        bottom: '1rem',
        width: '1px',
        background: 'var(--portal-border-color)'
      }} />

      {/* Updates */}
      <div className="tw-section">
        {updates.map((update) => (
          <div key={update.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            {/* Timeline dot */}
            <div style={{
              flexShrink: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--portal-border-color)',
              zIndex: 10
            }}>
              <span className="tw-text-muted">{getUpdateIcon(update.update_type)}</span>
            </div>

            {/* Content */}
            <div className="tw-card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className="tw-text-primary" style={{ fontSize: '14px' }}>{update.title}</span>
                <span className="tw-text-muted" style={{ fontSize: '11px' }}>{formatRelativeTime(update.created_at)}</span>
              </div>
              <p className="tw-text-muted" style={{ fontSize: '12px' }}>{update.content}</p>
              {update.created_by && (
                <span className="tw-text-muted" style={{ fontSize: '11px', marginTop: '0.5rem', display: 'block' }}>
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
