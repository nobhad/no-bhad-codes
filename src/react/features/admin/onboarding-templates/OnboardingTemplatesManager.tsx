/**
 * ===============================================
 * ONBOARDING TEMPLATES MANAGER
 * ===============================================
 * @file src/react/features/admin/onboarding-templates/OnboardingTemplatesManager.tsx
 *
 * Admin CRUD UI for managing onboarding checklist templates.
 * Each template contains an ordered list of step configurations
 * that define the client onboarding flow.
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Inbox,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  ToggleLeft,
  ToggleRight,
  ListChecks
} from 'lucide-react';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { PortalModal, useModal } from '@react/components/portal/PortalModal';
import { IconButton } from '@react/factories';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('OnboardingTemplatesManager');

// ============================================
// TYPES
// ============================================

interface TemplateStepConfig {
  step_type: string;
  label: string;
  description?: string;
  entity_type?: string;
  auto_detect?: boolean;
  navigate_tab?: string;
}

interface OnboardingTemplate {
  id: number;
  name: string;
  project_type: string | null;
  steps_config: string;
  is_default: number;
}

interface OnboardingTemplatesManagerProps {
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// CONSTANTS
// ============================================

const STEP_TYPE_OPTIONS = [
  { value: 'review_proposal', label: 'Review Proposal' },
  { value: 'sign_contract', label: 'Sign Contract' },
  { value: 'pay_deposit', label: 'Pay Deposit' },
  { value: 'complete_questionnaire', label: 'Complete Questionnaire' },
  { value: 'upload_assets', label: 'Upload Assets' },
  { value: 'custom', label: 'Custom' }
] as const;

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'questionnaire', label: 'Questionnaire' }
] as const;

const EMPTY_STEP: TemplateStepConfig = {
  step_type: 'custom',
  label: '',
  description: '',
  entity_type: '',
  auto_detect: false,
  navigate_tab: ''
};

const COL_SPAN = 5;

// ============================================
// HELPERS
// ============================================

function parseStepsConfig(raw: string): TemplateStepConfig[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================
// STEP EDITOR SUB-COMPONENT
// ============================================

interface StepEditorProps {
  steps: TemplateStepConfig[];
  onChange: (steps: TemplateStepConfig[]) => void;
}

function StepEditor({ steps, onChange }: StepEditorProps) {
  const handleStepChange = useCallback(
    (index: number, field: keyof TemplateStepConfig, value: string | boolean) => {
      onChange(
        steps.map((step, i) =>
          i === index ? { ...step, [field]: value } : step
        )
      );
    },
    [steps, onChange]
  );

  const handleAddStep = useCallback(() => {
    onChange([...steps, { ...EMPTY_STEP }]);
  }, [steps, onChange]);

  const handleRemoveStep = useCallback(
    (index: number) => {
      onChange(steps.filter((_, i) => i !== index));
    },
    [steps, onChange]
  );

  const handleMoveStep = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= steps.length) return;
      const reordered = [...steps];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      onChange(reordered);
    },
    [steps, onChange]
  );

  return (
    <div className="template-steps-editor">
      <div className="template-steps-header">
        <h3 className="form-section-title">Steps</h3>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={handleAddStep}
        >
          <Plus className="icon-xs" />
          <span>Add Step</span>
        </button>
      </div>

      {steps.length === 0 && (
        <p className="form-helper-text">No steps configured. Add a step to get started.</p>
      )}

      {steps.map((step, index) => (
        <div key={index} className="template-step-card">
          <div className="template-step-card-header">
            <span className="template-step-number">Step {index + 1}</span>
            <div className="template-step-card-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleMoveStep(index, 'up')}
                disabled={index === 0}
                title="Move up"
                aria-label="Move step up"
              >
                <ChevronUp className="icon-xs" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleMoveStep(index, 'down')}
                disabled={index === steps.length - 1}
                title="Move down"
                aria-label="Move step down"
              >
                <ChevronDown className="icon-xs" />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => handleRemoveStep(index)}
                title="Remove step"
                aria-label="Remove step"
              >
                <Trash2 className="icon-xs" />
              </button>
            </div>
          </div>

          <div className="template-step-fields">
            <div className="form-row form-row--two-col">
              <div className="form-field">
                <label className="form-label">Step Type</label>
                <select
                  className="form-input"
                  value={step.step_type}
                  onChange={(e) => handleStepChange(index, 'step_type', e.target.value)}
                >
                  {STEP_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Label</label>
                <input
                  type="text"
                  className="form-input"
                  value={step.label}
                  onChange={(e) => handleStepChange(index, 'label', e.target.value)}
                  placeholder="Step label"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={step.description ?? ''}
                onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="form-row form-row--three-col">
              <div className="form-field">
                <label className="form-label">Entity Type</label>
                <select
                  className="form-input"
                  value={step.entity_type ?? ''}
                  onChange={(e) => handleStepChange(index, 'entity_type', e.target.value)}
                >
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Navigate Tab</label>
                <input
                  type="text"
                  className="form-input"
                  value={step.navigate_tab ?? ''}
                  onChange={(e) => handleStepChange(index, 'navigate_tab', e.target.value)}
                  placeholder="Tab name"
                />
              </div>
              <div className="form-field form-field--toggle">
                <label className="form-label">Auto-detect</label>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleStepChange(index, 'auto_detect', !step.auto_detect)}
                  title={step.auto_detect ? 'Disable auto-detect' : 'Enable auto-detect'}
                  aria-label={step.auto_detect ? 'Disable auto-detect' : 'Enable auto-detect'}
                >
                  {step.auto_detect ? (
                    <ToggleRight className="icon-md toggle-on" />
                  ) : (
                    <ToggleLeft className="icon-md toggle-off" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// TEMPLATE FORM MODAL
// ============================================

interface TemplateFormData {
  name: string;
  project_type: string;
  is_default: boolean;
  steps: TemplateStepConfig[];
}

const INITIAL_FORM_DATA: TemplateFormData = {
  name: '',
  project_type: '',
  is_default: false,
  steps: []
};

interface TemplateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: OnboardingTemplate | null;
  onSave: (data: TemplateFormData) => Promise<void>;
  isSaving: boolean;
}

function TemplateFormModal({
  open,
  onOpenChange,
  template,
  onSave,
  isSaving
}: TemplateFormModalProps) {
  const [formData, setFormData] = useState<TemplateFormData>(INITIAL_FORM_DATA);

  // Populate form when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        project_type: template.project_type ?? '',
        is_default: template.is_default === 1,
        steps: parseStepsConfig(template.steps_config)
      });
    } else {
      setFormData(INITIAL_FORM_DATA);
    }
  }, [template, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSave(formData);
    },
    [formData, onSave]
  );

  const isEditing = template !== null;
  const title = isEditing ? 'Edit Template' : 'Create Template';

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={<ClipboardList className="icon-md" />}
      size="lg"
      onSubmit={handleSubmit}
      footer={
        <div className="portal-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving || !formData.name.trim()}
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      }
    >
      <div className="form-row form-row--two-col">
        <div className="form-field">
          <label className="form-label">Template Name</label>
          <input
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Standard Onboarding"
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">Project Type</label>
          <input
            type="text"
            className="form-input"
            value={formData.project_type}
            onChange={(e) => setFormData((prev) => ({ ...prev, project_type: e.target.value }))}
            placeholder="Optional (e.g. web-design)"
          />
        </div>
      </div>

      <div className="form-field form-field--toggle">
        <label className="form-label">Default Template</label>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setFormData((prev) => ({ ...prev, is_default: !prev.is_default }))}
          title={formData.is_default ? 'Remove as default' : 'Set as default'}
          aria-label={formData.is_default ? 'Remove as default' : 'Set as default'}
        >
          {formData.is_default ? (
            <ToggleRight className="icon-md toggle-on" />
          ) : (
            <ToggleLeft className="icon-md toggle-off" />
          )}
        </button>
      </div>

      <StepEditor
        steps={formData.steps}
        onChange={(steps) => setFormData((prev) => ({ ...prev, steps }))}
      />
    </PortalModal>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OnboardingTemplatesManager({
  showNotification
}: OnboardingTemplatesManagerProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const formModal = useModal();
  const deleteDialog = useConfirmDialog();

  // ---- State ----
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<OnboardingTemplate | null>(null);

  // ---- Data Fetching ----

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(API_ENDPOINTS.ONBOARDING_CHECKLIST_TEMPLATES);
      if (response.ok) {
        const data = unwrapApiData<{ templates: OnboardingTemplate[] }>(await response.json());
        setTemplates(data.templates || []);
      } else {
        setError('Failed to load onboarding templates');
      }
    } catch (err) {
      logger.error('Failed to fetch onboarding templates:', err);
      setError('Failed to load onboarding templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ---- Computed ----

  const defaultCount = useMemo(
    () => templates.filter((t) => t.is_default === 1).length,
    [templates]
  );

  // ---- Actions ----

  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    formModal.open();
  }, [formModal]);

  const handleEdit = useCallback(
    (template: OnboardingTemplate) => {
      setEditingTemplate(template);
      formModal.open();
    },
    [formModal]
  );

  const handleDeleteClick = useCallback(
    (template: OnboardingTemplate) => {
      setTemplateToDelete(template);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!templateToDelete) return;
    try {
      const response = await apiDelete(buildEndpoint.onboardingTemplate(templateToDelete.id));
      if (response.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
        showNotification?.('Template deleted', 'success');
      } else {
        showNotification?.('Failed to delete template', 'error');
      }
    } catch (err) {
      logger.error('Failed to delete onboarding template:', err);
      showNotification?.('Failed to delete template', 'error');
    }
    setTemplateToDelete(null);
  }, [templateToDelete, showNotification]);

  const handleSave = useCallback(
    async (formData: TemplateFormData) => {
      setIsSaving(true);
      const payload = {
        name: formData.name,
        project_type: formData.project_type || null,
        is_default: formData.is_default ? 1 : 0,
        steps_config: JSON.stringify(formData.steps)
      };

      try {
        if (editingTemplate) {
          const response = await apiPut(
            buildEndpoint.onboardingTemplate(editingTemplate.id),
            payload
          );
          if (response.ok) {
            const data = unwrapApiData<{ template: OnboardingTemplate }>(await response.json());
            setTemplates((prev) =>
              prev.map((t) => (t.id === editingTemplate.id ? data.template : t))
            );
            showNotification?.('Template updated', 'success');
            formModal.close();
          } else {
            showNotification?.('Failed to update template', 'error');
          }
        } else {
          const response = await apiPost(
            API_ENDPOINTS.ONBOARDING_CHECKLIST_TEMPLATES,
            payload
          );
          if (response.ok) {
            const data = unwrapApiData<{ template: OnboardingTemplate }>(await response.json());
            setTemplates((prev) => [...prev, data.template]);
            showNotification?.('Template created', 'success');
            formModal.close();
          } else {
            showNotification?.('Failed to create template', 'error');
          }
        }
      } catch (err) {
        logger.error('Failed to save onboarding template:', err);
        showNotification?.('Failed to save template', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [editingTemplate, showNotification, formModal]
  );

  // ---- Render ----

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="ONBOARDING TEMPLATES"
        stats={
          <TableStats
            items={[
              { value: templates.length, label: 'total' },
              { value: defaultCount, label: 'default', variant: 'completed' }
            ]}
            tooltip={`${templates.length} Total Templates`}
          />
        }
        actions={
          <>
            <IconButton action="add" onClick={handleCreate} title="New Template" />
            <IconButton
              action="refresh"
              onClick={fetchTemplates}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
      >
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="name-col">Template</PortalTableHead>
              <PortalTableHead>Project Type</PortalTableHead>
              <PortalTableHead>Steps</PortalTableHead>
              <PortalTableHead>Default</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={COL_SPAN} message={error} onRetry={fetchTemplates} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={COL_SPAN} rows={5} />
            ) : templates.length === 0 ? (
              <PortalTableEmpty
                colSpan={COL_SPAN}
                icon={<Inbox />}
                message="No onboarding templates configured"
              />
            ) : (
              templates.map((template) => {
                const steps = parseStepsConfig(template.steps_config);
                return (
                  <PortalTableRow key={template.id}>
                    <PortalTableCell className="primary-cell">
                      <div className="cell-with-icon">
                        <ListChecks className="icon-sm" />
                        <div className="cell-content">
                          <span className="cell-title">{template.name}</span>
                        </div>
                      </div>
                    </PortalTableCell>

                    <PortalTableCell>
                      {template.project_type || <span className="field-label">Any</span>}
                    </PortalTableCell>

                    <PortalTableCell>
                      <span className="cell-count">{steps.length}</span>
                    </PortalTableCell>

                    <PortalTableCell>
                      <StatusBadge status={template.is_default === 1 ? 'active' : 'pending'} size="sm">
                        {template.is_default === 1 ? 'Yes' : 'No'}
                      </StatusBadge>
                    </PortalTableCell>

                    <PortalTableCell className="col-actions">
                      <div className="action-group">
                        <IconButton
                          action="edit"
                          title="Edit template"
                          onClick={() => handleEdit(template)}
                        />
                        <IconButton
                          action="delete"
                          title="Delete template"
                          onClick={() => handleDeleteClick(template)}
                        />
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                );
              })
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Create/Edit Modal */}
      <TemplateFormModal
        open={formModal.isOpen}
        onOpenChange={formModal.setIsOpen}
        template={editingTemplate}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Template"
        description={`Are you sure you want to delete "${templateToDelete?.name ?? ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
      />
    </>
  );
}
