import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  Check,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  ListTodo
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { EmptyState } from '@react/components/portal/EmptyState';
import type { ProjectMilestone } from '../../../types';
import { formatDate } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';
import { decodeHtmlEntities } from '@react/utils/decodeText';

interface MilestonesListProps {
  milestones: ProjectMilestone[];
  progress: number;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onUpdateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onToggleMilestone: (id: number) => Promise<boolean>;
  onDeleteMilestone: (id: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MilestonesList
 * Renders the milestones panel with progress bar, add form,
 * expand/collapse, inline editing, and delete confirmation.
 */
export function MilestonesList({
  milestones,
  progress,
  onAddMilestone,
  onUpdateMilestone,
  onToggleMilestone,
  onDeleteMilestone,
  showNotification
}: MilestonesListProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);

  // Edit state
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const deleteDialog = useConfirmDialog();

  const toggleMilestoneExpand = useCallback((id: number) => {
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

  const handleAddMilestone = useCallback(async () => {
    if (!newMilestoneTitle.trim()) return;

    const success = await onAddMilestone({
      title: newMilestoneTitle.trim(),
      is_completed: false
    });

    if (success) {
      setNewMilestoneTitle('');
      setShowAddMilestone(false);
      showNotification?.(NOTIFICATIONS.milestone.ADDED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.ADD_FAILED, 'error');
    }
  }, [newMilestoneTitle, onAddMilestone, showNotification]);

  const handleStartEdit = useCallback((milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setEditTitle(milestone.title);
    setExpandedMilestones((prev) => new Set(prev).add(milestone.id));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMilestoneId(null);
    setEditTitle('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingMilestoneId === null || !editTitle.trim()) return;

    setIsSavingEdit(true);
    const success = await onUpdateMilestone(editingMilestoneId, {
      title: editTitle.trim()
    });
    setIsSavingEdit(false);

    if (success) {
      handleCancelEdit();
      showNotification?.(NOTIFICATIONS.milestone.UPDATED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
    }
  }, [editingMilestoneId, editTitle, onUpdateMilestone, showNotification, handleCancelEdit]);

  const handleToggleMilestone = useCallback(
    async (id: number) => {
      const success = await onToggleMilestone(id);
      if (!success) {
        showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
      }
    },
    [onToggleMilestone, showNotification]
  );

  const handleDeleteMilestone = useCallback(async () => {
    if (deletingMilestoneId === null) return;

    const success = await onDeleteMilestone(deletingMilestoneId);
    if (success) {
      showNotification?.(NOTIFICATIONS.milestone.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.DELETE_FAILED, 'error');
    }
    setDeletingMilestoneId(null);
  }, [deletingMilestoneId, onDeleteMilestone, showNotification]);

  return (
    <>
      <div className="panel">
        <div className="panel-card-header">
          <h3 className="section-title">Milestones</h3>
          <IconButton action="add" onClick={() => setShowAddMilestone(true)} title="Add Milestone" />
        </div>

        {/* Progress Bar */}
        <div className="progress-field">
          <div className="progress-field-header">
            <span className="field-label">Progress</span>
            <span className="text-muted">{progress}%</span>
          </div>
          <div className="progress-bar-sm">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Add Milestone Form */}
        {showAddMilestone && (
          <div className="milestone-add-form">
            <PortalInput
              placeholder="Milestone title..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === KEYS.ENTER) handleAddMilestone();
                if (e.key === KEYS.ESCAPE) {
                  setShowAddMilestone(false);
                  setNewMilestoneTitle('');
                }
              }}
              autoFocus
              className="flex-1"
            />
            <PortalButton variant="primary" size="sm" onClick={handleAddMilestone}>
              Add
            </PortalButton>
            <PortalButton
              variant="ghost"
              onClick={() => {
                setShowAddMilestone(false);
                setNewMilestoneTitle('');
              }}
            >
              Cancel
            </PortalButton>
          </div>
        )}

        {/* Milestones List */}
        {milestones.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="icon-lg" />}
            message="No milestones yet."
          />
        ) : (
          <div className="milestone-list">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="milestone-item-wrapper">
                {/* Milestone row */}
                <div className="milestone-item">
                  <button
                    className={cn(
                      'milestone-checkbox',
                      milestone.is_completed && 'is-completed'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMilestone(milestone.id);
                    }}
                    aria-label={milestone.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {milestone.is_completed && <Check className="icon-sm" />}
                  </button>

                  <div
                    className="milestone-content"
                    onClick={() => toggleMilestoneExpand(milestone.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedMilestones.has(milestone.id)}
                    onKeyDown={(e) => {
                      if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                        e.preventDefault();
                        toggleMilestoneExpand(milestone.id);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        'milestone-title',
                        milestone.is_completed && 'completed'
                      )}
                    >
                      {decodeHtmlEntities(milestone.title)}
                    </span>

                    {milestone.due_date && (
                      <span className="milestone-due">{formatDate(milestone.due_date)}</span>
                    )}
                  </div>

                  <button
                    className="icon-btn"
                    onClick={() => toggleMilestoneExpand(milestone.id)}
                    aria-label={expandedMilestones.has(milestone.id) ? 'Collapse' : 'Expand'}
                  >
                    {expandedMilestones.has(milestone.id) ? (
                      <ChevronDown className="icon-sm" />
                    ) : (
                      <ChevronRight className="icon-sm" />
                    )}
                  </button>
                </div>

                {/* Expanded Content */}
                {expandedMilestones.has(milestone.id) && (
                  <div className="milestone-expanded-content">
                    {editingMilestoneId === milestone.id ? (
                      /* Inline edit form */
                      <div className="milestone-add-form">
                        <PortalInput
                          placeholder="Milestone title..."
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === KEYS.ENTER) handleSaveEdit();
                            if (e.key === KEYS.ESCAPE) handleCancelEdit();
                          }}
                          autoFocus
                          className="flex-1"
                        />
                        <PortalButton variant="primary" size="sm" onClick={handleSaveEdit} loading={isSavingEdit}>
                          Save
                        </PortalButton>
                        <PortalButton variant="ghost" onClick={handleCancelEdit}>
                          Cancel
                        </PortalButton>
                      </div>
                    ) : (
                      <>
                        {milestone.description && (
                          <p className="milestone-description">
                            {decodeHtmlEntities(milestone.description)}
                          </p>
                        )}

                        {milestone.deliverables && milestone.deliverables.length > 0 && (
                          <ul className="milestone-deliverables">
                            {milestone.deliverables.map((deliverable, idx) => (
                              <li key={idx} className="milestone-description">
                                <span>•</span>
                                {deliverable}
                              </li>
                            ))}
                          </ul>
                        )}

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
            ))}
          </div>
        )}
      </div>

      {/* Delete Milestone Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteMilestone}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
