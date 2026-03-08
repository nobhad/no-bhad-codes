import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  Plus,
  Check,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Calendar,
  Inbox,
  GripVertical,
  X
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import { EmptyState } from '@react/components/portal/EmptyState';
import type { ProjectMilestone } from '../../types';
import { formatDate } from '../../../../../utils/format-utils';
import { NOTIFICATIONS } from '../../../../../constants/notifications';
import { KEYS } from '../../../../../constants/keyboard';

interface TasksTabProps {
  milestones: ProjectMilestone[];
  progress: number;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onUpdateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onDeleteMilestone: (id: number) => Promise<boolean>;
  onToggleMilestone: (id: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * TasksTab
 * Milestone and task management for project
 */
export function TasksTab({
  milestones,
  progress,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onToggleMilestone,
  showNotification
}: TasksTabProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(
    new Set(milestones.map((m) => m.id))
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit state
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const deleteDialog = useConfirmDialog();

  // Toggle milestone expansion
  const toggleExpand = useCallback((id: number) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle add milestone
  const handleAddMilestone = useCallback(async () => {
    if (!newMilestoneTitle.trim()) {
      showNotification?.(NOTIFICATIONS.milestone.TITLE_REQUIRED, 'error');
      return;
    }

    setIsAdding(true);
    const success = await onAddMilestone({
      title: newMilestoneTitle.trim(),
      description: newMilestoneDescription.trim() || undefined,
      due_date: newMilestoneDueDate || undefined,
      is_completed: false
    });
    setIsAdding(false);

    if (success) {
      setNewMilestoneTitle('');
      setNewMilestoneDescription('');
      setNewMilestoneDueDate('');
      setShowAddForm(false);
      showNotification?.(NOTIFICATIONS.milestone.ADDED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.ADD_FAILED, 'error');
    }
  }, [
    newMilestoneTitle,
    newMilestoneDescription,
    newMilestoneDueDate,
    onAddMilestone,
    showNotification
  ]);

  // Start editing a milestone
  const handleStartEdit = useCallback((milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setEditTitle(milestone.title);
    setEditDescription(milestone.description || '');
    setEditDueDate(milestone.due_date || '');
    // Ensure milestone is expanded
    setExpandedMilestones((prev) => new Set(prev).add(milestone.id));
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingMilestoneId(null);
    setEditTitle('');
    setEditDescription('');
    setEditDueDate('');
  }, []);

  // Save milestone edit
  const handleSaveEdit = useCallback(async () => {
    if (editingMilestoneId === null) return;
    if (!editTitle.trim()) {
      showNotification?.(NOTIFICATIONS.milestone.TITLE_REQUIRED, 'error');
      return;
    }

    setIsSavingEdit(true);
    const success = await onUpdateMilestone(editingMilestoneId, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      due_date: editDueDate || undefined
    });
    setIsSavingEdit(false);

    if (success) {
      handleCancelEdit();
      showNotification?.(NOTIFICATIONS.milestone.UPDATED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
    }
  }, [editingMilestoneId, editTitle, editDescription, editDueDate, onUpdateMilestone, showNotification, handleCancelEdit]);

  // Handle toggle completion
  const handleToggle = useCallback(
    async (id: number) => {
      const success = await onToggleMilestone(id);
      if (!success) {
        showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
      }
    },
    [onToggleMilestone, showNotification]
  );

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deletingMilestoneId === null) return;

    const success = await onDeleteMilestone(deletingMilestoneId);
    if (success) {
      showNotification?.(NOTIFICATIONS.milestone.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.DELETE_FAILED, 'error');
    }
    setDeletingMilestoneId(null);
  }, [deletingMilestoneId, onDeleteMilestone, showNotification]);

  // Count stats
  const completedCount = milestones.filter((m) => m.is_completed).length;
  const totalCount = milestones.length;

  return (
    <div className="section">
      {/* Header with progress */}
      <div className="pd-tab-header">
        <div className="pd-row">
          <div>
            <span className="text-muted">Progress: </span>
            <span className="pd-highlight-value">
              {progress}%
            </span>
          </div>
          <div>
            <span className="text-muted">Completed: </span>
            <span className="pd-highlight-value">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        <PortalButton onClick={() => setShowAddForm(true)} icon={<Plus className="icon-md" />}>
          Add Milestone
        </PortalButton>
      </div>

      {/* Progress Bar */}
      <div className="progress-track">
        <div
          className="progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Add Milestone Form */}
      {showAddForm && (
        <div className="panel">
          <h4 className="heading tasks-form-heading">
            New Milestone
          </h4>

          <div className="pd-col">
            <PortalInput
              placeholder="Milestone title..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              autoFocus
            />

            <textarea
              placeholder="Description (optional)..."
              value={newMilestoneDescription}
              onChange={(e) => setNewMilestoneDescription(e.target.value)}
              rows={2}
              className="textarea tasks-textarea" aria-label="Milestone description"
            />

            <PortalInput
              type="date"
              value={newMilestoneDueDate}
              onChange={(e) => setNewMilestoneDueDate(e.target.value)}
              className="tasks-date-input"
            />

            <div className="pd-row-end pd-mt-2">
              <PortalButton
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewMilestoneTitle('');
                  setNewMilestoneDescription('');
                  setNewMilestoneDueDate('');
                }}
              >
                Cancel
              </PortalButton>
              <PortalButton onClick={handleAddMilestone} loading={isAdding}>
                Add Milestone
              </PortalButton>
            </div>
          </div>
        </div>
      )}

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message="No milestones yet. Add milestones to track project progress."
        />
      ) : (
        <div className="milestone-list">
          {milestones.map((milestone, index) => {
            const isExpanded = expandedMilestones.has(milestone.id);
            const isEditing = editingMilestoneId === milestone.id;
            const taskProgress = milestone.task_count
              ? Math.round(((milestone.completed_task_count || 0) / milestone.task_count) * 100)
              : 0;

            return (
              <div
                key={milestone.id}
                className="milestone-item-wrapper"
              >
                {/* Milestone Header */}
                <div
                  className="milestone-item"
                  onClick={() => toggleExpand(milestone.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                      e.preventDefault();
                      toggleExpand(milestone.id);
                    }
                  }}
                >
                  {/* Drag Handle */}
                  <GripVertical className="icon-md tasks-drag-handle" />

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(milestone.id);
                    }}
                    className={cn(
                      'tasks-checkbox',
                      milestone.is_completed && 'is-completed'
                    )}
                    aria-label={milestone.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {milestone.is_completed && (
                      <Check className="icon-sm text-dark" />
                    )}
                  </button>

                  {/* Title and Progress */}
                  <div className="pd-flex-fill">
                    <div className="milestone-content">
                      <span
                        className={cn(
                          'milestone-title',
                          milestone.is_completed && 'completed'
                        )}
                      >
                        {milestone.title}
                      </span>

                      {milestone.task_count !== undefined && milestone.task_count > 0 && (
                        <span className="text-muted pd-text-xs">
                          ({milestone.completed_task_count || 0}/{milestone.task_count} tasks)
                        </span>
                      )}
                    </div>

                    {/* Task Progress Bar */}
                    {milestone.task_count !== undefined && milestone.task_count > 0 && (
                      <div className="progress-track tasks-progress-track">
                        <div
                          className="progress-bar"
                          style={{ width: `${taskProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  {milestone.due_date && (
                    <span className="text-muted pd-row-inline pd-text-xs">
                      <Calendar className="icon-sm" />
                      {formatDate(milestone.due_date, 'label')}
                    </span>
                  )}

                  {/* Order indicator */}
                  <span className="text-muted tasks-order-indicator">
                    #{index + 1}
                  </span>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronDown className="icon-sm" />
                  ) : (
                    <ChevronRight className="icon-sm" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="milestone-expanded-content tasks-expanded-content">
                    {isEditing ? (
                      /* Edit Form */
                      <div className="pd-col">
                        <PortalInput
                          placeholder="Milestone title..."
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === KEYS.ESCAPE) handleCancelEdit();
                          }}
                          autoFocus
                        />

                        <textarea
                          placeholder="Description (optional)..."
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          className="textarea tasks-textarea"
                          aria-label="Edit milestone description"
                        />

                        <PortalInput
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="tasks-date-input"
                        />

                        <div className="pd-row-end pd-mt-2">
                          <PortalButton variant="ghost" onClick={handleCancelEdit} icon={<X className="icon-md" />}>
                            Cancel
                          </PortalButton>
                          <PortalButton onClick={handleSaveEdit} loading={isSavingEdit}>
                            Save
                          </PortalButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Description */}
                        {milestone.description && (
                          <p className="text-muted tasks-description">
                            {milestone.description}
                          </p>
                        )}

                        {/* Deliverables */}
                        {milestone.deliverables && milestone.deliverables.length > 0 && (
                          <div className="pd-mt-3">
                            <span className="field-label">
                              Deliverables
                            </span>
                            <ul className="tasks-deliverable-list">
                              {milestone.deliverables.map((deliverable, idx) => (
                                <li
                                  key={idx}
                                  className="text-muted tasks-deliverable-item"
                                >
                                  <span>•</span>
                                  {deliverable}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Completed Date */}
                        {milestone.is_completed && milestone.completed_date && (
                          <div className="pd-highlight-value pd-text-xs pd-mt-3">
                            Completed on {formatDate(milestone.completed_date, 'label')}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="milestone-actions">
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(milestone);
                            }}
                            aria-label="Edit milestone"
                          >
                            <Pencil className="icon-sm" />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingMilestoneId(milestone.id);
                              deleteDialog.open();
                            }}
                            aria-label="Delete milestone"
                          >
                            <Trash2 className="icon-sm" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
