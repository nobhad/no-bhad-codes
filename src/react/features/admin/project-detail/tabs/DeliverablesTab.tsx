import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Pencil,
  Trash2,
  Inbox,
  AlertCircle,
  Calendar,
  Box
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { Checkbox } from '@react/components/ui/checkbox';
import { FormDropdown } from '@react/components/portal/FormDropdown';
import { IconButton, AccordionItem } from '@react/factories';
import { EmptyState } from '@react/components/portal/EmptyState';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { ProjectMilestone } from '../../types';
import type { ProjectTaskResponse } from '@/types/api';
import { formatDate } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';
import { MilestoneAddForm } from './tasks/MilestoneAddForm';
import { MilestoneEditForm } from './tasks/MilestoneEditForm';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================================================
// TYPES
// ============================================================================

interface DeliverablesTabProps {
  milestones: ProjectMilestone[];
  tasks: ProjectTaskResponse[];
  progress: number;
  onToggleTaskComplete: (taskId: number) => Promise<boolean>;
  onAssignTaskToMilestone: (taskId: number, milestoneId: number) => Promise<boolean>;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onUpdateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onDeleteMilestone: (id: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Sentinel ID for the unassigned tasks accordion
const UNASSIGNED_ID = -1;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * DeliverablesTab
 * project_tasks grouped by milestone_id.
 * Milestones complete when all their tasks are done.
 */
export function DeliverablesTab({
  milestones,
  tasks,
  progress: _progress,
  onToggleTaskComplete,
  onAssignTaskToMilestone,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  showNotification
}: DeliverablesTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(milestones.map((m) => m.id))
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteDialog = useConfirmDialog();

  // Group tasks by milestone_id
  const tasksByMilestone = useMemo(() => {
    const grouped = new Map<number | null, ProjectTaskResponse[]>();
    for (const task of tasks) {
      const key = task.milestone_id ?? null;
      const existing = grouped.get(key) ?? [];
      existing.push(task);
      grouped.set(key, existing);
    }
    return grouped;
  }, [tasks]);

  const unassignedTasks = tasksByMilestone.get(null) ?? [];

  // Stats
  const { completedCount: _completedCount, totalCount: _totalCount } = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { completedCount: completed, totalCount: total };
  }, [tasks]);

  // Toggle expansion
  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Task toggle
  const handleToggleTask = useCallback(
    async (taskId: number) => {
      const success = await onToggleTaskComplete(taskId);
      if (!success) {
        showNotification?.(NOTIFICATIONS.deliverable.TOGGLE_FAILED, 'error');
      }
    },
    [onToggleTaskComplete, showNotification]
  );

  // Assign task to milestone
  const handleAssignTask = useCallback(
    async (taskId: number, milestoneId: string) => {
      const id = parseInt(milestoneId);
      if (isNaN(id)) return;
      const success = await onAssignTaskToMilestone(taskId, id);
      if (success) {
        showNotification?.('Task assigned to milestone', 'success');
      } else {
        showNotification?.('Failed to assign task', 'error');
      }
    },
    [onAssignTaskToMilestone, showNotification]
  );

  // Edit milestone
  const handleEdit = useCallback((milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setExpandedIds((prev) => new Set(prev).add(milestone.id));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMilestoneId(null);
  }, []);

  // Delete flow
  const handleRequestDelete = useCallback(
    (id: number) => {
      setDeletingId(id);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (deletingId === null) return;
    const success = await onDeleteMilestone(deletingId);
    if (success) {
      showNotification?.(NOTIFICATIONS.milestone.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.DELETE_FAILED, 'error');
    }
    setDeletingId(null);
  }, [deletingId, onDeleteMilestone, showNotification]);

