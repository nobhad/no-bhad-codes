/**
 * Project Actions Module
 * @file src/features/admin/project-details/actions.ts
 *
 * Handles project-level actions: delete, archive, duplicate, edit, contract signing.
 */

import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { getElement } from '../../../utils/dom-cache';
import {
  confirmDialog,
  confirmDanger,
  alertError
} from '../../../utils/confirm-dialog';
import { domCache } from './dom-cache';
import { formatDate } from '../../../utils/format-utils';
import type { ProjectResponse } from '../../../types/api';
import { initProjectModalDropdowns, setupEditProjectModalHandlers } from '../modules/admin-projects';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';

/**
 * Delete a project
 */
export async function deleteProject(
  projectId: number,
  projectsData: ProjectResponse[],
  onSuccess: () => void
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  const projectName = project?.project_name || 'this project';

  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${projectName}"? This action cannot be undone. All associated files, milestones, and invoices will also be deleted.`,
    'Delete',
    'Delete Project'
  );
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiDelete(`/api/projects/${projectId}`);

    if (response.ok) {
      showToast('Project deleted successfully', 'success');
      onSuccess();
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to delete project. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectActions] Error deleting project:', error);
    alertError('Failed to delete project. Please try again.');
  }
}

/**
 * Archive a project
 */
