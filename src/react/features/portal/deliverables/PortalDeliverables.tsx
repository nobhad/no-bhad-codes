/**
 * PortalDeliverables
 * Milestone + task accordion view for client portal (read-only).
 * Mirrors admin project detail Deliverables tab layout.
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Inbox, CheckCircle2, Clock, Box, Calendar } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { AccordionItem, IconButton } from '@react/factories';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout } from '@react/components/portal/TableLayout';
import { ProgressBar } from '@react/components/portal';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalFetch } from '@react/hooks/usePortalFetch';
import { useActiveProjectId } from '@react/stores/portal-store';
import { formatDate } from '@/utils/format-utils';
import { buildEndpoint, API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import type { PortalViewProps } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface Milestone {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  completed_date?: string;
  is_completed: number | boolean;
  task_count?: number;
  completed_task_count?: number;
  progress_percentage?: number;
}

interface Task {
  id: number;
  title: string;
  status: string;
  milestone_id?: number;
  due_date?: string;
}

export interface PortalDeliverablesProps extends PortalViewProps {
  onNavigate?: (entityType: string, entityId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PortalDeliverables({ getAuthToken }: PortalDeliverablesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const activeProjectId = useActiveProjectId();
  const { portalFetch } = usePortalFetch({ getAuthToken });

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which milestones are expanded (default: all)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    if (!activeProjectId) {
      setMilestones([]);
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [milestonesRes, tasksRes] = await Promise.all([
        portalFetch<{ milestones: Milestone[] }>(buildEndpoint.projectMilestones(activeProjectId)),
        portalFetch<{ tasks: Task[] }>(`${API_ENDPOINTS.PROJECTS}/${activeProjectId}/tasks`)
      ]);

      const m = milestonesRes.milestones ?? [];
      const t = tasksRes.tasks ?? [];

      setMilestones(m);
      setTasks(t);

      // Expand all milestones by default
      setExpandedIds(new Set(m.map((ms) => ms.id)));
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load deliverables'));
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, portalFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group tasks by milestone_id
  const tasksByMilestone = useMemo(() => {
    const grouped = new Map<number | null, Task[]>();
    for (const task of tasks) {
      const key = task.milestone_id ?? null;
      const existing = grouped.get(key) ?? [];
      existing.push(task);
      grouped.set(key, existing);
    }
    return grouped;
  }, [tasks]);

  // Stats
  const { completedCount, totalCount, progress } = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedCount: completed, totalCount: total, progress: pct };
  }, [tasks]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <TableLayout nested
      containerRef={containerRef}
      title="DELIVERABLES"
      actions={
        <IconButton action="refresh" onClick={fetchData} title="Refresh" loading={isLoading} />
      }
    >
      {/* Progress */}
      {totalCount > 0 && (
        <ProgressBar value={progress} detail={`(${completedCount}/${totalCount})`} />
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading deliverables..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : milestones.length === 0 && tasks.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message="No deliverables yet. Deliverables will appear here as your project progresses."
        />
      ) : (
        <div className="milestone-list">
          {milestones.map((milestone) => {
            const milestoneTasks = tasksByMilestone.get(milestone.id) ?? [];
            const completedTasks = milestoneTasks.filter((t) => t.status === 'completed').length;
            const allCompleted = milestoneTasks.length > 0 && completedTasks === milestoneTasks.length;

            const header = (
              <>
                <div className="flex-fill milestone-content">
                  <Box className="icon-xs" />
                  <span className={cn('milestone-title', allCompleted && 'completed')}>
                    {milestone.title}
                  </span>
                  {milestone.due_date && (
                    <span className="milestone-due">
                      <Calendar className="icon-xs" />
                      {formatDate(milestone.due_date)}
                    </span>
                  )}
                </div>
                <span className="text-muted text-xs">
                  {completedTasks}/{milestoneTasks.length}
                </span>
              </>
            );

            return (
              <AccordionItem
                key={milestone.id}
                header={header}
                isExpanded={expandedIds.has(milestone.id)}
                onToggle={() => toggleExpand(milestone.id)}
                wrapperClassName="milestone-item-wrapper"
                triggerClassName={cn('milestone-item', allCompleted && 'completed')}
                contentClassName="milestone-expanded-content"
                ariaLabel={`Milestone: ${milestone.title}`}
              >
                {milestone.description && (
                  <p className="milestone-description">{milestone.description}</p>
                )}

                {milestoneTasks.length > 0 ? (
                  <ul className="deliv-list">
                    {milestoneTasks.map((task) => (
                      <li key={`task-${task.id}`} className="deliv-item">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="icon-sm text-status-completed" />
                        ) : (
                          <Clock className="icon-sm text-muted" />
                        )}
                        <span className={cn(task.status === 'completed' && 'text-muted pd-completed-text')}>
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span className="text-muted text-xs">{formatDate(task.due_date)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm">No tasks in this milestone yet.</p>
                )}

                {allCompleted && milestone.completed_date && (
                  <p className="text-muted text-xs">
                    Completed on {formatDate(milestone.completed_date, 'label')}
                  </p>
                )}
              </AccordionItem>
            );
          })}
        </div>
      )}
    </TableLayout>
  );
}
