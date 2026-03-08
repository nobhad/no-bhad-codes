import { useCallback, useState } from 'react';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import type { ProjectMilestone } from '../../../types';
import { NOTIFICATIONS } from '@/constants/notifications';

interface MilestoneFormState {
  title: string;
  description: string;
  dueDate: string;
}

const INITIAL_FORM_STATE: MilestoneFormState = {
  title: '',
  description: '',
  dueDate: ''
};

interface MilestoneAddFormProps {
  onAdd: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onCancel: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MilestoneAddForm
 * Form for creating a new milestone within a project
 */
export function MilestoneAddForm({ onAdd, onCancel, showNotification }: MilestoneAddFormProps) {
  const [formState, setFormState] = useState<MilestoneFormState>(INITIAL_FORM_STATE);
  const [isAdding, setIsAdding] = useState(false);

  const updateField = useCallback(
    <K extends keyof MilestoneFormState>(field: K, value: MilestoneFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const resetAndClose = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    onCancel();
  }, [onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!formState.title.trim()) {
      showNotification?.(NOTIFICATIONS.milestone.TITLE_REQUIRED, 'error');
      return;
    }

    setIsAdding(true);
    const success = await onAdd({
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      due_date: formState.dueDate || undefined,
      is_completed: false
    });
    setIsAdding(false);

    if (success) {
      resetAndClose();
      showNotification?.(NOTIFICATIONS.milestone.ADDED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.milestone.ADD_FAILED, 'error');
    }
  }, [formState, onAdd, showNotification, resetAndClose]);

  return (
    <div className="panel">
      <h4 className="heading tasks-form-heading">
        New Milestone
      </h4>

      <div className="layout-stack">
        <PortalInput
          placeholder="Milestone title..."
          value={formState.title}
          onChange={(e) => updateField('title', e.target.value)}
          autoFocus
        />

        <textarea
          placeholder="Description (optional)..."
          value={formState.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={2}
          className="textarea tasks-textarea"
          aria-label="Milestone description"
        />

        <PortalInput
          type="date"
          value={formState.dueDate}
          onChange={(e) => updateField('dueDate', e.target.value)}
          className="tasks-date-input"
        />

        <div className="layout-row-end pd-mt-2">
          <PortalButton variant="ghost" onClick={resetAndClose}>
            Cancel
          </PortalButton>
          <PortalButton onClick={handleSubmit} loading={isAdding}>
            Add Milestone
          </PortalButton>
        </div>
      </div>
    </div>
  );
}
