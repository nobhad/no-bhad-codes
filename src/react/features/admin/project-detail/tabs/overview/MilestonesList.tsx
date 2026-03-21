import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  ListTodo,
  CheckCircle,
  Clock,
  Box,
  ArrowRight
} from 'lucide-react';
import { AccordionItem } from '@react/factories';
import { cn } from '@react/lib/utils';
import { EmptyState } from '@react/components/portal/EmptyState';
import type { ProjectMilestone } from '../../../types';
import type { ProjectTaskResponse } from '@/types/api';
import { formatDate } from '@/utils/format-utils';
import { decodeHtmlEntities } from '@react/utils/decodeText';

interface MilestonesListProps {
  milestones: ProjectMilestone[];
  tasks?: ProjectTaskResponse[];
  progress: number;
  onNavigateToDeliverables?: () => void;
}

/**
 * MilestonesList (Overview Tab)
 * Read-only summary of milestones with task counts.
 * Links to the Deliverables tab for editing.
 */
export function MilestonesList({
  milestones,
  tasks = [],
  progress: _progress,
  onNavigateToDeliverables
}: MilestonesListProps) {
  // Auto-collapse completed milestones
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (const m of milestones) {
      const mTasks = tasks.filter(t => t.milestone_id === m.id);
      const allDone = mTasks.length > 0 && mTasks.every(t => t.status === 'completed');
      if (!m.is_completed && !allDone) ids.add(m.id);
    }
    return ids;
  });

  const toggleMilestoneExpand = useCallback((id: number) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="panel">
      <div className="data-table-header">
        <h3><span className="title-full">Milestones</span></h3>
        {onNavigateToDeliverables && (
          <div className="data-table-actions">
            <button
              className="panel-action"
              onClick={onNavigateToDeliverables}
            >
              View All <ArrowRight className="panel-icon" />
            </button>
          </div>
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="icon-lg" />}
          message="No milestones yet."
        />
      ) : (
        <div className="milestone-list">
          {milestones.map((milestone) => {
            const milestoneTasks = tasks.filter(t => t.milestone_id === milestone.id);
            const completedTaskCount = milestoneTasks.filter(t => t.status === 'completed').length;
            const allTasksDone = milestoneTasks.length > 0 && completedTaskCount === milestoneTasks.length;
            const isComplete = milestone.is_completed || allTasksDone;

            const header = (
              <>
                {isComplete ? (
                  <CheckCircle className="icon-sm" style={{ color: 'var(--color-success)', flexShrink: 0 }} aria-label="Completed" />
                ) : completedTaskCount > 0 ? (
                  <Clock className="icon-sm" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-label="In Progress" />
                ) : (
                  <Box className="icon-sm" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-label="Not Started" />
                )}
                <div className="flex-fill milestone-content">
                  <span className={cn('milestone-title', isComplete && 'completed')}>
                    {decodeHtmlEntities(milestone.title)}
                  </span>
                  {isComplete && milestone.completed_date ? (
                    <span className="milestone-due">Completed {formatDate(milestone.completed_date)}</span>
                  ) : milestone.due_date ? (
                    <span className="milestone-due">{formatDate(milestone.due_date)}</span>
                  ) : null}
                </div>
                {milestoneTasks.length > 0 && (
                  <span className="text-secondary">
                    {completedTaskCount}/{milestoneTasks.length}
                  </span>
                )}
              </>
            );

            return (
              <AccordionItem
                key={milestone.id}
                header={header}
                isExpanded={expandedMilestones.has(milestone.id)}
                onToggle={() => toggleMilestoneExpand(milestone.id)}
                wrapperClassName="milestone-item-wrapper"
                triggerClassName="milestone-item"
                contentClassName="milestone-expanded-content"
                ariaLabel={`Milestone: ${milestone.title}`}
              >
                {milestone.description && (
                  <p className="milestone-description">
                    {decodeHtmlEntities(milestone.description)}
                  </p>
                )}

                {milestoneTasks.length > 0 && (
                  <ul className="milestone-task-list">
                    {milestoneTasks.map((task) => (
                      <li key={task.id} className="milestone-task-item">
                        {task.status === 'completed' ? (
                          <CheckCircle className="icon-xs" style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                        ) : (
                          <Clock className="icon-xs" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        )}
                        <span className={cn(task.status === 'completed' && 'text-secondary')}>
                          {task.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionItem>
            );
          })}
        </div>
      )}
    </div>
  );
}
