/**
 * Project Actions Module
 * @file src/features/admin/project-details/actions.ts
 *
 * Handles project-level actions: delete, archive, duplicate, edit, contract signing.
 */

import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost, apiPut, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { getElement } from '../../../utils/dom-cache';
import {
  confirmDialog,
  confirmDanger,
  alertError,
  alertSuccess
} from '../../../utils/confirm-dialog';
import { domCache } from './dom-cache';
import { formatDate } from '../../../utils/format-utils';
import type { ProjectResponse } from '../../../types/api';
import { initProjectModalDropdowns, setupEditProjectModalHandlers } from '../modules/admin-projects';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { createRichTextEditor, htmlToPlainText, plainTextToHTML, type RichTextEditorInstance } from '../../../components/rich-text-editor';

/** Base project type for action functions - compatible with both LeadProject and ProjectResponse */
interface ProjectBase {
  id: number;
  project_name?: string;
  client_id?: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  project_type?: string;
  budget_range?: string;
  budget?: number;
  timeline?: string;
  description?: string;
  notes?: string;
}

interface ContractTemplateOption {
  id: number;
  name: string;
  type: string;
}

/**
 * Delete a project
 */
export async function deleteProject(
  projectId: number,
  projectsData: ProjectBase[],
  onSuccess: () => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
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
  projectsData: ProjectBase[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
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
  projectsData: ProjectBase[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
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
      const result = await parseApiResponse<{ project: ProjectResponse }>(response);
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
  initProjectModalDropdowns(project);

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

/**
 * Handle contract countersign (admin)
 */
export async function handleContractCountersign(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  if (!project.contract_signed_at) {
    showToast('Client signature is required before countersigning.', 'warning');
    return;
  }

  if (project.contract_countersigned_at) {
    showToast('Contract already countersigned.', 'info');
    return;
  }

  const { createPortalModal } = await import('../../../components/portal-modal');

  const modal = createPortalModal({
    id: 'contract-countersign-modal',
    titleId: 'contract-countersign-title',
    title: 'Countersign Contract',
    contentClassName: 'contract-countersign-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const form = document.createElement('form');
  form.className = 'contract-countersign-form';
  form.innerHTML = `
    <div class="portal-form-group">
      <label for="contract-countersign-name">Signer Name</label>
      <input class="portal-input" id="contract-countersign-name" name="signerName" placeholder="Your name" required />
    </div>
    <div class="contract-signature-pad">
      <div class="signature-canvas-wrap">
        <canvas id="contract-countersign-canvas" width="520" height="180"></canvas>
      </div>
      <div class="signature-actions">
        <button type="button" class="btn btn-outline" id="contract-countersign-clear">Clear</button>
      </div>
      <p class="signature-hint">Draw your signature above using your mouse or trackpad.</p>
    </div>
  `;

  modal.body.appendChild(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    modal.hide();
    modal.overlay.remove();
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Countersign';

  modal.footer.appendChild(cancelBtn);
  modal.footer.appendChild(submitBtn);

  document.body.appendChild(modal.overlay);
  modal.show();

  const canvas = form.querySelector('#contract-countersign-canvas') as HTMLCanvasElement | null;
  const clearBtn = form.querySelector('#contract-countersign-clear') as HTMLButtonElement | null;
  const nameInput = form.querySelector('#contract-countersign-name') as HTMLInputElement | null;

  if (!canvas || !clearBtn || !nameInput) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let isDrawing = false;
  let hasSignature = false;

  // eslint-disable-next-line no-undef
  const strokeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--portal-text-light')
    .trim();
  ctx.strokeStyle = strokeColor || 'currentColor';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const getPosition = (event: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const touch = event.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDrawing = (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    isDrawing = true;
    const { x, y } = getPosition(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    event.preventDefault();
    const { x, y } = getPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasSignature = true;
  };

  const stopDrawing = () => {
    isDrawing = false;
  };

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!nameInput.value.trim()) {
      alertError('Signer name is required.');
      return;
    }

    if (!hasSignature) {
      alertError('Please draw your signature before submitting.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const response = await apiFetch(`/api/projects/${projectId}/contract/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: nameInput.value.trim(),
          signatureData: canvas.toDataURL('image/png')
        })
      });

      if (response.ok) {
        showToast('Contract countersigned successfully.', 'success');
        modal.hide();
        modal.overlay.remove();
      } else {
        const error = await response.json().catch(() => ({}));
        alertError(error.error || 'Failed to countersign contract.');
      }
    } catch (error) {
      console.error('[ProjectActions] Error countersigning contract:', error);
      alertError('Failed to countersign contract. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Countersign';
    }
  });
}

export async function showContractBuilder(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  const { createPortalModal } = await import('../../../components/portal-modal');

  const modal = createPortalModal({
    id: 'contract-builder-modal',
    titleId: 'contract-builder-title',
    title: 'Contract Builder',
    onClose: () => modal.hide()
  });

  modal.body.innerHTML = `
    <div class="contract-builder-grid">
      <div class="contract-builder-form">
        <div class="form-group">
          <label class="form-label" for="contract-template-select">Template</label>
          <div class="contract-template-row">
            <select id="contract-template-select" class="form-input">
              <option value="">Select a template</option>
            </select>
            <button type="button" class="btn btn-outline" id="contract-template-load">Load Template</button>
            <button type="button" class="btn btn-outline" id="contract-template-clear">Start Blank</button>
          </div>
          <p class="form-help">Templates apply variables like {{client.name}} and {{project.name}} automatically.</p>
        </div>

        <div class="contract-builder-sections">
          <div class="form-group">
            <label class="form-label" for="contract-section-scope">Scope</label>
            <textarea id="contract-section-scope" class="form-input contract-builder-textarea" rows="4" placeholder="Outline the project scope..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="contract-section-timeline">Timeline</label>
            <textarea id="contract-section-timeline" class="form-input contract-builder-textarea" rows="3" placeholder="Timeline expectations and milestones..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="contract-section-payment">Payment</label>
            <textarea id="contract-section-payment" class="form-input contract-builder-textarea" rows="3" placeholder="Payment schedule and terms..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="contract-section-ip">IP Rights</label>
            <textarea id="contract-section-ip" class="form-input contract-builder-textarea" rows="3" placeholder="Ownership and IP transfer details..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="contract-section-termination">Termination</label>
            <textarea id="contract-section-termination" class="form-input contract-builder-textarea" rows="3" placeholder="Termination clauses and notice period..."></textarea>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Contract Draft</label>
          <div id="contract-editor-container"></div>
          <div class="rich-text-variables" id="contract-variables">
            <span class="rich-text-variables-label">Insert variable:</span>
            <button type="button" class="rich-text-variable-btn" data-variable="client.name">client.name</button>
            <button type="button" class="rich-text-variable-btn" data-variable="client.company">client.company</button>
            <button type="button" class="rich-text-variable-btn" data-variable="project.name">project.name</button>
            <button type="button" class="rich-text-variable-btn" data-variable="project.price">project.price</button>
            <button type="button" class="rich-text-variable-btn" data-variable="date.today">date.today</button>
          </div>
        </div>
      </div>

      <div class="contract-builder-preview">
        <div class="contract-preview-header">
          <h4>Preview</h4>
          <button type="button" class="btn btn-outline" id="contract-generate-draft">Generate Draft</button>
        </div>
        <div class="contract-preview-body" id="contract-preview">Draft content will appear here.</div>
      </div>
    </div>
  `;

  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="contract-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-secondary" id="contract-save-draft">Save Draft</button>
  `;

  document.body.appendChild(modal.overlay);
  modal.show();

  const templateSelect = modal.body.querySelector('#contract-template-select') as HTMLSelectElement | null;
  const templateLoadBtn = modal.body.querySelector('#contract-template-load') as HTMLButtonElement | null;
  const templateClearBtn = modal.body.querySelector('#contract-template-clear') as HTMLButtonElement | null;
  const editorContainer = modal.body.querySelector('#contract-editor-container') as HTMLElement | null;
  const variablesContainer = modal.body.querySelector('#contract-variables') as HTMLElement | null;
  const previewBody = modal.body.querySelector('#contract-preview') as HTMLElement | null;
  const generateBtn = modal.body.querySelector('#contract-generate-draft') as HTMLButtonElement | null;
  const cancelBtn = modal.footer.querySelector('#contract-cancel-btn') as HTMLButtonElement | null;
  const saveDraftBtn = modal.footer.querySelector('#contract-save-draft') as HTMLButtonElement | null;

  let contractId: number | null = null;
  let currentTemplateId: number | null = null;
  let editor: RichTextEditorInstance | null = null;

  const updatePreview = (value: string) => {
    if (!previewBody) return;
    previewBody.textContent = value.trim() ? value : 'Draft content will appear here.';
  };

  // Initialize rich text editor
  if (editorContainer) {
    editor = createRichTextEditor({
      container: editorContainer,
      placeholder: 'Build or paste your contract text...',
      height: '300px',
      toolbarOptions: 'standard',
      onChange: (content) => {
        updatePreview(htmlToPlainText(content));
      }
    });
  }

  // Setup variable insertion buttons
  if (variablesContainer && editor) {
    variablesContainer.querySelectorAll('.rich-text-variable-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const variable = (btn as HTMLElement).dataset.variable;
        if (variable) {
          editor?.insertVariable(variable);
        }
      });
    });
  }

  const buildDraftFromSections = (): string => {
    const scope = (modal.body.querySelector('#contract-section-scope') as HTMLTextAreaElement | null)?.value.trim();
    const timeline = (modal.body.querySelector('#contract-section-timeline') as HTMLTextAreaElement | null)?.value.trim();
    const payment = (modal.body.querySelector('#contract-section-payment') as HTMLTextAreaElement | null)?.value.trim();
    const ipRights = (modal.body.querySelector('#contract-section-ip') as HTMLTextAreaElement | null)?.value.trim();
    const termination = (modal.body.querySelector('#contract-section-termination') as HTMLTextAreaElement | null)?.value.trim();

    const sections = [
      { title: 'Project Overview', body: `Project: ${project.project_name || ''}\nClient: ${project.client_name || project.contact_name || ''}` },
      { title: 'Scope', body: scope || '' },
      { title: 'Timeline', body: timeline || '' },
      { title: 'Payment', body: payment || '' },
      { title: 'IP Rights', body: ipRights || '' },
      { title: 'Termination', body: termination || '' }
    ];

    return sections
      .filter(section => section.body.trim())
      .map(section => `${section.title}\n${section.body}`)
      .join('\n\n');
  };

  const populateTemplates = async () => {
    if (!templateSelect) return;
    try {
      const response = await apiFetch('/api/contracts/templates');
      if (!response.ok) {
        showToast('Failed to load contract templates', 'error');
        return;
      }
      const data = await parseApiResponse<{ templates: ContractTemplateOption[] }>(response);
      const templates: ContractTemplateOption[] = data.templates || [];
      templates.forEach((template) => {
        const option = document.createElement('option');
        option.value = String(template.id);
        option.textContent = `${template.name} (${template.type})`;
        templateSelect.appendChild(option);
      });
    } catch (error) {
      console.error('[ContractBuilder] Error loading templates:', error);
      showToast('Failed to load contract templates', 'error');
    }
  };

  await populateTemplates();

  templateSelect?.addEventListener('change', () => {
    currentTemplateId = templateSelect.value ? Number(templateSelect.value) : null;
  });

  templateLoadBtn?.addEventListener('click', async () => {
    if (!currentTemplateId) {
      showToast('Select a template first', 'info');
      return;
    }
    try {
      const response = await apiPost('/api/contracts/from-template', {
        templateId: currentTemplateId,
        projectId,
        clientId: project.client_id,
        status: 'draft'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        showToast(error.message || 'Failed to apply template', 'error');
        return;
      }

      const data = await parseApiResponse<{ contract: { id: number; content: string } }>(response);
      const contract = data.contract;
      contractId = contract?.id || null;
      if (editor) {
        // Convert plain text to HTML for the editor
        const htmlContent = plainTextToHTML(contract?.content || '');
        editor.setHTML(htmlContent);
        updatePreview(contract?.content || '');
      }
      const templateLabel = document.getElementById('pd-contract-template-label');
      if (templateLabel && templateSelect) templateLabel.textContent = templateSelect.options[templateSelect.selectedIndex]?.textContent || 'Template applied';
      const draftStatus = document.getElementById('pd-contract-draft-status');
      if (draftStatus) draftStatus.textContent = 'Draft loaded';
      alertSuccess('Contract draft created from template');
    } catch (error) {
      console.error('[ContractBuilder] Error applying template:', error);
      showToast('Failed to apply template', 'error');
    }
  });

  templateClearBtn?.addEventListener('click', () => {
    if (editor) {
      editor.setText('');
      updatePreview('');
    }
    contractId = null;
  });

  generateBtn?.addEventListener('click', () => {
    const draft = buildDraftFromSections();
    if (editor) {
      const htmlContent = plainTextToHTML(draft);
      editor.setHTML(htmlContent);
      updatePreview(draft);
    }
  });

  cancelBtn?.addEventListener('click', () => {
    editor?.destroy();
    modal.hide();
  });

  saveDraftBtn?.addEventListener('click', async () => {
    const editorContent = editor?.getHTML() || '';
    const plainTextContent = htmlToPlainText(editorContent);
    if (!plainTextContent.trim()) {
      showToast('Add contract content before saving', 'error');
      return;
    }

    try {
      const payload = {
        templateId: currentTemplateId,
        projectId,
        clientId: project.client_id,
        content: plainTextContent,
        status: 'draft'
      };

      const response = contractId
        ? await apiPut(`/api/contracts/${contractId}`, payload)
        : await apiPost('/api/contracts', payload);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        showToast(error.message || 'Failed to save draft', 'error');
        return;
      }

      const data = await parseApiResponse<{ contract: { id: number } }>(response);
      contractId = data.contract?.id || contractId;
      const draftStatus = document.getElementById('pd-contract-draft-status');
      if (draftStatus) draftStatus.textContent = 'Draft saved';
      alertSuccess('Contract draft saved');
    } catch (error) {
      console.error('[ContractBuilder] Error saving draft:', error);
      showToast('Failed to save draft', 'error');
    }
  });
}
