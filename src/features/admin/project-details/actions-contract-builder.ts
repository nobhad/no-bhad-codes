/**
 * Contract Builder Modal
 * @file src/features/admin/project-details/actions-contract-builder.ts
 *
 * Contract builder UI: modal, template loading, section editing, and draft saving.
 * Extracted from actions-contracts.ts for maintainability.
 */

import { apiFetch, apiPost, apiPut, parseApiResponse } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { alertSuccess } from '../../../utils/confirm-dialog';
import type { ProjectResponse } from '../../../types/api';
import {
  createRichTextEditor,
  htmlToPlainText,
  plainTextToHTML,
  type RichTextEditorInstance
} from '../../../components/rich-text-editor';
import { ICONS } from '../../../constants/icons';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ContractBuilder');

interface ContractTemplateOption {
  id: number;
  name: string;
  type: string;
}

/**
 * Show the contract builder modal
 */
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
    icon: ICONS.FILE,
    onClose: () => modal.hide()
  });

  modal.body.innerHTML = buildContractBuilderHTML();
  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="contract-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-secondary" id="contract-save-draft">Save Draft</button>
  `;

  document.body.appendChild(modal.overlay);
  modal.show();

  await setupContractBuilderListeners(modal, project, projectId);
}

function buildContractBuilderHTML(): string {
  return `
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
}

async function setupContractBuilderListeners(
  modal: { body: HTMLElement; footer: HTMLElement; hide: () => void; overlay: HTMLElement },
  project: ProjectResponse,
  projectId: number
): Promise<void> {
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

  if (variablesContainer && editor) {
    variablesContainer.querySelectorAll('.rich-text-variable-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const variable = (btn as HTMLElement).dataset.variable;
        if (variable) editor?.insertVariable(variable);
      });
    });
  }

  const buildDraftFromSections = (): string => {
    const getValue = (id: string): string =>
      (modal.body.querySelector(`#${id}`) as HTMLTextAreaElement | null)?.value.trim() || '';

    const sections = [
      { title: 'Project Overview', body: `Project: ${project.project_name || ''}\nClient: ${project.client_name || project.contact_name || ''}` },
      { title: 'Scope', body: getValue('contract-section-scope') },
      { title: 'Timeline', body: getValue('contract-section-timeline') },
      { title: 'Payment', body: getValue('contract-section-payment') },
      { title: 'IP Rights', body: getValue('contract-section-ip') },
      { title: 'Termination', body: getValue('contract-section-termination') }
    ];

    return sections
      .filter((section) => section.body.trim())
      .map((section) => `${section.title}\n${section.body}`)
      .join('\n\n');
  };

  // Populate templates
  if (templateSelect) {
    try {
      const response = await apiFetch('/api/contracts/templates');
      if (response.ok) {
        const data = await parseApiResponse<{ templates: ContractTemplateOption[] }>(response);
        const templates: ContractTemplateOption[] = data.templates || [];
        templates.forEach((template) => {
          const option = document.createElement('option');
          option.value = String(template.id);
          option.textContent = `${template.name} (${template.type})`;
          templateSelect.appendChild(option);
        });
      } else {
        showToast('Failed to load contract templates', 'error');
      }
    } catch (error) {
      logger.error(' Error loading templates:', error);
      showToast('Failed to load contract templates', 'error');
    }
  }

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
        const htmlContent = plainTextToHTML(contract?.content || '');
        editor.setHTML(htmlContent);
        updatePreview(contract?.content || '');
      }
      const templateLabel = document.getElementById('pd-contract-template-label');
      if (templateLabel && templateSelect) {
        templateLabel.textContent =
          templateSelect.options[templateSelect.selectedIndex]?.textContent || 'Template applied';
      }
      const draftStatus = document.getElementById('pd-contract-draft-status');
      if (draftStatus) draftStatus.textContent = 'Draft loaded';
      alertSuccess('Contract draft created from template');
    } catch (error) {
      logger.error(' Error applying template:', error);
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
      logger.error(' Error saving draft:', error);
      showToast('Failed to save draft', 'error');
    }
  });
}
