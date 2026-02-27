import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  Plus,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Inbox,
  GripVertical
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { ProjectMilestone } from '../../types';

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
      showNotification?.('Please enter a title', 'error');
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
      showNotification?.('Milestone added', 'success');
    } else {
      showNotification?.('Failed to add milestone', 'error');
    }
  }, [
    newMilestoneTitle,
    newMilestoneDescription,
    newMilestoneDueDate,
    onAddMilestone,
    showNotification
  ]);

  // Handle toggle completion
  const handleToggle = useCallback(
    async (id: number) => {
      const success = await onToggleMilestone(id);
      if (!success) {
        showNotification?.('Failed to update milestone', 'error');
      }
    },
    [onToggleMilestone, showNotification]
  );

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deletingMilestoneId === null) return;

    const success = await onDeleteMilestone(deletingMilestoneId);
    if (success) {
      showNotification?.('Milestone deleted', 'success');
    } else {
      showNotification?.('Failed to delete milestone', 'error');
    }
    setDeletingMilestoneId(null);
  }, [deletingMilestoneId, onDeleteMilestone, showNotification]);

  // Count stats
  const completedCount = milestones.filter((m) => m.is_completed).length;
  const totalCount = milestones.length;

  return (
    <div className="tw-section">
      {/* Header with progress */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-items-center tw-gap-4">
          <div>
            <span className="tw-text-muted" style={{ fontSize: '14px' }}>Progress: </span>
            <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 600 }}>
              {progress}%
            </span>
          </div>
          <div>
            <span className="tw-text-muted" style={{ fontSize: '14px' }}>Completed: </span>
            <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 600 }}>
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        <button className="tw-btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus className="tw-h-4 tw-w-4" />
          Add Milestone
        </button>
      </div>

      {/* Progress Bar */}
      <div className="tw-progress-track">
        <div
          className="tw-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Add Milestone Form */}
      {showAddForm && (
        <div className="tw-panel">
          <h4 className="tw-heading" style={{ fontSize: '14px', marginBottom: '0.75rem' }}>
            New Milestone
          </h4>

          <div className="tw-flex tw-flex-col tw-gap-3">
            <input
              type="text"
              placeholder="Milestone title..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              autoFocus
              className="tw-input"
            />

            <textarea
              placeholder="Description (optional)..."
              value={newMilestoneDescription}
              onChange={(e) => setNewMilestoneDescription(e.target.value)}
              rows={2}
              className="tw-textarea"
              style={{ minHeight: '60px' }}
            />

            <div className="tw-flex tw-items-center tw-gap-2">
              <Calendar className="tw-h-4 tw-w-4 tw-text-muted" />
              <input
                type="date"
                value={newMilestoneDueDate}
                onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                className="tw-input"
                style={{ width: 'auto' }}
              />
            </div>

            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mt-2">
              <button
                className="tw-btn-ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewMilestoneTitle('');
                  setNewMilestoneDescription('');
                  setNewMilestoneDueDate('');
                }}
              >
                Cancel
              </button>
              <button
                className="tw-btn-primary"
                onClick={handleAddMilestone}
                disabled={isAdding}
              >
                {isAdding ? 'Adding...' : 'Add Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <div className="tw-empty-state">
          <Inbox className="tw-h-8 tw-w-8 tw-mb-2" />
          <span>No milestones yet</span>
          <span style={{ fontSize: '12px' }}>Add milestones to track project progress</span>
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-2">
          {milestones.map((milestone, index) => {
            const isExpanded = expandedMilestones.has(milestone.id);
            const taskProgress = milestone.task_count
              ? Math.round(((milestone.completed_task_count || 0) / milestone.task_count) * 100)
              : 0;

            return (
              <div
                key={milestone.id}
                className="tw-panel"
              >
                {/* Milestone Header */}
                <div
                  className="tw-list-item"
                  onClick={() => toggleExpand(milestone.id)}
                >
                  {/* Drag Handle */}
                  <GripVertical className="tw-h-4 tw-w-4 tw-text-muted" style={{ opacity: 0.5 }} />

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(milestone.id);
                    }}
                    className={cn(
                      'tw-w-5 tw-h-5 tw-border tw-flex tw-items-center tw-justify-center tw-transition-colors tw-flex-shrink-0',
                      milestone.is_completed
                        ? 'tw-bg-white tw-border-white'
                        : 'tw-border-[rgba(255,255,255,0.3)] hover:tw-border-white'
                    )}
                    style={{ borderRadius: 0 }}
                  >
                    {milestone.is_completed && (
                      <Check className="tw-h-3 tw-w-3 tw-text-black" />
                    )}
                  </button>

                  {/* Title and Progress */}
                  <div className="tw-flex-1 tw-min-w-0">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <span
                        className={cn(
                          milestone.is_completed
                            ? 'tw-text-muted tw-line-through'
                            : 'tw-text-primary'
                        )}
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        {milestone.title}
                      </span>

                      {milestone.task_count !== undefined && milestone.task_count > 0 && (
                        <span className="tw-text-muted" style={{ fontSize: '12px' }}>
                          ({milestone.completed_task_count || 0}/{milestone.task_count} tasks)
                        </span>
                      )}
                    </div>

                    {/* Task Progress Bar */}
                    {milestone.task_count !== undefined && milestone.task_count > 0 && (
                      <div className="tw-progress-track" style={{ marginTop: '0.5rem', maxWidth: '200px' }}>
                        <div
                          className="tw-progress-bar"
                          style={{ width: `${taskProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  {milestone.due_date && (
                    <span className="tw-text-muted tw-flex tw-items-center tw-gap-1" style={{ fontSize: '12px' }}>
                      <Calendar className="tw-h-3 tw-w-3" />
                      {formatDate(milestone.due_date)}
                    </span>
                  )}

                  {/* Order indicator */}
                  <span className="tw-text-muted tw-w-6 tw-text-center" style={{ fontSize: '12px' }}>
                    #{index + 1}
                  </span>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronDown className="tw-h-4 tw-w-4 tw-text-muted" />
                  ) : (
                    <ChevronRight className="tw-h-4 tw-w-4 tw-text-muted" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="tw-px-4 tw-pb-4 tw-pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {/* Description */}
                    {milestone.description && (
                      <p className="tw-text-muted tw-mt-3" style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                        {milestone.description}
                      </p>
                    )}

                    {/* Deliverables */}
                    {milestone.deliverables && milestone.deliverables.length > 0 && (
                      <div className="tw-mt-3">
                        <span className="tw-label">
                          Deliverables
                        </span>
                        <ul className="tw-mt-2 tw-space-y-1">
                          {milestone.deliverables.map((deliverable, idx) => (
                            <li
                              key={idx}
                              className="tw-text-muted tw-flex tw-items-start tw-gap-2"
                              style={{ fontSize: '14px' }}
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
                      <div className="tw-mt-3 tw-text-primary" style={{ fontSize: '12px' }}>
                        Completed on {formatDate(milestone.completed_date)}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mt-4">
                      <button
                        className="tw-btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingMilestoneId(milestone.id);
                          deleteDialog.open();
                        }}
                      >
                        <Trash2 className="tw-h-3 tw-w-3" />
                        Delete
                      </button>
                    </div>
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
