import { useCallback, useReducer } from 'react';
import {
  Trash2,
  Pencil,
  Calendar,
  GripVertical
} from 'lucide-react';
import { IconButton, AccordionItem } from '@react/factories';
import { cn } from '@react/lib/utils';
import { Checkbox } from '@react/components/ui/checkbox';
import { PortalInput } from '@react/components/portal/PortalInput';
import type { ProjectMilestone } from '../../../types';
import { formatDate } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

// ============================================================================
// EDIT STATE REDUCER
// ============================================================================

interface EditState {
  isEditing: boolean;
  title: string;
  description: string;
  dueDate: string;
  isSaving: boolean;
}

type EditAction =
  | { type: 'START_EDIT'; milestone: ProjectMilestone }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SET_FIELD'; field: 'title' | 'description' | 'dueDate'; value: string }
  | { type: 'SET_SAVING'; isSaving: boolean };

const INITIAL_EDIT_STATE: EditState = {
  isEditing: false,
  title: '',
  description: '',
  dueDate: '',
  isSaving: false
};

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
  case 'START_EDIT':
    return {
      isEditing: true,
      title: action.milestone.title,
      description: action.milestone.description || '',
      dueDate: action.milestone.due_date || '',
      isSaving: false
    };
  case 'CANCEL_EDIT':
    return INITIAL_EDIT_STATE;
  case 'SET_FIELD':
    return { ...state, [action.field]: action.value };
  case 'SET_SAVING':
    return { ...state, isSaving: action.isSaving };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MilestoneItemProps {
  milestone: ProjectMilestone;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  onToggleComplete: (id: number) => Promise<boolean>;
  onUpdate: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onRequestDelete: (id: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MilestoneItem
 * A single milestone card with expand/collapse, edit form, task list, and progress bar
 */
export function MilestoneItem({
  milestone,
  index,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  onUpdate,
  onRequestDelete,
  showNotification
}: MilestoneItemProps) {
  const [editState, dispatch] = useReducer(editReducer, INITIAL_EDIT_STATE);

  const taskProgress = milestone.task_count
    ? Math.round(((milestone.completed_task_count || 0) / milestone.task_count) * 100)
    : 0;

  // Toggle completion
  const handleToggle = useCallback(async () => {
    const success = await onToggleComplete(milestone.id);
    if (!success) {
      showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
    }
  }, [milestone.id, onToggleComplete, showNotification]);

  // Start editing
  const handleStartEdit = useCallback(() => {
    dispatch({ type: 'START_EDIT', milestone });
    // Ensure expanded when editing
    if (!isExpanded) {
      onToggleExpand(milestone.id);
    }
  }, [milestone, isExpanded, onToggleExpand]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    dispatch({ type: 'CANCEL_EDIT' });
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editState.title.trim()) {
      showNotification?.(NOTIFICATIONS.milestone.TITLE_REQUIRED, 'error');
      return;
    }

    dispatch({ type: 'SET_SAVING', isSaving: true });
    const success = await onUpdate(milestone.id, {
      title: editState.title.trim(),
      description: editState.description.trim() || undefined,
      due_date: editState.dueDate || undefined
    });
    dispatch({ type: 'SET_SAVING', isSaving: false });

    if (success) {
      dispatch({ type: 'CANCEL_EDIT' });
      showNotification?.(NOTIFICATIONS.milestone.UPDATED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
    }
  }, [milestone.id, editState, onUpdate, showNotification]);

  const header = (
    <>
      {/* Drag Handle */}
      <GripVertical className="icon-md tasks-drag-handle" />

      {/* Checkbox */}
      <Checkbox
        checked={milestone.is_completed}
        onCheckedChange={() => handleToggle()}
        onClick={(e) => e.stopPropagation()}
        aria-label={milestone.is_completed ? 'Mark incomplete' : 'Mark complete'}
      />

      {/* Title and Progress */}
      <div className="flex-fill">
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
            <span className="text-muted text-xs">
              ({milestone.completed_task_count || 0}/{milestone.task_count} tasks)
            </span>
          )}
        </div>

        {/* Task Progress Bar */}
        {milestone.task_count !== undefined && milestone.task_count > 0 && (
          <div className="progress-bar-sm tasks-progress-track">
            <div
              className="progress-fill"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Due Date */}
      {milestone.due_date && (
        <span className="layout-row gap-1 text-xs">
          <Calendar className="icon-sm" />
          {formatDate(milestone.due_date, 'label')}
        </span>
      )}

      {/* Order indicator */}
      <span className="text-muted tasks-order-indicator">
        #{index + 1}
      </span>
    </>
  );

  return (
    <AccordionItem
      header={header}
      isExpanded={isExpanded}
      onToggle={() => onToggleExpand(milestone.id)}
      wrapperClassName="milestone-item-wrapper"
      triggerClassName="milestone-item"
      contentClassName="milestone-expanded-content tasks-expanded-content"
      ariaLabel={`Milestone: ${milestone.title}`}
    >
      {editState.isEditing ? (
        <MilestoneEditForm
          editState={editState}
          dispatch={dispatch}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <MilestoneDetails
          milestone={milestone}
          onStartEdit={handleStartEdit}
          onRequestDelete={() => onRequestDelete(milestone.id)}
        />
      )}
    </AccordionItem>
  );
}

// ============================================================================
// SUB-COMPONENTS (internal to this file)
// ============================================================================

interface MilestoneEditFormProps {
  editState: EditState;
  dispatch: React.Dispatch<EditAction>;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * MilestoneEditForm
 * Inline edit form rendered inside expanded milestone content
 */
function MilestoneEditForm({ editState, dispatch, onSave, onCancel }: MilestoneEditFormProps) {
  return (
    <div className="layout-stack">
      <PortalInput
        placeholder="Milestone title..."
        value={editState.title}
        onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === KEYS.ESCAPE) onCancel();
        }}
        autoFocus
      />

      <textarea
        placeholder="Description (optional)..."
        value={editState.description}
        onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })}
        rows={2}
        className="textarea tasks-textarea"
        aria-label="Edit milestone description"
      />

      <PortalInput
        type="date"
        value={editState.dueDate}
        onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'dueDate', value: e.target.value })}
        className="tasks-date-input"
      />

      <div className="layout-row-end pd-mt-2">
        <IconButton action="close" onClick={onCancel} title="Cancel" />
        <IconButton action="save" onClick={onSave} loading={editState.isSaving} title="Save" />
      </div>
    </div>
  );
}

interface MilestoneDetailsProps {
  milestone: ProjectMilestone;
  onStartEdit: () => void;
  onRequestDelete: () => void;
}

/**
 * MilestoneDetails
 * Read-only view of milestone description, deliverables, and action buttons
 */
function MilestoneDetails({ milestone, onStartEdit, onRequestDelete }: MilestoneDetailsProps) {
  return (
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
        <div className="pd-highlight-value text-xs pd-mt-3">
          Completed on {formatDate(milestone.completed_date, 'label')}
        </div>
      )}

      {/* Actions */}
      <div className="milestone-actions">
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          aria-label="Edit milestone"
        >
          <Pencil className="icon-md" />
        </button>
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
          aria-label="Delete milestone"
        >
          <Trash2 className="icon-md" />
        </button>
      </div>
    </>
  );
}
