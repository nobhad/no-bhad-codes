/**
 * ===============================================
 * AUTOMATION BUILDER
 * ===============================================
 * @file src/react/features/admin/automations/AutomationBuilder.tsx
 *
 * Visual builder for creating / editing automations.
 * Shows trigger selection, condition rows, and an ordered
 * list of action cards with type-specific config forms.
 * Renders as a full-screen modal/panel.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail,
  ListTodo,
  RefreshCw,
  Bell,
  Clock,
  Receipt,
  ClipboardList,
  Globe,
  Tag,
  StickyNote,
  Plus,
  Trash2,
  GripVertical,
  X,
  Save,
  Inbox
} from 'lucide-react';
import { usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { ActionType, Automation } from './types';
import {
  ACTION_TYPE_LABELS,
  TRIGGER_EVENT_GROUPS
} from './types';

const logger = createLogger('AutomationBuilder');

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_ACTION_TYPES: ActionType[] = [
  'send_email',
  'create_task',
  'update_status',
  'send_notification',
  'wait',
  'enroll_sequence',
  'create_invoice',
  'assign_questionnaire',
  'webhook',
  'add_tag',
  'add_note'
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' }
];

const WAIT_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

const RECIPIENT_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'admin', label: 'Admin' }
];

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' }
];

/** Maps action types to their lucide icon component */
const ACTION_ICON_MAP: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  send_email: Mail,
  create_task: ListTodo,
  update_status: RefreshCw,
  send_notification: Bell,
  wait: Clock,
  enroll_sequence: Mail,
  create_invoice: Receipt,
  assign_questionnaire: ClipboardList,
  webhook: Globe,
  add_tag: Tag,
  add_note: StickyNote
};

// ============================================================================
// LOCAL TYPES
// ============================================================================

interface ActionDraft {
  /** Client-side key for React list rendering */
  key: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
}

interface ConditionDraft {
  key: string;
  field: string;
  operator: string;
  value: string;
}

// ============================================================================
// PROPS
// ============================================================================

export interface AutomationBuilderProps {
  /** If provided, loads existing automation for editing */
  automationId?: number;
  /** Called after successful save */
  onSave: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// HELPERS
// ============================================================================

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `action-${keyCounter}`;
}

let condKeyCounter = 0;
function nextCondKey(): string {
  condKeyCounter += 1;
  return `cond-${condKeyCounter}`;
}

