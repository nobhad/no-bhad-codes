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
import { EmptyState } from '@react/components/portal/EmptyState';
import { formatTimeAgo, MS_PER_DAY } from '@/utils/time-utils';
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
 * Get CSS variable for activity type color
 */
function getActivityColorVar(type: string): string {
  const colorMap: Record<string, string> = {
    email: 'var(--activity-email-color)',
    invoice: 'var(--activity-invoice-color)',
    project: 'var(--activity-project-color)',
    file: 'var(--activity-file-color)',
    message: 'var(--activity-message-color)',
    contact: 'var(--activity-contact-color)',
    status: 'var(--activity-status-color)',
    completed: 'var(--status-completed)',
    alert: 'var(--status-cancelled)'
  };

  return colorMap[type] || 'var(--color-text-tertiary)';
}

/**
 * Format relative time using shared utility
 */
function formatRelativeTime(dateString: string): string {
  return formatTimeAgo(dateString);
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
    const date = new Date(activity.createdAt);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(activity);
  });

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - MS_PER_DAY).toISOString().split('T')[0];

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
      <EmptyState
        icon={<Clock className="icon-lg" />}
        message="No activity yet. Activity will appear here as you interact with this client."
      />
    );
  }

  return (
    <div className="section">
      {/* Header */}
      <div className="layout-row-between">
        <h2 className="heading text-lg">
          Activity Log
        </h2>
        <span className="text-muted ">
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Timeline */}
      <div className="detail-list--section">
        {groupedActivities.map((group) => (
          <div key={group.date}>
            {/* Date Header */}
            <div className="activity-date-header">
              <span className="heading">
                {group.label}
              </span>
              <div className="activity-date-divider activity-divider-line" />
            </div>

            {/* Activities for this date */}
            <div className="activity-timeline-wrapper">
              {/* Timeline line */}
              <div className="activity-timeline-vert activity-timeline-line" />

              <div className="detail-list--spaced">
                {group.items.map((activity, index) => {
                  const Icon = getActivityIcon(activity.activityType);
                  const iconColorVar = getActivityColorVar(activity.activityType);
                  const isLast = index === group.items.length - 1;

                  return (
                    <div key={activity.id} className="activity-event-row">
                      {/* Timeline dot */}
                      <div className="activity-dot activity-timeline-dot">
                        <Icon className="icon-sm" data-activity-type={activity.activityType} style={{ color: iconColorVar }} />
                      </div>

                      {/* Activity content */}
                      <div
                        className={cn(
                          'activity-event-content panel',
                          !isLast && 'item-spacing-bottom'
                        )}
                      >
                        <div className="activity-event-header">
                          <div className="activity-event-body">
                            <h4 className="heading">
                              {activity.title}
                            </h4>
                            {activity.description && (
                              <p className="text-muted text-sm description-text">
                                {activity.description}
                              </p>
                            )}
                          </div>

                          <span
                            className="text-muted whitespace-nowrap text-sm"
                            title={formatFullDate(activity.createdAt)}
                          >
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                        </div>

                        {/* Activity metadata */}
                        {(activity.createdBy || activity.metadata) && (
                          <div className="activity-metadata activity-border-top">
                            {activity.createdBy && (
                              <span className="text-muted text-sm">
                                by {activity.createdBy}
                              </span>
                            )}
                            {activity.metadata &&
                              Object.entries(activity.metadata).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="text-muted text-sm"
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
