/**
 * PortalDashboard
 * Client portal dashboard with stats overview and recent activity feed.
 * Fetches data from /api/clients/me/dashboard.
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  FolderKanban,
  Receipt,
  MessageSquare,
  FileText,
  FileSignature,
  File,
  Send,
  ClipboardList,
  Activity
} from 'lucide-react';
import { StatCard } from '@react/components/portal';
import { formatRelativeTime, IconButton } from '@react/factories';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { useSetProjects, useActiveProjectId } from '@react/stores/portal-store';
import { ProjectHeader, ProjectProgress } from './ProjectSnapshot';
import { ActionItems } from './ActionItems';
import type { ProjectInfo } from './ProjectSnapshot';
import type { ActionItemCounts } from './ActionItems';
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { KEYS } from '@/constants/keyboard';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Endpoint for client dashboard data */
const DASHBOARD_ENDPOINT = `${API_ENDPOINTS.CLIENTS_ME}/dashboard`;

/** Maps activity type to portal navigation tab */
const ACTIVITY_TYPE_TO_TAB: Record<string, string> = {
  project: 'projects',
  invoice: 'documents',
  message: 'messages',
  document: 'documents',
  contract: 'documents',
  file: 'files',
  request: 'files',
  questionnaire: 'files'
};

/** Maps activity type to Lucide icon component */
const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  invoice: Receipt,
  message: MessageSquare,
  document: FileText,
  contract: FileSignature,
  file: File,
  request: Send,
  questionnaire: ClipboardList
};

/** Navigation tab targets for stat cards */
const NAV_TAB_DOCUMENTS = 'documents';
const NAV_TAB_MESSAGES = 'messages';
const NAV_TAB_DELIVERABLES = 'deliverables';
const _NAV_TAB_FILES = 'files';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  activeProjects: number;
  pendingInvoices: number;
  unreadMessages: number;
  pendingDocRequests: number;
  pendingContracts: number;
  pendingQuestionnaires: number;
  pendingApprovals: number;
  outstandingBalance: number;
  deliverablesInReview: number;
}

interface ActivityItem {
  type: string;
  title: string;
  context: string;
  date: string;
  entityId?: string;
}

interface DashboardProject {
  id: number;
  name: string;
  status: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  previewUrl?: string;
}

interface CurrentDeliverable {
  id: number;
  title: string;
  status: string;
  type: string;
  projectId: number;
}

interface DashboardData {
  stats: DashboardStats;
  totalProjects: number;
  projects: DashboardProject[];
  currentDeliverable: CurrentDeliverable | null;
  recentActivity: ActivityItem[];
}