  return (
    <div className="subsection">
      {/* Progress header */}
      <div className="panel">
        <div className="data-table-header">
          <h3><span className="title-full">Deliverables</span></h3>
          <div className="data-table-actions">
            <IconButton action="add" onClick={() => setShowAddForm(true)} title="Add Milestone" />
          </div>
        </div>

        {/* Add Milestone Form */}
        {showAddForm && (
          <MilestoneAddForm
            onAdd={onAddMilestone}
            onCancel={() => setShowAddForm(false)}
            showNotification={showNotification}
          />
        )}

        {/* Milestone Accordions */}
        {milestones.length === 0 && tasks.length === 0 ? (
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            message="No milestones or tasks yet. Add milestones to track project progress."
          />
        ) : (
          <div className="milestone-list">
            {milestones.map((milestone) => {
              const milestoneTasks = tasksByMilestone.get(milestone.id) ?? [];
              const completedTasks = milestoneTasks.filter((t) => t.status === 'completed').length;
              const allCompleted = milestoneTasks.length > 0 && completedTasks === milestoneTasks.length;

              // Edit mode
              if (editingMilestoneId === milestone.id) {
                return (
                  <MilestoneEditForm
                    key={milestone.id}
                    milestone={milestone}
                    onSave={onUpdateMilestone}
                    onCancel={handleCancelEdit}
                    showNotification={showNotification}
                  />
                );
              }

              const header = (
                <>
                  <div className="flex-fill milestone-content">
                    <Box className="icon-xs" />
                    <span
                      className={cn(
                        'milestone-title',
                        allCompleted && 'completed'
                      )}
                    >
                      {decodeHtmlEntities(milestone.title)}
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
                  {/* Description */}
                  {milestone.description && (
                    <p className="milestone-description">
                      {decodeHtmlEntities(milestone.description)}
                    </p>
                  )}

                  {/* Tasks */}
                  {milestoneTasks.length > 0 ? (
                    <ul className="deliv-list">
                      {milestoneTasks.map((task) => (
                        <li key={`task-${task.id}`} className="deliv-item">
                          <Checkbox
                            checked={task.status === 'completed'}
                            onCheckedChange={() => handleToggleTask(task.id)}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                          />
                          <span
                            className={cn(
                              task.status === 'completed' && 'text-muted pd-completed-text'
                            )}
                          >
                            {task.title}
                          </span>
                          {task.due_date && (
                            <span className="text-muted text-xs">{formatDate(task.due_date)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted text-sm">
                      No tasks assigned to this milestone yet.
                    </p>
                  )}

                  {/* Auto-complete indicator */}
                  {allCompleted && milestone.completed_date && (
                    <p className="text-muted text-xs">
                      Milestone completed on {formatDate(milestone.completed_date, 'label')}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="milestone-actions">
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(milestone);
                      }}
                      aria-label="Edit milestone"
                    >
                      <Pencil className="icon-md" />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestDelete(milestone.id);
                      }}
                      aria-label="Delete milestone"
                    >
                      <Trash2 className="icon-md" />
                    </button>
                  </div>
                </AccordionItem>
              );
            })}

            {/* Unassigned tasks */}
            {unassignedTasks.length > 0 && (
              <AccordionItem
                header={
                  <div className="flex-fill milestone-content">
                    <AlertCircle className="icon-sm text-warning" />
                    <span className="milestone-title">Needs Assignment</span>
                    <span className="text-muted text-xs">
                      {unassignedTasks.length} task{unassignedTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                }
                isExpanded={expandedIds.has(UNASSIGNED_ID)}
                onToggle={() => toggleExpand(UNASSIGNED_ID)}
                wrapperClassName="milestone-item-wrapper"
                triggerClassName="milestone-item"
                contentClassName="milestone-expanded-content"
                ariaLabel="Tasks needing milestone assignment"
              >
                <ul className="deliv-list">
                  {unassignedTasks.map((task) => (
                    <li key={`task-${task.id}`} className="deliv-item">
                      <Checkbox
                        checked={task.status === 'completed'}
                        onCheckedChange={() => handleToggleTask(task.id)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                      />
                      <span
                        className={cn(
                          'flex-fill',
                          task.status === 'completed' && 'text-muted pd-completed-text'
                        )}
                      >
                        {task.title}
                      </span>
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <FormDropdown
                          value=""
                          onChange={(value) => handleAssignTask(task.id, value)}
                          options={milestones.map((m) => ({
                            value: String(m.id),
                            label: m.title
                          }))}
                          placeholder="Assign to..."
                          className="deliv-assign-trigger"
                          aria-label={`Assign "${task.title}" to milestone`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionItem>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Milestone"
        description="This will delete the milestone and all its deliverables. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
