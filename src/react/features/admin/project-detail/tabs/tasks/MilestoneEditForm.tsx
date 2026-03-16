import { useCallback, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import type { ProjectMilestone, DeliverableEntry } from '../../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

interface MilestoneEditFormState {
  title: string;
  description: string;
  dueDate: string;
  deliverables: DeliverableEntry[];
}

function milestoneToFormState(milestone: ProjectMilestone): MilestoneEditFormState {
  return {
    title: milestone.title,
    description: milestone.description ?? '',
    dueDate: milestone.due_date ?? '',
    deliverables: milestone.deliverables?.map((d) => ({ ...d })) ?? []
  };
}

interface MilestoneEditFormProps {
  milestone: ProjectMilestone;
  onSave: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onCancel: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MilestoneEditForm
 * Inline form for editing a milestone's title, description, due date,
 * and managing its deliverable items (add/remove/rename).
 */
export function MilestoneEditForm({ milestone, onSave, onCancel, showNotification }: MilestoneEditFormProps) {
  const [formState, setFormState] = useState<MilestoneEditFormState>(() => milestoneToFormState(milestone));
  const [newDeliverableText, setNewDeliverableText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const updateField = useCallback(
    <K extends keyof MilestoneEditFormState>(field: K, value: MilestoneEditFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Deliverable list management
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

  const updateDeliverableText = useCallback((index: number, text: string) => {
    setFormState((prev) => ({
      ...prev,
      deliverables: prev.deliverables.map((d, i) => (i === index ? { ...d, text } : d))
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formState.title.trim()) {
      showNotification?.(NOTIFICATIONS.milestone.TITLE_REQUIRED, 'error');
      return;
    }

    setIsSaving(true);
    const success = await onSave(milestone.id, {
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      due_date: formState.dueDate || undefined,
      deliverables: formState.deliverables
    });
    setIsSaving(false);

    if (success) {
      showNotification?.(NOTIFICATIONS.milestone.UPDATED, 'success');
      onCancel();
    } else {
      showNotification?.(NOTIFICATIONS.milestone.UPDATE_FAILED, 'error');
    }
  }, [formState, milestone.id, onSave, onCancel, showNotification]);

  return (
    <div className="panel">
      <h4 className="heading tasks-form-heading">
        Edit Milestone
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

        {/* Deliverables management */}
        <div className="layout-stack gap-2">
          <span className="field-label">Deliverables</span>

          {formState.deliverables.length > 0 && (
            <ul className="deliv-edit-list">
              {formState.deliverables.map((d, idx) => (
                <li key={idx} className="deliv-edit-item">
                  <PortalInput
                    value={d.text}
                    onChange={(e) => updateDeliverableText(idx, e.target.value)}
                    className="flex-1"
                    aria-label={`Deliverable ${idx + 1}`}
                  />
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
          <PortalButton variant="ghost" onClick={onCancel}>
            Cancel
          </PortalButton>
          <PortalButton onClick={handleSubmit} loading={isSaving}>
            Save Changes
          </PortalButton>
        </div>
      </div>
    </div>
  );
}