export interface PortalDashboardProps extends PortalViewProps {
  /** Callback for navigation events */
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the Lucide icon component for an activity type.
 */
function getActivityIcon(type: string): React.ComponentType<{ className?: string }> {
  return ACTIVITY_TYPE_ICONS[type] ?? Activity;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ActivityListProps {
  activities: ActivityItem[];
  onNavigate?: (tab: string, entityId?: string) => void;
}

const ActivityList = React.memo(({ activities, onNavigate }: ActivityListProps) => {
  if (activities.length === 0) {
    return (
      <EmptyState message="No recent activity" />
    );
  }

  return (
    <ul>
      {activities.map((item, index) => (
        <li
          key={`${item.type}-${item.entityId ?? 'none'}-${index}`}
          className="list-item"
          onClick={
            item.entityId && onNavigate
              ? () => onNavigate(ACTIVITY_TYPE_TO_TAB[item.type] ?? item.type, item.entityId)
              : undefined
          }
          role={item.entityId && onNavigate ? 'button' : undefined}
          tabIndex={item.entityId && onNavigate ? 0 : undefined}
          onKeyDown={
            item.entityId && onNavigate
              ? (e) => {
                if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                  e.preventDefault();
                  onNavigate(ACTIVITY_TYPE_TO_TAB[item.type] ?? item.type, item.entityId);
                }
              }
              : undefined
          }
        >
          <span className="activity-icon">
            {React.createElement(getActivityIcon(item.type), { className: 'icon-md' })}
          </span>
          <span className="activity-title">
            {item.title}
            {item.context && item.type !== 'message' && (
              <span className="activity-context"> — {item.context}</span>
            )}
          </span>
          <span className="activity-date">
            {formatRelativeTime(item.date)}
          </span>
        </li>
      ))}
    </ul>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PortalDashboard Component
 * Renders stats overview and recent activity feed for the client portal.
 */
export function PortalDashboard({
  getAuthToken,
  showNotification,
  onNavigate
}: PortalDashboardProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { data, isLoading, error, refetch } = usePortalData<DashboardData>({
    getAuthToken,
    url: DASHBOARD_ENDPOINT,
    transform: (raw) => raw as DashboardData
  });

  const setProjects = useSetProjects();
  const activeProjectId = useActiveProjectId();

  // Sync projects from dashboard API into the Zustand store
  useEffect(() => {
    if (data?.projects && data.projects.length > 0) {
      setProjects(data.projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status
      })));
    }
  }, [data?.projects, setProjects]);

  const stats = data?.stats ?? null;
  const recentActivity = data?.recentActivity ?? [];

  // Submit Request modal
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Get the active project info for the snapshot
  const activeProject: ProjectInfo | null = React.useMemo(() => {
    if (!data?.projects || data.projects.length === 0) return null;
    const match = activeProjectId
      ? data.projects.find((p) => p.id === activeProjectId)
      : data.projects[0];
    if (!match) return null;
    return {
      id: match.id,
      name: match.name,
      status: match.status,
      progress: match.progress,
      startDate: match.startDate,
      endDate: match.endDate,
      previewUrl: match.previewUrl
    };
  }, [data?.projects, activeProjectId]);

  // Action item counts
  const actionCounts: ActionItemCounts | null = React.useMemo(() => {
    if (!stats) return null;
    return {
      pendingContracts: stats.pendingContracts,
      pendingInvoices: stats.pendingInvoices,
      pendingApprovals: stats.pendingApprovals,
      pendingQuestionnaires: stats.pendingQuestionnaires,
      pendingDocRequests: stats.pendingDocRequests
    };
  }, [stats]);

  void showNotification;
  void showRequestForm;
  void setShowRequestForm;

  const handleStatClick = useCallback(
    (tab: string) => {
      onNavigate?.(tab);
    },
    [onNavigate]
  );

  return (
    <div ref={containerRef} className="section">
      {isLoading ? (
        <LoadingState message="Loading dashboard..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* 1. Project Header (no panel) */}
          {activeProject && (
            <ProjectHeader project={activeProject} />
          )}

          {/* 2. Project Progress Panel */}
          {activeProject && (
            <div className="panel">
              <ProjectProgress
                project={activeProject}
                currentDeliverable={data?.currentDeliverable ?? null}
              />
            </div>
          )}

          {/* Stats + Action Items — single row */}
          <div className="dashboard-stats-grid">
            <StatCard
              label="Outstanding Balance"
              value={stats?.outstandingBalance
                ? `$${(stats.outstandingBalance / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : '$0.00'
              }
              onClick={() => handleStatClick(NAV_TAB_DOCUMENTS)}
            />
            <StatCard
              label="Deliverables in Review"
              value={stats?.deliverablesInReview ?? 0}
              onClick={() => handleStatClick(NAV_TAB_DELIVERABLES)}
            />
            <StatCard
              label="Unread Messages"
              value={stats?.unreadMessages ?? 0}
              variant={stats?.unreadMessages ? 'alert' : 'default'}
              onClick={() => handleStatClick(NAV_TAB_MESSAGES)}
            />
            {actionCounts && (
              <ActionItems counts={actionCounts} onNavigate={onNavigate} />
            )}
          </div>

          {/* Submit Request + Recent Activity */}
          <div className="table-layout">
            <div className="data-table-card">
              <div className="data-table-header">
                <h3>
                  <span className="title-full">RECENT ACTIVITY</span>
                </h3>
                <div className="data-table-actions">
                  <IconButton action="refresh" onClick={refetch} title="Refresh" />
                </div>
              </div>
              <div className="data-table-container">
                <ActivityList activities={recentActivity} onNavigate={onNavigate} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
