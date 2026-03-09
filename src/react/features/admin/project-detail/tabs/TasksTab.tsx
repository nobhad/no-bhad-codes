import { useCallback, useState } from 'react';
import { Inbox } from 'lucide-react';
import { IconButton } from '@react/factories';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { EmptyState } from '@react/components/portal/EmptyState';
import type { ProjectMilestone } from '../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { MilestoneAddForm } from './tasks/MilestoneAddForm';
import { MilestoneItem } from './tasks/MilestoneItem';

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
 * Milestone and task management for project.
 * Orchestrates MilestoneItem and MilestoneAddForm sub-components.
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
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);

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

  // Handle delete confirmation
  const handleRequestDelete = useCallback(
    (id: number) => {
      setDeletingMilestoneId(id);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
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
      {/* Header with progress + progress bar */}
      <div className="tasks-progress-block">
        <div className="layout-row-between">
          <div className="layout-row gap-4">
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

          <IconButton action="add" onClick={() => setShowAddForm(true)} title="Add Milestone" />
        </div>

        <div className="progress-bar-sm">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
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

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message="No milestones yet. Add milestones to track project progress."
        />
      ) : (
        <div className="milestone-list">
          {milestones.map((milestone, index) => (
            <MilestoneItem
              key={milestone.id}
              milestone={milestone}
              index={index}
              isExpanded={expandedMilestones.has(milestone.id)}
              onToggleExpand={toggleExpand}
              onToggleComplete={onToggleMilestone}
              onUpdate={onUpdateMilestone}
              onRequestDelete={handleRequestDelete}
              showNotification={showNotification}
            />
          ))}
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
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
