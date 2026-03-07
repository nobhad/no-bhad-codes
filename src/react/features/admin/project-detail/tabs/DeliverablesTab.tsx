import * as React from 'react';
import { useMemo } from 'react';
import {
  Package,
  Check,
  Clock,
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
      <div className="pd-tab-header">
        <div className="pd-row">
          <div>
            <span className="text-muted">Overall Progress: </span>
            <span className="pd-highlight-value">
              {progress}%
            </span>
          </div>
          <div>
            <span className="text-muted">Deliverables: </span>
            <span className="pd-highlight-value">
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
          <Inbox className="icon-xl pd-mb-2" />
          <span>No deliverables defined yet</span>
          <span className="pd-text-xs">Add deliverables to milestones in the Tasks tab</span>
        </div>
      ) : (
        <div className="pd-col-wide">
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
                  <div className="pd-tab-header deliv-milestone-header">
                    <div className="pd-row-tight">
                      {milestone.is_completed ? (
                        <Check className="icon-md" />
                      ) : (
                        <Package className="icon-md" />
                      )}

                      <div>
                        <h4
                          className={cn(
                            milestone.is_completed
                              ? 'text-muted'
                              : 'pd-highlight-value'
                          )}
                        >
                          {milestone.title}
                        </h4>
                        {milestone.description && (
                          <p className="text-muted deliv-milestone-desc">
                            {milestone.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    {milestone.due_date && (
                      <span className="text-muted pd-row-inline pd-text-xs">
                        <Calendar className="icon-sm" />
                        {formatDate(milestone.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Deliverables */}
                  <div className="deliv-content">
                    <ul className="deliv-list">
                      {milestoneDeliverables.map((item, idx) => (
                        <li
                          key={idx}
                          className="deliv-item"
                        >
                          {item.isCompleted ? (
                            <Check className="icon-sm" />
                          ) : (
                            <Clock className="icon-sm" />
                          )}

                          <span
                            className={cn(
                              item.isCompleted
                                ? 'text-muted pd-completed-text'
                                : 'pd-highlight-value'
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
      <div className="deliv-legend text-muted">
        <div className="deliv-legend-item">
          <Check className="icon-sm" />
          <span>Completed</span>
        </div>
        <div className="deliv-legend-item">
          <Clock className="icon-sm" />
          <span>In Progress</span>
        </div>
      </div>
    </div>
  );
}
