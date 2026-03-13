/**
 * Project Templates data fetching and CRUD operations hook
 * @file src/react/features/admin/project-templates/useProjectTemplatesData.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/utils/logger';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import {
  EMPTY_FORM,
  type ProjectTemplateItem,
  type ProjectTemplateFormData
} from './types';

const logger = createLogger('ProjectTemplatesManager');

interface UseProjectTemplatesDataParams {
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useProjectTemplatesData({ showNotification }: UseProjectTemplatesDataParams) {
  // ---- List state ----
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplateItem[]>([]);

  // ---- Form state ----
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplateItem | null>(null);
  const [formData, setFormData] = useState<ProjectTemplateFormData>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Delete state ----
  const [deletingTemplate, setDeletingTemplate] = useState<ProjectTemplateItem | null>(null);

  // ---- Data fetching ----

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${API_ENDPOINTS.ADMIN.PROJECT_TEMPLATES}?includeInactive=true`
      );
      if (!response.ok) throw new Error('Failed to load templates');
      const payload = unwrapApiData<{ templates?: ProjectTemplateItem[] }>(await response.json());
      setTemplates(payload.templates || []);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load templates'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // ---- Form handlers ----

  const prepareAddForm = useCallback(() => {
    setEditingTemplate(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }, []);

  const prepareEditForm = useCallback((template: ProjectTemplateItem) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      projectType: template.projectType || '',
      estimatedDurationDays: template.estimatedDurationDays || '',
      defaultHourlyRate: template.defaultHourlyRate || '',
      isActive: template.isActive,
      milestones: [...template.defaultMilestones],
      tasks: [...template.defaultTasks]
    });
    setFormError(null);
  }, []);

  const handleFormSubmit = useCallback(async (onClose: () => void) => {
    setFormError(null);
    if (!formData.name.trim()) { setFormError('Name is required'); return; }

    setFormSaving(true);
    try {
      const body = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        projectType: formData.projectType || undefined,
        estimatedDurationDays: formData.estimatedDurationDays || undefined,
        defaultHourlyRate: formData.defaultHourlyRate || undefined,
        isActive: formData.isActive,
        defaultMilestones: formData.milestones,
        defaultTasks: formData.tasks
      };

      const isEditing = editingTemplate !== null;
      const endpoint = isEditing
        ? buildEndpoint.projectTemplate(editingTemplate.id)
        : API_ENDPOINTS.ADMIN.PROJECT_TEMPLATES;

      const response = isEditing
        ? await apiPut(endpoint, body)
        : await apiPost(endpoint, body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          (errorData as { message?: string } | null)?.message
          || `Failed to ${isEditing ? 'update' : 'create'} template`
        );
      }

      showNotification?.(
        `Template ${isEditing ? 'updated' : 'created'} successfully`,
        'success'
      );
      onClose();
      loadTemplates();
    } catch (err) {
      const message = formatErrorMessage(err, 'Failed to save template');
      setFormError(message);
      logger.error('Failed to save template:', err);
    } finally {
      setFormSaving(false);
    }
  }, [formData, editingTemplate, showNotification, loadTemplates]);

  // ---- Delete handler ----

  const handleDelete = useCallback(async () => {
    if (!deletingTemplate) return;
    try {
      const response = await apiDelete(buildEndpoint.projectTemplate(deletingTemplate.id));
      if (!response.ok) throw new Error('Failed to delete template');
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      showNotification?.('Template deleted', 'success');
    } catch (err) {
      logger.error('Failed to delete template:', err);
      showNotification?.('Failed to delete template', 'error');
    }
  }, [deletingTemplate, showNotification]);

  // ---- Toggle active ----

  const handleToggleActive = useCallback(async (template: ProjectTemplateItem) => {
    try {
      const response = await apiPut(buildEndpoint.projectTemplate(template.id), {
        isActive: !template.isActive
      });
      if (!response.ok) throw new Error('Failed to toggle template');
      setTemplates((prev) =>
        prev.map((t) => t.id === template.id ? { ...t, isActive: !t.isActive } : t)
      );
      showNotification?.(
        `Template ${!template.isActive ? 'activated' : 'deactivated'}`,
        'success'
      );
    } catch (err) {
      logger.error('Failed to toggle template:', err);
      showNotification?.('Failed to toggle template', 'error');
    }
  }, [showNotification]);

  return {
    // List state
    isLoading, error, templates,
    // Form state
    editingTemplate, formData, formSaving, formError, setFormData,
    // Delete state
    deletingTemplate, setDeletingTemplate,
    // Data fetching
    loadTemplates,
    // Actions
    handleToggleActive, handleDelete,
    // Form handlers
    prepareAddForm, prepareEditForm, handleFormSubmit
  };
}
