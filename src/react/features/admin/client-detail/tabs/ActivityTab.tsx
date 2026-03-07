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
import { formatTimeAgo } from '../../../../../utils/time-utils';
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
    email: 'tw-text-[var(--activity-email-color)]',
    invoice: 'tw-text-[var(--activity-invoice-color)]',
    project: 'tw-text-[var(--activity-project-color)]',
    file: 'tw-text-[var(--activity-file-color)]',
    message: 'tw-text-[var(--activity-message-color)]',
    contact: 'tw-text-[var(--activity-contact-color)]',
    status: 'tw-text-[var(--activity-status-color)]',
    completed: 'tw-text-[var(--status-completed)]',
    alert: 'tw-text-[var(--status-cancelled)]'
  };

  return colorMap[type] || 'tw-text-[var(--portal-text-muted)]';
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
      <div className="empty-state">
        <Clock className="icon-xl" />
        <span>No activity yet</span>
        <span className="tw-text-sm">Activity will appear here as you interact with this client</span>
      </div>
    );
  }

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <h2 className="heading tw-text-lg">
          Activity Log
        </h2>
        <span className="text-muted ">
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Timeline */}
      <div className="tw-flex tw-flex-col tw-gap-6">
        {groupedActivities.map((group) => (
          <div key={group.date}>
            {/* Date Header */}
            <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
              <span className="heading ">
                {group.label}
              </span>
              <div className="tw-flex-1 tw-h-px activity-divider-line" />
            </div>

            {/* Activities for this date */}
            <div className="tw-relative tw-pl-8">
              {/* Timeline line */}
              <div className="tw-absolute tw-left-3 tw-top-0 tw-bottom-0 tw-w-px activity-timeline-line" />

              <div className="tw-flex tw-flex-col tw-gap-4">
                {group.items.map((activity, index) => {
                  const Icon = getActivityIcon(activity.activityType);
                  const iconColor = getActivityColor(activity.activityType);
                  const isLast = index === group.items.length - 1;

                  return (
                    <div key={activity.id} className="tw-relative tw-flex tw-gap-4">
                      {/* Timeline dot */}
                      <div
                        className="tw-absolute tw--left-5 tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-border tw-border-[var(--portal-border-color)] activity-timeline-dot"
                      >
                        <Icon className={cn('icon-sm', iconColor)} />
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
                            <h4 className="heading ">
                              {activity.title}
                            </h4>
                            {activity.description && (
                              <p className="text-muted tw-mt-1 tw-text-sm">
                                {activity.description}
                              </p>
                            )}
                          </div>

                          <span
                            className="text-muted tw-whitespace-nowrap tw-text-sm"
                            title={formatFullDate(activity.createdAt)}
                          >
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                        </div>

                        {/* Activity metadata */}
                        {(activity.createdBy || activity.metadata) && (
                          <div className="tw-flex tw-items-center tw-gap-3 tw-mt-2 tw-pt-2 activity-border-top">
                            {activity.createdBy && (
                              <span className="text-muted tw-text-sm">
                                by {activity.createdBy}
                              </span>
                            )}
                            {activity.metadata &&
                              Object.entries(activity.metadata).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="text-muted tw-text-sm"
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