export async function archiveProject(
  projectId: number,
  projectsData: ProjectResponse[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  const projectName = project?.project_name || 'this project';

  const confirmed = await confirmDialog({
    title: 'Archive Project',
    message: `Archive "${projectName}"? The project will be moved to archived status and can be restored later.`,
    confirmText: 'Archive',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPut(`/api/projects/${projectId}`, {
      status: 'archived'
    });

    if (response.ok) {
      showToast('Project archived successfully', 'success');
      // Refresh project data to show updated status
      await loadProjects();
      showProjectDetail(projectId);
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to archive project. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectActions] Error archiving project:', error);
    alertError('Failed to archive project. Please try again.');
  }
}

/**
 * Duplicate a project
 */
export async function duplicateProject(
  projectId: number,
  projectsData: ProjectResponse[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  const confirmed = await confirmDialog({
    title: 'Duplicate Project',
    message: `Create a copy of "${project.project_name}"? This will create a new project with the same settings but no files or invoices.`,
    confirmText: 'Duplicate',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost('/api/projects', {
      project_name: `${project.project_name} (Copy)`,
      client_id: project.client_id,
      contact_name: project.contact_name,
      email: project.email,
      company_name: project.company_name,
      project_type: project.project_type,
      budget: project.budget,
      timeline: project.timeline,
      description: project.description,
      notes: project.notes,
      status: 'pending'
    });

    if (response.ok) {
      const result = await response.json();
      showToast('Project duplicated successfully', 'success');
      // Refresh projects list and show the new project
      await loadProjects();
      if (result.project?.id) {
        showProjectDetail(result.project.id);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to duplicate project. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectActions] Error duplicating project:', error);
    alertError('Failed to duplicate project. Please try again.');
  }
}

/**
 * Open the edit project modal with current project data
 */
export function openEditProjectModal(
  projectId: number,
  projectsData: ProjectResponse[],
  onSave: () => Promise<void>
): void {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  const modal = domCache.get('editModal');
  if (!modal) {
    console.error('[ProjectActions] Edit project modal not found');
    return;
  }

  // Ensure modal handlers and dropdown elements are initialized before populating
  // This prevents timing issues where selects are not created yet
  setupEditProjectModalHandlers(modal);
  initProjectModalDropdowns(project as any);

  // Populate form fields - query fresh since values change between openings
  const nameInput = getElement('edit-project-name') as HTMLInputElement;
  const typeSelect = getElement('edit-project-type') as HTMLSelectElement;
  const budgetInput = getElement('edit-project-budget') as HTMLInputElement;
  const priceInput = getElement('edit-project-price') as HTMLInputElement;
  const timelineInput = getElement('edit-project-timeline') as HTMLInputElement;
  const previewUrlInput = getElement('edit-project-preview-url') as HTMLInputElement;
  const statusSelect = getElement('edit-project-status') as HTMLSelectElement;
  const startDateInput = getElement('edit-project-start-date') as HTMLInputElement;
  const endDateInput = getElement('edit-project-end-date') as HTMLInputElement;
  const depositInput = getElement('edit-project-deposit') as HTMLInputElement;
  const contractDateInput = getElement('edit-project-contract-date') as HTMLInputElement;
  const repoUrlInput = getElement('edit-project-repo-url') as HTMLInputElement;
  const productionUrlInput = getElement('edit-project-production-url') as HTMLInputElement;
  const notesInput = getElement('edit-project-notes') as HTMLTextAreaElement;

  if (nameInput) nameInput.value = project.project_name || '';
  if (typeSelect) typeSelect.value = project.project_type || '';
  if (budgetInput) budgetInput.value = project.budget_range || '';
  if (priceInput) priceInput.value = project.price ? String(project.price) : '';
  if (timelineInput) timelineInput.value = project.timeline || '';
  if (previewUrlInput) previewUrlInput.value = project.preview_url || '';
  if (statusSelect) statusSelect.value = project.status || 'pending';
  if (startDateInput) startDateInput.value = project.start_date ? project.start_date.split('T')[0] : '';
  if (endDateInput) endDateInput.value = project.estimated_end_date ? project.estimated_end_date.split('T')[0] : '';
  if (depositInput) depositInput.value = project.deposit_amount ? String(project.deposit_amount) : '';
  if (contractDateInput) contractDateInput.value = project.contract_signed_at ? project.contract_signed_at.split('T')[0] : '';
  if (repoUrlInput) repoUrlInput.value = project.repository_url || '';
  if (productionUrlInput) productionUrlInput.value = project.production_url || '';
  if (notesInput) notesInput.value = project.notes || '';

  // Show modal and lock body scroll
  openModalOverlay(modal);

  // Setup close handlers (use cached refs)
  const closeBtn = domCache.get('editClose');
  const cancelBtn = domCache.get('editCancel');
  const form = domCache.getAs<HTMLFormElement>('editForm');

  const closeModal = () => {
    closeModalOverlay(modal);
  };

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  // Handle form submit
  if (form) {
    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      await onSave();
      closeModal();
    };
    form.removeEventListener('submit', handleSubmit);
    form.addEventListener('submit', handleSubmit, { once: true });
  }
}

/**
 * Save project changes from the edit modal
 */
export async function saveProjectChanges(
  projectId: number,
  loadProjects: () => Promise<void>,
  populateView: (project: ProjectResponse) => void,
  projectsData: ProjectResponse[]
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  // Form inputs - query fresh for current values
  const nameInput = getElement('edit-project-name') as HTMLInputElement;
  const typeSelect = getElement('edit-project-type') as HTMLSelectElement;
  const budgetInput = getElement('edit-project-budget') as HTMLInputElement;
  const priceInput = getElement('edit-project-price') as HTMLInputElement;
  const timelineInput = getElement('edit-project-timeline') as HTMLInputElement;
  const previewUrlInput = getElement('edit-project-preview-url') as HTMLInputElement;
  const statusSelect = getElement('edit-project-status') as HTMLSelectElement;
  const startDateInput = getElement('edit-project-start-date') as HTMLInputElement;
  const endDateInput = getElement('edit-project-end-date') as HTMLInputElement;
  const depositInput = getElement('edit-project-deposit') as HTMLInputElement;
  const contractDateInput = getElement('edit-project-contract-date') as HTMLInputElement;
  const repoUrlInput = getElement('edit-project-repo-url') as HTMLInputElement;
  const productionUrlInput = getElement('edit-project-production-url') as HTMLInputElement;
  const notesInput = getElement('edit-project-notes') as HTMLTextAreaElement;

  const updates: Record<string, string> = {};
  if (nameInput?.value) updates.project_name = nameInput.value;
  if (typeSelect?.value) updates.project_type = typeSelect.value;
  if (budgetInput?.value) updates.budget = budgetInput.value;
  if (priceInput?.value) updates.price = priceInput.value;
  if (timelineInput?.value) updates.timeline = timelineInput.value;
  if (previewUrlInput?.value !== undefined) updates.preview_url = previewUrlInput.value;
  if (statusSelect?.value) updates.status = statusSelect.value;
  if (startDateInput?.value !== undefined) updates.start_date = startDateInput.value;
  if (endDateInput?.value !== undefined) updates.estimated_end_date = endDateInput.value;
  if (depositInput?.value !== undefined) updates.deposit_amount = depositInput.value;
  if (contractDateInput?.value !== undefined) updates.contract_signed_at = contractDateInput.value;
  if (repoUrlInput?.value !== undefined) updates.repository_url = repoUrlInput.value;
  if (productionUrlInput?.value !== undefined) updates.production_url = productionUrlInput.value;
  if (notesInput?.value !== undefined) updates.notes = notesInput.value;

  try {
    const response = await apiPut(`/api/projects/${projectId}`, updates);

    if (response.ok) {
      // Refresh project data
      await loadProjects();
      // Re-populate the view
      const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
      if (project) {
        populateView(project);
      }
    } else {
      alertError('Failed to save project. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectActions] Error saving project:', error);
    alertError('Failed to save project. Please try again.');
  }
}

/**
 * Handle contract sign button click
 */
export async function handleContractSign(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  if (project.contract_signed_at) {
    // Contract already signed - show signature info
    showToast(`Contract signed on ${formatDate(project.contract_signed_at)}`, 'info');
    return;
  }

  // Contract not signed - request signature
  const confirmed = await confirmDialog({
    title: 'Request Contract Signature',
    message: `Send a contract signature request to ${project.client_name || 'the client'}?\n\nThe client will receive an email with a link to review and sign the contract.`,
    confirmText: 'Send Request',
    cancelText: 'Cancel',
    icon: 'question'
  });

  if (!confirmed) return;

  try {
    const response = await apiFetch(`/api/projects/${projectId}/contract/request-signature`, {
      method: 'POST'
    });

    if (response.ok) {
      showToast('Signature request sent successfully', 'success');
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to send signature request', 'error');
    }
  } catch (error) {
    console.error('Error requesting signature:', error);
    showToast('Failed to send signature request', 'error');
  }
}
