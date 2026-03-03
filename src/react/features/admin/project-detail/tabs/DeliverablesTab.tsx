import * as React from 'react';
import { useMemo } from 'react';
import {
  Package,
  Check,
  Clock,
  ChevronRight,
  Calendar,
  Inbox
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { ProjectMilestone } from '../../types';

interface DeliverablesTabProps {
  milestones: ProjectMilestone[];
  progress: number;
}

/**
 * Deliverable item with completion status
 */
interface DeliverableItem {
  text: string;
  milestoneId: number;
  milestoneTitle: string;
  milestoneDueDate?: string;
  isCompleted: boolean;
}

/**
 * Format date for display
 */
function formatDate(date: string | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * DeliverablesTab
 * Shows all project deliverables grouped by milestone
 */
export function DeliverablesTab({
  milestones,
  progress
}: DeliverablesTabProps) {
  // Extract all deliverables with their milestone context
  const deliverables = useMemo<DeliverableItem[]>(() => {
    const items: DeliverableItem[] = [];

    for (const milestone of milestones) {
      if (milestone.deliverables && milestone.deliverables.length > 0) {
        for (const deliverable of milestone.deliverables) {
          items.push({
            text: deliverable,
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneDueDate: milestone.due_date,
            isCompleted: milestone.is_completed
          });
        }
      }
    }

    return items;
  }, [milestones]);

  // Group deliverables by milestone
  const groupedDeliverables = useMemo(() => {
    const groups: Record<number, DeliverableItem[]> = {};

    for (const item of deliverables) {
      if (!groups[item.milestoneId]) {
        groups[item.milestoneId] = [];
      }
      groups[item.milestoneId].push(item);
    }

    return groups;
  }, [deliverables]);

  // Count stats
  const completedCount = deliverables.filter((d) => d.isCompleted).length;
  const totalCount = deliverables.length;

  return (
    <div className="tw-section">
      {/* Header with stats */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-items-center tw-gap-4">
          <div>
            <span className="tw-text-muted ">Overall Progress: </span>
            <span className="tw-text-primary tw-font-semibold">
              {progress}%
            </span>
          </div>
          <div>
            <span className="tw-text-muted ">Deliverables: </span>
            <span className="tw-text-primary tw-font-semibold">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="tw-progress-track">
        <div
          className="tw-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Deliverables List */}
      {totalCount === 0 ? (
        <div className="empty-state">
          <Inbox className="icon-xl tw-mb-2" />
          <span>No deliverables defined yet</span>
          <span className="tw-text-xs">Add deliverables to milestones in the Tasks tab</span>
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-4">
          {milestones
            .filter((m) => m.deliverables && m.deliverables.length > 0)
            .map((milestone) => {
              const milestoneDeliverables = groupedDeliverables[milestone.id] || [];

              return (
                <div
                  key={milestone.id}
                  className="tw-panel"
                >
                  {/* Milestone Header */}
                  <div className="tw-flex tw-items-center tw-justify-between tw-p-4 deliv-milestone-header">
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <div
                        className={cn(
                          'tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 deliv-icon-box',
                          milestone.is_completed
                            ? 'tw-bg-white'
                            : 'tw-border tw-border-[var(--portal-border-color)]'
                        )}
                      >
                        {milestone.is_completed ? (
                          <Check className="icon-md tw-text-black" />
                        ) : (
                          <Package className="icon-xs" />
                        )}
                      </div>

                      <div>
                        <h4
                          className={cn(
                            milestone.is_completed
                              ? 'tw-text-muted'
                              : 'tw-text-primary',
                            ''
                          )}
                        >
                          {milestone.title}
                        </h4>
                        {milestone.description && (
                          <p className="tw-text-muted deliv-milestone-desc">
                            {milestone.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    {milestone.due_date && (
                      <span className="tw-text-muted tw-flex tw-items-center tw-gap-1 tw-text-xs">
                        <Calendar className="icon-xs" />
                        {formatDate(milestone.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Deliverables */}
                  <div className="tw-p-4">
                    <ul className="tw-flex tw-flex-col tw-gap-2">
                      {milestoneDeliverables.map((item, idx) => (
                        <li
                          key={idx}
                          className="tw-flex tw-items-start tw-gap-3"
                        >
                          <div
                            className={cn(
                              'tw-w-5 tw-h-5 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-mt-0.5 deliv-icon-box',
                              item.isCompleted
                                ? 'tw-bg-white'
                                : 'tw-border tw-border-[var(--portal-border-color)]'
                            )}
                          >
                            {item.isCompleted ? (
                              <Check className="icon-xs tw-text-black" />
                            ) : (
                              <Clock className="icon-xs" />
                            )}
                          </div>

                          <span
                            className={cn(
                              item.isCompleted
                                ? 'tw-text-muted tw-line-through'
                                : 'tw-text-primary',
                              ''
                            )}
                          >
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Legend */}
      <div className="tw-flex tw-items-center tw-gap-6 tw-text-muted tw-text-xs">
        <div className="tw-flex tw-items-center tw-gap-2">
          <div className="tw-w-4 tw-h-4 tw-bg-white tw-flex tw-items-center tw-justify-center deliv-icon-box">
            <Check className="icon-xs tw-text-black" />
          </div>
          <span>Completed</span>
        </div>
        <div className="tw-flex tw-items-center tw-gap-2">
          <div className="tw-w-4 tw-h-4 tw-border tw-border-[var(--portal-border-color)] tw-flex tw-items-center tw-justify-center deliv-icon-box">
            <Clock className="icon-xs" />
          </div>
          <span>In Progress</span>
        </div>
      </div>
    </div>
  );
}
