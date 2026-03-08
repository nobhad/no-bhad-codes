/**
 * PortalDashboard
 * Client portal dashboard with stats overview and recent activity feed.
 * Fetches data from /api/clients/me/dashboard.
 */

import * as React from 'react';
import { useCallback } from 'react';
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
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { KEYS } from '@/constants/keyboard';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Endpoint for client dashboard data */
const DASHBOARD_ENDPOINT = `${API_ENDPOINTS.CLIENTS_ME}/dashboard`;

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
const NAV_TAB_PROJECTS = 'projects';
const NAV_TAB_INVOICES = 'invoices';
const NAV_TAB_MESSAGES = 'messages';
const NAV_TAB_CONTRACTS = 'contracts';
const NAV_TAB_DOC_REQUESTS = 'files';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  activeProjects: number;
  pendingInvoices: number;
  unreadMessages: number;
  pendingDocRequests: number;
  pendingContracts: number;
}

interface ActivityItem {
  type: string;
  title: string;
  context: string;
  date: string;
  entityId?: string;
}

interface DashboardData {
  stats: DashboardStats;
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
          key={`${item.type}-${item.entityId ?? index}`}
          className="list-item activity-item"
          onClick={
            item.entityId && onNavigate
              ? () => onNavigate(item.type, item.entityId)
              : undefined
          }
          role={item.entityId && onNavigate ? 'button' : undefined}
          tabIndex={item.entityId && onNavigate ? 0 : undefined}
          onKeyDown={
            item.entityId && onNavigate
              ? (e) => {
                if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                  e.preventDefault();
                  onNavigate(item.type, item.entityId);
                }
              }
              : undefined
          }
        >
          <span className="activity-icon">
            {React.createElement(getActivityIcon(item.type), { className: 'icon-md' })}
          </span>
          <div className="activity-content">
            <span className="activity-title">{item.title}</span>
            <span className="activity-client">{item.context}</span>
          </div>
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

  const stats = data?.stats ?? null;
  const recentActivity = data?.recentActivity ?? [];

  // Suppress unused variable warning — showNotification is passed via BaseMountOptions
  // and may be used by child components in future iterations
  void showNotification;

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
          {/* Stats Overview - clickable navigation shortcuts */}
          <div className="dashboard-stats-grid">
            <StatCard
              label="Active Projects"
              value={stats?.activeProjects ?? 0}
              onClick={() => handleStatClick(NAV_TAB_PROJECTS)}
            />
            <StatCard
              label="Pending Invoices"
              value={stats?.pendingInvoices ?? 0}
              variant={stats?.pendingInvoices ? 'warning' : 'default'}
              onClick={() => handleStatClick(NAV_TAB_INVOICES)}
            />
            <StatCard
              label="Unread Messages"
              value={stats?.unreadMessages ?? 0}
              variant={stats?.unreadMessages ? 'alert' : 'default'}
              onClick={() => handleStatClick(NAV_TAB_MESSAGES)}
            />
            {(stats?.pendingContracts ?? 0) > 0 && (
              <StatCard
                label="Pending Contracts"
                value={stats?.pendingContracts ?? 0}
                variant="warning"
                onClick={() => handleStatClick(NAV_TAB_CONTRACTS)}
              />
            )}
            {(stats?.pendingDocRequests ?? 0) > 0 && (
              <StatCard
                label="Document Requests"
                value={stats?.pendingDocRequests ?? 0}
                variant="warning"
                onClick={() => handleStatClick(NAV_TAB_DOC_REQUESTS)}
              />
            )}
          </div>

          {/* Recent Activity */}
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
