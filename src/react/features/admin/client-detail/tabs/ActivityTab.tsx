import * as React from 'react';
import {
  Clock,
  Mail,
  FileText,
  DollarSign,
  FolderKanban,
  MessageSquare,
  UserPlus,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { ClientActivity } from '../../types';

interface ActivityTabProps {
  activities: ClientActivity[];
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type: string): React.ElementType {
  const iconMap: Record<string, React.ElementType> = {
    email: Mail,
    invoice: DollarSign,
    project: FolderKanban,
    file: FileText,
    message: MessageSquare,
    contact: UserPlus,
    status: Settings,
    completed: CheckCircle,
    alert: AlertCircle
  };

  return iconMap[type] || Clock;
}

/**
 * Get color for activity type
 */
function getActivityColor(type: string): string {
  const colorMap: Record<string, string> = {
    email: 'tw-text-blue-400',
    invoice: 'tw-text-green-400',
    project: 'tw-text-purple-400',
    file: 'tw-text-orange-400',
    message: 'tw-text-cyan-400',
    contact: 'tw-text-pink-400',
    status: 'tw-text-yellow-400',
    completed: 'tw-text-[var(--status-completed)]',
    alert: 'tw-text-[var(--status-cancelled)]'
  };

  return colorMap[type] || 'tw-text-[var(--portal-text-muted)]';
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Format full date for tooltip
 */
function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Group activities by date
 */
function groupActivitiesByDate(
  activities: ClientActivity[]
): Array<{ date: string; label: string; items: ClientActivity[] }> {
  const groups: Map<string, ClientActivity[]> = new Map();

  activities.forEach((activity) => {
    const date = new Date(activity.created_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(activity);
  });

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => {
      let label: string;
      if (dateKey === today) {
        label = 'Today';
      } else if (dateKey === yesterday) {
        label = 'Yesterday';
      } else {
        label = new Date(dateKey).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      }

      return { date: dateKey, label, items };
    });
}

/**
 * ActivityTab
 * Shows client activity timeline
 */
export function ActivityTab({ activities }: ActivityTabProps) {
  const groupedActivities = groupActivitiesByDate(activities);

  if (activities.length === 0) {
    return (
      <div className="tw-empty-state">
        <Clock className="tw-h-12 tw-w-12 tw-mb-3" />
        <p>No activity yet</p>
        <p style={{ fontSize: '14px' }}>
          Activity will appear here as you interact with this client
        </p>
      </div>
    );
  }

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <h2 className="tw-heading" style={{ fontSize: '18px' }}>
          Activity Log
        </h2>
        <span className="tw-text-muted" style={{ fontSize: '14px' }}>
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Timeline */}
      <div className="tw-flex tw-flex-col tw-gap-6">
        {groupedActivities.map((group) => (
          <div key={group.date}>
            {/* Date Header */}
            <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
              <span className="tw-heading" style={{ fontSize: '14px' }}>
                {group.label}
              </span>
              <div className="tw-flex-1 tw-h-px" style={{ backgroundColor: 'var(--portal-border-color)' }} />
            </div>

            {/* Activities for this date */}
            <div className="tw-relative tw-pl-8">
              {/* Timeline line */}
              <div className="tw-absolute tw-left-3 tw-top-0 tw-bottom-0 tw-w-px" style={{ backgroundColor: 'var(--portal-border-color)' }} />

              <div className="tw-flex tw-flex-col tw-gap-4">
                {group.items.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type);
                  const iconColor = getActivityColor(activity.type);
                  const isLast = index === group.items.length - 1;

                  return (
                    <div key={activity.id} className="tw-relative tw-flex tw-gap-4">
                      {/* Timeline dot */}
                      <div
                        className="tw-absolute tw--left-5 tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-border tw-border-[var(--portal-border-color)]"
                        style={{ backgroundColor: 'transparent', borderRadius: 0 }}
                      >
                        <Icon className={cn('tw-h-3.5 tw-w-3.5', iconColor)} />
                      </div>

                      {/* Activity content */}
                      <div
                        className={cn(
                          'tw-flex-1 tw-panel',
                          !isLast && 'tw-mb-2'
                        )}
                      >
                        <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
                          <div className="tw-flex-1">
                            <h4 className="tw-heading" style={{ fontSize: '14px' }}>
                              {activity.title}
                            </h4>
                            {activity.description && (
                              <p className="tw-text-muted tw-mt-1" style={{ fontSize: '12px' }}>
                                {activity.description}
                              </p>
                            )}
                          </div>

                          <span
                            className="tw-text-muted tw-whitespace-nowrap"
                            style={{ fontSize: '12px' }}
                            title={formatFullDate(activity.created_at)}
                          >
                            {formatRelativeTime(activity.created_at)}
                          </span>
                        </div>

                        {/* Activity metadata */}
                        {(activity.created_by || activity.metadata) && (
                          <div className="tw-flex tw-items-center tw-gap-3 tw-mt-2 tw-pt-2" style={{ borderTop: '1px solid var(--portal-border-subtle)' }}>
                            {activity.created_by && (
                              <span className="tw-text-muted" style={{ fontSize: '12px' }}>
                                by {activity.created_by}
                              </span>
                            )}
                            {activity.metadata &&
                              Object.entries(activity.metadata).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="tw-text-muted"
                                  style={{ fontSize: '12px' }}
                                >
                                  {key}: {String(value)}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