function defaultConfigForType(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
  case 'send_email':
    return { to: 'client', subject: '' };
  case 'create_task':
    return { title: '', priority: 'medium', dueOffsetDays: 1 };
  case 'update_status':
    return { entity: '', newStatus: '' };
  case 'send_notification':
    return { message: '', to: 'admin' };
  case 'wait':
    return { duration: 1, unit: 'hours' };
  case 'enroll_sequence':
    return { sequenceId: '' };
  case 'create_invoice':
    return {};
  case 'assign_questionnaire':
    return {};
  case 'webhook':
    return { url: '', method: 'POST' };
  case 'add_tag':
    return { tagName: '' };
  case 'add_note':
    return { content: '' };
  default:
    return {};
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Renders the type-specific config fields for a single action. */
const ActionConfigForm = React.memo(({
  action,
  onConfigChange
}: {
  action: ActionDraft;
  onConfigChange: (key: string, field: string, value: unknown) => void;
}) => {
  const { key, actionType, actionConfig } = action;

  const updateField = useCallback(
    (field: string, value: unknown) => onConfigChange(key, field, value),
    [key, onConfigChange]
  );

  switch (actionType) {
  case 'send_email':
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="field-label">To</label>
          <select
            className="form-input"
            value={(actionConfig.to as string) || 'client'}
            onChange={(e) => updateField('to', e.target.value)}
          >
            {RECIPIENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="field-label">Subject</label>
          <input
            type="text"
            className="form-input"
            placeholder="Email subject line"
            value={(actionConfig.subject as string) || ''}
            onChange={(e) => updateField('subject', e.target.value)}
          />
        </div>
      </div>
    );

  case 'create_task':
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="field-label">Title</label>
          <input
            type="text"
            className="form-input"
            placeholder="Task title"
            value={(actionConfig.title as string) || ''}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label className="field-label">Priority</label>
            <select
              className="form-input"
              value={(actionConfig.priority as string) || 'medium'}
              onChange={(e) => updateField('priority', e.target.value)}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="field-label">Due (days from trigger)</label>
            <input
              type="number"
              className="form-input"
              min={0}
              value={(actionConfig.dueOffsetDays as number) ?? 1}
              onChange={(e) => updateField('dueOffsetDays', Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    );

  case 'update_status':
    return (
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="field-label">Entity</label>
          <input
            type="text"
            className="form-input"
            placeholder="project, invoice, etc."
            value={(actionConfig.entity as string) || ''}
            onChange={(e) => updateField('entity', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="field-label">New Status</label>
          <input
            type="text"
            className="form-input"
            placeholder="active, completed, etc."
            value={(actionConfig.newStatus as string) || ''}
            onChange={(e) => updateField('newStatus', e.target.value)}
          />
        </div>
      </div>
    );

  case 'send_notification':
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="field-label">To</label>
          <select
            className="form-input"
            value={(actionConfig.to as string) || 'admin'}
            onChange={(e) => updateField('to', e.target.value)}
          >
            {RECIPIENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="field-label">Message</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Notification message..."
            value={(actionConfig.message as string) || ''}
            onChange={(e) => updateField('message', e.target.value)}
          />
        </div>
      </div>
    );

  case 'wait':
    return (
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="field-label">Duration</label>
          <input
            type="number"
            className="form-input"
            min={1}
            value={(actionConfig.duration as number) ?? 1}
            onChange={(e) => updateField('duration', Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="field-label">Unit</label>
          <select
            className="form-input"
            value={(actionConfig.unit as string) || 'hours'}
            onChange={(e) => updateField('unit', e.target.value)}
          >
            {WAIT_UNITS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );

  case 'enroll_sequence':
    return (
      <div className="flex flex-col gap-1">
        <label className="field-label">Sequence ID</label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter sequence ID"
          value={(actionConfig.sequenceId as string) || ''}
          onChange={(e) => updateField('sequenceId', e.target.value)}
        />
      </div>
    );

  case 'create_invoice':
  case 'assign_questionnaire':
    return (
      <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
        Configuration will use trigger context data automatically.
      </p>
    );

  case 'webhook':
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="field-label">URL</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com/webhook"
            value={(actionConfig.url as string) || ''}
            onChange={(e) => updateField('url', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="field-label">Method</label>
          <select
            className="form-input"
            value={(actionConfig.method as string) || 'POST'}
            onChange={(e) => updateField('method', e.target.value)}
          >
            {HTTP_METHODS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );

  case 'add_tag':
    return (
      <div className="flex flex-col gap-1">
        <label className="field-label">Tag Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. vip, follow-up"
          value={(actionConfig.tagName as string) || ''}
          onChange={(e) => updateField('tagName', e.target.value)}
        />
      </div>
    );

  case 'add_note':
    return (
      <div className="flex flex-col gap-1">
        <label className="field-label">Content</label>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Note content..."
          value={(actionConfig.content as string) || ''}
          onChange={(e) => updateField('content', e.target.value)}
        />
      </div>
    );

  default:
    return null;
  }
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AutomationBuilder({
  automationId,
  onSave,
  onCancel,
  getAuthToken,
  showNotification
}: AutomationBuilderProps) {
  const { portalFetch } = usePortalFetch({ getAuthToken });

  // ---- Form state ----
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<string>(
    TRIGGER_EVENT_GROUPS[0].events[0].value
  );
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!automationId);

  const isEditMode = automationId !== undefined;

  // ---- Load existing automation ----
  useEffect(() => {
    if (!automationId) return;

    let cancelled = false;

    const loadAutomation = async () => {
      setIsLoadingExisting(true);
      try {
        const data = await portalFetch<Automation>(
          `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}`
        );
        if (cancelled) return;

        setName(data.name);
        setDescription(data.description || '');
        setTriggerEvent(data.triggerEvent);
        setConditions(
          (data.triggerConditions || []).map((cond) => ({
            key: nextCondKey(),
            field: (cond.field as string) || '',
            operator: (cond.operator as string) || 'equals',
            value: (cond.value as string) || ''
          }))
        );
        setActions(
          (data.actions || [])
            .sort((a, b) => a.actionOrder - b.actionOrder)
            .map((a) => ({
              key: nextKey(),
              actionType: a.actionType,
              actionConfig: a.actionConfig || {}
            }))
        );
      } catch (err) {
        logger.error('Error loading automation:', err);
        showNotification?.(
          formatErrorMessage(err, 'Failed to load automation'),
          'error'
        );
      } finally {
        if (!cancelled) setIsLoadingExisting(false);
      }
    };

    loadAutomation();
    return () => { cancelled = true; };
  }, [automationId, portalFetch, showNotification]);

  // ---- Condition handlers ----

  const handleAddCondition = useCallback(() => {
    setConditions((prev) => [...prev, { key: nextCondKey(), field: '', operator: 'equals', value: '' }]);
  }, []);

  const handleRemoveCondition = useCallback((key: string) => {
    setConditions((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const handleConditionChange = useCallback(
    (key: string, field: keyof ConditionDraft, value: string) => {
      setConditions((prev) =>
        prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  // ---- Action handlers ----

  const handleAddAction = useCallback(() => {
    const defaultType: ActionType = 'send_email';
    setActions((prev) => [
      ...prev,
      { key: nextKey(), actionType: defaultType, actionConfig: defaultConfigForType(defaultType) }
    ]);
  }, []);

  const handleRemoveAction = useCallback((key: string) => {
    setActions((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const handleActionTypeChange = useCallback((key: string, newType: ActionType) => {
    setActions((prev) =>
      prev.map((a) =>
        a.key === key
          ? { ...a, actionType: newType, actionConfig: defaultConfigForType(newType) }
          : a
      )
    );
  }, []);

  const handleActionConfigChange = useCallback(
    (key: string, field: string, value: unknown) => {
      setActions((prev) =>
        prev.map((a) =>
          a.key === key
            ? { ...a, actionConfig: { ...a.actionConfig, [field]: value } }
            : a
        )
      );
    },
    []
  );

  // ---- Save ----

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      showNotification?.('Automation name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        triggerEvent,
        triggerConditions: conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value
        })),
        actions: actions.map((a, index) => ({
          actionOrder: index + 1,
          actionType: a.actionType,
          actionConfig: a.actionConfig
        }))
      };

      if (isEditMode) {
        await portalFetch(
          `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}`,
          { method: 'PUT', body: payload }
        );
        showNotification?.('Automation updated', 'success');
      } else {
        await portalFetch(`${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations`, {
          method: 'POST',
          body: payload
        });
        showNotification?.('Automation created', 'success');
      }

      onSave();
    } catch (err) {
      logger.error('Error saving automation:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to save automation'),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    name, description, triggerEvent, conditions, actions,
    isEditMode, automationId, portalFetch, showNotification, onSave
  ]);

  // ---- Trigger event label lookup ----
  const triggerEventLabel = useMemo(() => {
    for (const group of TRIGGER_EVENT_GROUPS) {
      const found = group.events.find((e) => e.value === triggerEvent);
      if (found) return found.label;
    }
    return triggerEvent;
  }, [triggerEvent]);

  // ---- Loading state ----
  if (isLoadingExisting) {
    return (
      <div
        className="portal-card"
        style={{ padding: 'var(--spacing-6)', textAlign: 'center' }}
      >
        <RefreshCw
          className="icon-md loading-spin"
          style={{ color: 'var(--app-color-text-muted)', marginBottom: 'var(--spacing-2)' }}
        />
        <p className="text-muted">Loading automation...</p>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="portal-card">
        <div className="portal-card-header">
          <span className="cell-title">
            {isEditMode ? 'Edit Automation' : 'New Automation'}
          </span>
        </div>
        <div className="card-body flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="field-label" htmlFor="builder-name">
              Name <span className="form-required">*</span>
            </label>
            <input
              id="builder-name"
              type="text"
              className="form-input"
              placeholder="Automation name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="field-label" htmlFor="builder-desc">Description</label>
            <textarea
              id="builder-desc"
              className="form-input"
              rows={2}
              placeholder="What does this automation do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Trigger Section */}
      <div className="portal-card">
        <div className="portal-card-header">
          <span className="cell-title">Trigger</span>
        </div>
        <div className="card-body flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="field-label" htmlFor="builder-trigger">
              When this event occurs:
            </label>
            <select
              id="builder-trigger"
              className="form-input"
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
            >
              {TRIGGER_EVENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.events.map((evt) => (
                    <option key={evt.value} value={evt.value}>
                      {evt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="field-label">Conditions (optional)</span>
              <button
                type="button"
                className="btn-secondary flex items-center gap-1"
                onClick={handleAddCondition}
                style={{ fontSize: 'var(--font-size-xs)' }}
              >
                <Plus className="icon-xs" />
                Add Condition
              </button>
            </div>

            {conditions.length === 0 && (
              <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                No conditions - automation will run for every {triggerEventLabel} event.
              </p>
            )}

            {conditions.map((cond) => (
              <div key={cond.key} className="flex items-center gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Field name"
                  value={cond.field}
                  onChange={(e) => handleConditionChange(cond.key, 'field', e.target.value)}
                />
                <select
                  className="form-input"
                  value={cond.operator}
                  onChange={(e) => handleConditionChange(cond.key, 'operator', e.target.value)}
                  style={{ maxWidth: '160px' }}
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Value"
                  value={cond.value}
                  onChange={(e) => handleConditionChange(cond.key, 'value', e.target.value)}
                />
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleRemoveCondition(cond.key)}
                  title="Remove condition"
                  style={{ padding: '4px 8px' }}
                >
                  <X className="icon-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="portal-card">
        <div className="portal-card-header">
          <span className="cell-title">Actions</span>
        </div>
        <div className="card-body flex flex-col gap-3">
          {actions.length === 0 && (
            <div
              className="flex flex-col items-center gap-2 py-4"
              style={{ color: 'var(--app-color-text-muted)' }}
            >
              <Inbox className="icon-md" />
              <p className="text-muted">No actions added yet. Add your first action below.</p>
            </div>
          )}

          {actions.map((action, index) => {
            const IconComponent = ACTION_ICON_MAP[action.actionType];
            return (
              <div
                key={action.key}
                className="portal-card"
                style={{
                  border: '1px solid var(--app-color-border)',
                  background: 'var(--app-color-bg-secondary)'
                }}
              >
                <div
                  className="flex items-center justify-between gap-2"
                  style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical
                      className="icon-xs"
                      style={{ color: 'var(--app-color-text-muted)' }}
                    />
                    <span
                      className="text-muted"
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        minWidth: '20px'
                      }}
                    >
                      {index + 1}.
                    </span>
                    <IconComponent className="icon-sm" />
                    <select
                      className="form-input"
                      value={action.actionType}
                      onChange={(e) => handleActionTypeChange(action.key, e.target.value as ActionType)}
                      style={{ maxWidth: '220px' }}
                    >
                      {ALL_ACTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ACTION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleRemoveAction(action.key)}
                    title="Remove action"
                    style={{ padding: '4px 8px' }}
                  >
                    <Trash2 className="icon-xs" />
                  </button>
                </div>
                <div style={{ padding: '0 var(--spacing-3) var(--spacing-3)' }}>
                  <ActionConfigForm
                    action={action}
                    onConfigChange={handleActionConfigChange}
                  />
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn-secondary flex items-center justify-center gap-1.5"
            onClick={handleAddAction}
            style={{ width: '100%', padding: 'var(--spacing-2)' }}
          >
            <Plus className="icon-xs" />
            Add Action
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <RefreshCw className="icon-xs loading-spin" />
          ) : (
            <Save className="icon-xs" />
          )}
          {isEditMode ? 'Update Automation' : 'Create Automation'}
        </button>
      </div>
    </div>
  );
}
