import { useCallback, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import type { ProjectMilestone, DeliverableEntry } from '../../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

interface MilestoneFormState {
  title: string;
  description: string;
  dueDate: string;
  deliverables: DeliverableEntry[];
}

const INITIAL_FORM_STATE: MilestoneFormState = {
  title: '',
  description: '',
  dueDate: '',
  deliverables: []
};

interface MilestoneAddFormProps {
  onAdd: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onCancel: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MilestoneAddForm
 * Form for creating a new milestone with optional deliverables
 */
export function MilestoneAddForm({ onAdd, onCancel, showNotification }: MilestoneAddFormProps) {
  const [formState, setFormState] = useState<MilestoneFormState>(INITIAL_FORM_STATE);
  const [newDeliverableText, setNewDeliverableText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const updateField = useCallback(
    <K extends keyof MilestoneFormState>(field: K, value: MilestoneFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addDeliverable = useCallback(() => {
    const text = newDeliverableText.trim();
    if (!text) return;
    setFormState((prev) => ({
      ...prev,
      deliverables: [...prev.deliverables, { text, completed: false }]
    }));
    setNewDeliverableText('');
  }, [newDeliverableText]);

  const removeDeliverable = useCallback((index: number) => {
    setFormState((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }));
  }, []);

  const resetAndClose = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setNewDeliverableText('');
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
      is_completed: false,
      deliverables: formState.deliverables.length > 0 ? formState.deliverables : undefined
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

        {/* Deliverables */}
        <div className="layout-stack gap-2">
          <span className="field-label">Deliverables</span>

          {formState.deliverables.length > 0 && (
            <ul className="deliv-edit-list">
              {formState.deliverables.map((d, idx) => (
                <li key={idx} className="deliv-edit-item">
                  <span className="flex-1">{d.text}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeDeliverable(idx)}
                    aria-label={`Remove deliverable: ${d.text}`}
                  >
                    <X className="icon-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="layout-row gap-2">
            <PortalInput
              placeholder="Add deliverable..."
              value={newDeliverableText}
              onChange={(e) => setNewDeliverableText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === KEYS.ENTER) {
                  e.preventDefault();
                  addDeliverable();
                }
              }}
              className="flex-1"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={addDeliverable}
              aria-label="Add deliverable"
            >
              <Plus className="icon-sm" />
            </button>
          </div>
        </div>

        <div className="portal-card-actions pd-mt-2">
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
