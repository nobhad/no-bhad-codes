/**
 * ===============================================
 * ADMIN QUESTIONNAIRES MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-questionnaires.ts
 *
 * Admin UI for questionnaires: list, create/edit, send to clients,
 * view responses. Uses /api/questionnaires endpoints.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDanger } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction } from '../../../factories';
import { getStatusDotHTML } from '../../../components/status-badge';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminQuestionnaires');

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn =
  typeof import('../../../react/features/admin/questionnaires').mountQuestionnairesTable;
type ReactUnmountFn =
  typeof import('../../../react/features/admin/questionnaires').unmountQuestionnairesTable;

let mountQuestionnairesTable: ReactMountFn | null = null;
let unmountQuestionnairesTable: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (
    !reactMountContainer ||
    !reactMountContainer.isConnected ||
    reactMountContainer.children.length === 0
  ) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Lazy load React mount functions */
async function loadReactQuestionnairesTable(): Promise<boolean> {
  if (mountQuestionnairesTable && unmountQuestionnairesTable) return true;

  try {
    const module = await import('../../../react/features/admin/questionnaires');
    mountQuestionnairesTable = module.mountQuestionnairesTable;
    unmountQuestionnairesTable = module.unmountQuestionnairesTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Feature flag for React questionnaires table */
function shouldUseReactQuestionnairesTable(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_questionnaires') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_questionnaires_table');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}

const QUESTIONNAIRES_API = '/api/questionnaires';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';
type ResponseStatus = 'pending' | 'in_progress' | 'completed';

interface Question {
  id: string;
  type: QuestionType;
  question: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  conditionalOn?: {
    questionId: string;
    value: string | string[];
  };
}

interface Questionnaire {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  questions: Question[];
  is_active: boolean;
  auto_send_on_project_create: boolean;
  display_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  client_id: number;
  project_id?: number;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  reminder_count: number;
  created_at: string;
  questionnaire_name?: string;
  client_name?: string;
  project_name?: string;
}

interface ClientOption {
  id: number;
  company_name?: string;
  contact_name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// DOM Helpers
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

function statusLabel(status: ResponseStatus): string {
  const map: Record<ResponseStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed'
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Module State
// ---------------------------------------------------------------------------

let questionnairesCache: Questionnaire[] = [];
let responsesCache: QuestionnaireResponse[] = [];
let listenersSetup = false;
let editingQuestionnaireId: number | null = null;
let questionsData: Question[] = [];
let questionCounter = 0;

let modalFocusCleanup: (() => void) | null = null;
let sendModalFocusCleanup: (() => void) | null = null;
let viewResponseModalFocusCleanup: (() => void) | null = null;
let clientDropdownInit = false;

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

async function loadQuestionnaires(): Promise<Questionnaire[]> {
  const res = await apiFetch(QUESTIONNAIRES_API);
  if (!res.ok) return [];
  const data = await parseApiResponse<{ questionnaires: Questionnaire[] }>(res);
  return data.questionnaires || [];
}

async function loadPendingResponses(): Promise<QuestionnaireResponse[]> {
  const res = await apiFetch(`${QUESTIONNAIRES_API}/responses/pending`);
  if (!res.ok) return [];
  const data = await parseApiResponse<{ responses: QuestionnaireResponse[] }>(res);
  return data.responses || [];
}

async function loadClients(): Promise<ClientOption[]> {
  const res = await apiFetch('/api/clients');
  if (!res.ok) return [];
  const data = await parseApiResponse<{ clients: ClientOption[] }>(res);
  return data.clients || [];
}

// ---------------------------------------------------------------------------
// Questionnaires Table
// ---------------------------------------------------------------------------

const QUESTIONNAIRES_COLSPAN = 5;

function renderQuestionnairesTable(questionnaires: Questionnaire[]): void {
  const tbody = el('questionnaires-table-body');
  if (!tbody) return;

  if (questionnaires.length === 0) {
    showTableEmpty(
      tbody,
      QUESTIONNAIRES_COLSPAN,
      'No questionnaires found. Create one to get started.'
    );
    return;
  }

  tbody.innerHTML = questionnaires
    .map(
      (q) => `
    <tr data-questionnaire-id="${q.id}">
      <td class="name-cell" data-label="Name">${escapeHtml(q.name)}</td>
      <td class="name-cell" data-label="Description">${escapeHtml(q.description || '—')}</td>
      <td class="type-cell" data-label="Project Type">${q.project_type ? escapeHtml(q.project_type) : 'All'}</td>
      <td class="status-cell" data-label="Status">${getStatusDotHTML(q.is_active ? 'active' : 'inactive')}</td>
      <td class="actions-cell" data-label="Actions">
        ${renderActionsCell([
    createAction('edit', q.id, { className: 'questionnaire-edit' }),
    createAction('send', q.id, {
      className: 'questionnaire-send',
      title: 'Send to client',
      ariaLabel: 'Send to client'
    }),
    createAction('delete', q.id, {
      className: 'questionnaire-delete',
      dataAttrs: { name: escapeHtml(q.name) }
    })
  ])}
      </td>
    </tr>
  `
    )
    .join('');

  // Initialize keyboard navigation
  initTableKeyboardNav({
    tableSelector: '#questionnaires-table-body',
    rowSelector: 'tr[data-questionnaire-id]',
    onRowSelect: (row) => {
      const editBtn = row.querySelector('.questionnaire-edit') as HTMLButtonElement;
      if (editBtn) editBtn.click();
    },
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });
}

// ---------------------------------------------------------------------------
// Responses Table
// ---------------------------------------------------------------------------

const RESPONSES_COLSPAN = 5;

function renderResponsesTable(responses: QuestionnaireResponse[]): void {
  const tbody = el('responses-table-body');
  if (!tbody) return;

  if (responses.length === 0) {
    showTableEmpty(tbody, RESPONSES_COLSPAN, 'No pending responses.');
    return;
  }

  tbody.innerHTML = responses
    .map(
      (r) => `
    <tr data-response-id="${r.id}">
      <td class="name-cell" data-label="Questionnaire">${escapeHtml(r.questionnaire_name || `#${r.questionnaire_id}`)}</td>
      <td class="name-cell" data-label="Client">${escapeHtml(SanitizationUtils.decodeHtmlEntities(r.client_name || String(r.client_id)))}</td>
      <td class="status-cell" data-label="Status">${getStatusDotHTML(r.status, { label: statusLabel(r.status) })}</td>
      <td class="date-cell" data-label="Due Date">${formatDate(r.due_date)}</td>
      <td class="actions-cell" data-label="Actions">
        ${renderActionsCell([
    createAction('view', r.id, { className: 'response-view', ariaLabel: 'View response' }),
    createAction('remind', r.id, { className: 'response-remind' }),
    createAction('delete', r.id, {
      className: 'response-delete',
      ariaLabel: 'Delete response'
    })
  ])}
      </td>
    </tr>
  `
    )
    .join('');

  // Initialize keyboard navigation
  initTableKeyboardNav({
    tableSelector: '#responses-table-body',
    rowSelector: 'tr[data-response-id]',
    onRowSelect: (row) => {
      const viewBtn = row.querySelector('.response-view') as HTMLButtonElement;
      if (viewBtn) viewBtn.click();
    },
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });
}

// ---------------------------------------------------------------------------
// Create/Edit Modal
// ---------------------------------------------------------------------------

function openQuestionnaireModal(questionnaire?: Questionnaire): void {
  const modal = el('questionnaire-modal');
  const titleEl = el('questionnaire-modal-title');
  if (!modal || !titleEl) return;

  editingQuestionnaireId = questionnaire?.id || null;
  titleEl.textContent = questionnaire ? 'Edit Questionnaire' : 'Create Questionnaire';

  // Reset form
  const form = el('questionnaire-form') as HTMLFormElement;
  if (form) form.reset();

  // Populate form if editing
  const nameInput = el('questionnaire-name') as HTMLInputElement;
  const descInput = el('questionnaire-description') as HTMLTextAreaElement;
  const projectTypeSelect = el('questionnaire-project-type') as HTMLSelectElement;
  const activeCheckbox = el('questionnaire-active') as HTMLInputElement;
  const autoSendCheckbox = el('questionnaire-auto-send') as HTMLInputElement;

  if (questionnaire) {
    if (nameInput) nameInput.value = questionnaire.name;
    if (descInput) descInput.value = questionnaire.description || '';
    if (projectTypeSelect) projectTypeSelect.value = questionnaire.project_type || '';
    if (activeCheckbox) activeCheckbox.checked = questionnaire.is_active;
    if (autoSendCheckbox) autoSendCheckbox.checked = questionnaire.auto_send_on_project_create;
    questionsData = [...questionnaire.questions];
  } else {
    questionsData = [];
  }

  renderQuestionsBuilder();

  openModalOverlay(modal);
  modalFocusCleanup = manageFocusTrap(modal, {});
}

function closeQuestionnaireModal(): void {
  const modal = el('questionnaire-modal');
  if (modal) {
    closeModalOverlay(modal);
    modalFocusCleanup?.();
    modalFocusCleanup = null;
    editingQuestionnaireId = null;
    questionsData = [];
  }
}

/**
 * Render conditional logic builder for a question
 */
function renderConditionalBuilder(question: Question, index: number): string {
  // Can't set condition on first question or reference itself
  const availableQuestions = questionsData
    .slice(0, index)
    .filter((q) => q.type === 'select' || q.type === 'multiselect');

  if (availableQuestions.length === 0) {
    return ''; // No eligible parent questions
  }

  const hasCondition = Boolean(question.conditionalOn);
  const selectedQuestionId = question.conditionalOn?.questionId || '';
  const selectedValue = question.conditionalOn?.value || '';
  const selectedValueStr = Array.isArray(selectedValue) ? selectedValue.join(', ') : selectedValue;

  // Get options for the selected parent question
  const parentQuestion = selectedQuestionId
    ? questionsData.find((q) => q.id === selectedQuestionId)
    : null;
  const parentOptions = parentQuestion?.options || [];

  return `
    <div class="question-conditional">
      <label class="question-conditional-toggle">
        <input type="checkbox" class="conditional-enabled" data-index="${index}" ${hasCondition ? 'checked' : ''} />
        Show only if...
      </label>
      <div class="question-conditional-config" style="${hasCondition ? '' : 'display: none;'}">
        <select class="conditional-question-select" data-index="${index}">
          <option value="">Select a question...</option>
          ${availableQuestions
    .map(
      (q, qIndex) => `
            <option value="${q.id}" ${selectedQuestionId === q.id ? 'selected' : ''}>
              Q${qIndex + 1}: ${escapeHtml(q.question.substring(0, 40))}${q.question.length > 40 ? '...' : ''}
            </option>
          `
    )
    .join('')}
        </select>
        ${
  parentOptions.length > 0
    ? `
          <span class="conditional-equals">=</span>
          <select class="conditional-value-select" data-index="${index}">
            <option value="">Select answer...</option>
            ${parentOptions
    .map(
      (opt) => `
              <option value="${escapeHtml(opt)}" ${selectedValueStr === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>
            `
    )
    .join('')}
          </select>
        `
    : ''
}
      </div>
    </div>
  `;
}

function renderQuestionsBuilder(): void {
  const container = el('questions-builder');
  if (!container) return;

  if (questionsData.length === 0) {
    container.innerHTML =
      '<div class="empty-state">No questions added yet. Click "Add Question" to start.</div>';
    return;
  }

  container.innerHTML = questionsData
    .map(
      (q, index) => `
    <div class="question-item" data-question-index="${index}">
      <div class="question-item-header">
        <span class="question-number">${index + 1}.</span>
        <select class="question-type-select" data-index="${index}">
          <option value="text" ${q.type === 'text' ? 'selected' : ''}>Short Text</option>
          <option value="textarea" ${q.type === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="select" ${q.type === 'select' ? 'selected' : ''}>Single Choice</option>
          <option value="multiselect" ${q.type === 'multiselect' ? 'selected' : ''}>Multiple Choice</option>
          <option value="number" ${q.type === 'number' ? 'selected' : ''}>Number</option>
        </select>
        <label class="question-required-label">
          <input type="checkbox" class="question-required" data-index="${index}" ${q.required ? 'checked' : ''} />
          Required
        </label>
        <button type="button" class="icon-btn question-remove" data-index="${index}" title="Remove question">
          ${ICONS.TRASH}
        </button>
      </div>
      <div class="question-item-body flex flex-col gap-2">
        <input type="text" class="question-text" data-index="${index}" value="${escapeHtml(q.question)}" placeholder="Enter your question..." />
        ${
  ['select', 'multiselect'].includes(q.type)
    ? `
          <div class="question-options flex flex-col gap-1">
            <label>Options (one per line)</label>
            <textarea class="question-options-input" data-index="${index}" rows="3" placeholder="Option 1&#10;Option 2&#10;Option 3">${(q.options || []).join('\n')}</textarea>
          </div>
        `
    : ''
}
        ${renderConditionalBuilder(q, index)}
      </div>
    </div>
  `
    )
    .join('');
}

function addQuestion(): void {
  questionCounter++;
  const newQuestion: Question = {
    id: `q_${Date.now()}_${questionCounter}`,
    type: 'text',
    question: '',
    required: false,
    options: []
  };
  questionsData.push(newQuestion);
  renderQuestionsBuilder();
}

function removeQuestion(index: number): void {
  questionsData.splice(index, 1);
  renderQuestionsBuilder();
}

function updateQuestionField(index: number, field: keyof Question, value: unknown): void {
  if (questionsData[index]) {
    (questionsData[index] as unknown as Record<string, unknown>)[field] = value;
    if (field === 'type') {
      renderQuestionsBuilder();
    }
  }
}

async function saveQuestionnaire(): Promise<void> {
  const nameInput = el('questionnaire-name') as HTMLInputElement;
  const descInput = el('questionnaire-description') as HTMLTextAreaElement;
  const projectTypeSelect = el('questionnaire-project-type') as HTMLSelectElement;
  const activeCheckbox = el('questionnaire-active') as HTMLInputElement;
  const autoSendCheckbox = el('questionnaire-auto-send') as HTMLInputElement;

  if (!nameInput?.value.trim()) {
    showToast('Please enter a name', 'error');
    return;
  }

  if (questionsData.length === 0) {
    showToast('Please add at least one question', 'error');
    return;
  }

  // Validate questions
  for (const q of questionsData) {
    if (!q.question.trim()) {
      showToast('Please fill in all question texts', 'error');
      return;
    }
    if (['select', 'multiselect'].includes(q.type) && (!q.options || q.options.length === 0)) {
      showToast('Please add options for choice questions', 'error');
      return;
    }
  }

  const payload = {
    name: nameInput.value.trim(),
    description: descInput?.value.trim() || null,
    project_type: projectTypeSelect?.value || null,
    questions: questionsData,
    is_active: activeCheckbox?.checked ?? true,
    auto_send_on_project_create: autoSendCheckbox?.checked ?? false
  };

  try {
    let response: Response;
    if (editingQuestionnaireId) {
      response = await apiPut(`${QUESTIONNAIRES_API}/${editingQuestionnaireId}`, payload);
    } else {
      response = await apiPost(QUESTIONNAIRES_API, payload);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    showToast(
      editingQuestionnaireId ? 'Questionnaire updated' : 'Questionnaire created',
      'success'
    );
    closeQuestionnaireModal();
    await refreshQuestionnaires();
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Send Modal
// ---------------------------------------------------------------------------

function openSendModal(questionnaireId: number): void {
  const modal = el('send-questionnaire-modal');
  const idInput = el('send-questionnaire-id') as HTMLInputElement;
  if (!modal || !idInput) return;

  idInput.value = String(questionnaireId);

  // Load clients
  loadClients().then((clients) => {
    const select = el('send-questionnaire-client') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Select a client...</option>';
      clients.forEach((c) => {
        const option = document.createElement('option');
        option.value = String(c.id);
        option.textContent = c.company_name || c.contact_name || c.email || String(c.id);
        select.appendChild(option);
      });

      if (!clientDropdownInit) {
        initModalDropdown(select);
        clientDropdownInit = true;
      }
    }
  });

  openModalOverlay(modal);
  sendModalFocusCleanup = manageFocusTrap(modal, {});
}

function closeSendModal(): void {
  const modal = el('send-questionnaire-modal');
  if (modal) {
    closeModalOverlay(modal);
    sendModalFocusCleanup?.();
    sendModalFocusCleanup = null;
  }
}

async function sendQuestionnaire(): Promise<void> {
  const idInput = el('send-questionnaire-id') as HTMLInputElement;
  const clientSelect = el('send-questionnaire-client') as HTMLSelectElement;
  const dueInput = el('send-questionnaire-due') as HTMLInputElement;

  // Get client value from hidden input (custom dropdown) or native select
  const clientHiddenInput = document.querySelector(
    'input[type="hidden"][id="send-questionnaire-client"]'
  ) as HTMLInputElement | null;
  const clientValue = clientHiddenInput?.value || clientSelect?.value || '';

  if (!clientValue) {
    showToast('Please select a client', 'error');
    return;
  }

  try {
    const response = await apiPost(`${QUESTIONNAIRES_API}/${idInput.value}/send`, {
      client_id: parseInt(clientValue, 10),
      due_date: dueInput?.value || undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    showToast('Questionnaire sent to client', 'success');
    closeSendModal();
    await refreshResponses();
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// View Response Modal
// ---------------------------------------------------------------------------

async function openViewResponseModal(responseId: number): Promise<void> {
  const modal = el('view-response-modal');
  const bodyEl = el('view-response-body');
  if (!modal || !bodyEl) return;

  bodyEl.innerHTML =
    '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>';

  openModalOverlay(modal);
  viewResponseModalFocusCleanup = manageFocusTrap(modal, {});

  try {
    const res = await apiFetch(`${QUESTIONNAIRES_API}/responses/${responseId}`);
    if (!res.ok) throw new Error('Failed to load response');

    const data = await parseApiResponse<{
      response: QuestionnaireResponse;
      questionnaire: Questionnaire;
    }>(res);

    const { response, questionnaire } = data;

    bodyEl.innerHTML = `
      <div class="response-meta">
        <dl class="dr-detail-dl">
          <dt>Client</dt><dd>${escapeHtml(SanitizationUtils.decodeHtmlEntities(response.client_name || String(response.client_id)))}</dd>
          <dt>Status</dt><dd>${statusLabel(response.status)}</dd>
          <dt>Due Date</dt><dd>${formatDate(response.due_date)}</dd>
          ${response.started_at ? `<dt>Started</dt><dd>${formatDate(response.started_at)}</dd>` : ''}
          ${response.completed_at ? `<dt>Completed</dt><dd>${formatDate(response.completed_at)}</dd>` : ''}
        </dl>
      </div>
      <div class="response-answers">
        <h4>Answers</h4>
        ${questionnaire.questions
    .map((q) => {
      const answer = response.answers[q.id];
      const displayAnswer =
              answer === undefined || answer === null || answer === ''
                ? '<em class="text-muted">No answer</em>'
                : Array.isArray(answer)
                  ? answer.map((a) => escapeHtml(String(a))).join(', ')
                  : escapeHtml(String(answer));

      return `
            <div class="response-answer-item">
              <div class="response-question">${escapeHtml(q.question)}${q.required ? ' <span class="text-danger">*</span>' : ''}</div>
              <div class="response-answer">${displayAnswer}</div>
            </div>
          `;
    })
    .join('')}
      </div>
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div class="error-state"><span class="error-message">${escapeHtml((err as Error).message)}</span></div>`;
  }
}

function closeViewResponseModal(): void {
  const modal = el('view-response-modal');
  if (modal) {
    closeModalOverlay(modal);
    viewResponseModalFocusCleanup?.();
    viewResponseModalFocusCleanup = null;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function deleteQuestionnaire(id: number, name: string): Promise<void> {
  const confirmed = await confirmDanger(
    `Delete questionnaire "${name}"? This will also delete all responses.`
  );
  if (!confirmed) return;

  try {
    const response = await apiDelete(`${QUESTIONNAIRES_API}/${id}`);
    if (!response.ok) throw new Error('Failed to delete questionnaire');

    showToast('Questionnaire deleted', 'success');
    await refreshQuestionnaires();
    await refreshResponses();
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

async function sendReminder(responseId: number): Promise<void> {
  try {
    const response = await apiPost(`${QUESTIONNAIRES_API}/responses/${responseId}/remind`, {});
    if (!response.ok) throw new Error('Failed to send reminder');

    showToast('Reminder sent', 'success');
    await refreshResponses();
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

async function deleteResponse(responseId: number): Promise<void> {
  const confirmed = await confirmDanger('Delete this response? This cannot be undone.');
  if (!confirmed) return;

  try {
    const response = await apiDelete(`${QUESTIONNAIRES_API}/responses/${responseId}`);
    if (!response.ok) throw new Error('Failed to delete response');

    showToast('Response deleted', 'success');
    await refreshResponses();
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Refresh Functions
// ---------------------------------------------------------------------------

async function refreshQuestionnaires(): Promise<void> {
  const tbody = el('questionnaires-table-body');
  if (tbody) showTableLoading(tbody, QUESTIONNAIRES_COLSPAN, 'Loading questionnaires...');

  try {
    questionnairesCache = await loadQuestionnaires();
    renderQuestionnairesTable(questionnairesCache);
  } catch (err) {
    if (tbody) showTableEmpty(tbody, QUESTIONNAIRES_COLSPAN, 'Failed to load questionnaires.');
    showToast((err as Error).message, 'error');
  }
}

async function refreshResponses(): Promise<void> {
  const tbody = el('responses-table-body');
  if (tbody) showTableLoading(tbody, RESPONSES_COLSPAN, 'Loading responses...');

  try {
    responsesCache = await loadPendingResponses();
    renderResponsesTable(responsesCache);
  } catch (err) {
    if (tbody) showTableEmpty(tbody, RESPONSES_COLSPAN, 'Failed to load responses.');
    showToast((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

function setupListeners(_ctx: AdminDashboardContext): void {
  if (listenersSetup) return;
  listenersSetup = true;

  // Questionnaires actions
  el('questionnaires-refresh')?.addEventListener('click', () => refreshQuestionnaires());
  el('questionnaires-add')?.addEventListener('click', () => openQuestionnaireModal());

  // Modal controls
  el('questionnaire-modal-close')?.addEventListener('click', closeQuestionnaireModal);
  el('questionnaire-cancel')?.addEventListener('click', closeQuestionnaireModal);
  el('questionnaire-modal')?.addEventListener('click', (e) => {
    if (e.target === el('questionnaire-modal')) closeQuestionnaireModal();
  });

  // Form submission
  el('questionnaire-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveQuestionnaire();
  });

  // Add question button
  el('add-question-btn')?.addEventListener('click', addQuestion);

  // Questions builder delegation
  el('questions-builder')?.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    const index = parseInt(target.getAttribute('data-index') || '-1', 10);
    if (index < 0) return;

    if (target.classList.contains('question-type-select')) {
      updateQuestionField(index, 'type', (target as HTMLSelectElement).value as QuestionType);
    } else if (target.classList.contains('question-required')) {
      updateQuestionField(index, 'required', (target as HTMLInputElement).checked);
    } else if (target.classList.contains('question-text')) {
      updateQuestionField(index, 'question', (target as HTMLInputElement).value);
    } else if (target.classList.contains('question-options-input')) {
      const options = (target as HTMLTextAreaElement).value.split('\n').filter((o) => o.trim());
      updateQuestionField(index, 'options', options);
    } else if (target.classList.contains('conditional-enabled')) {
      // Toggle conditional visibility
      const configEl = target
        .closest('.question-conditional')
        ?.querySelector('.question-conditional-config') as HTMLElement;
      if (configEl) {
        configEl.style.display = (target as HTMLInputElement).checked ? '' : 'none';
      }
      // Clear condition if unchecked
      if (!(target as HTMLInputElement).checked) {
        updateQuestionField(index, 'conditionalOn', undefined);
      }
    } else if (target.classList.contains('conditional-question-select')) {
      const questionId = (target as HTMLSelectElement).value;
      if (questionId) {
        updateQuestionField(index, 'conditionalOn', { questionId, value: '' });
        // Re-render to show value options for selected question
        renderQuestionsBuilder();
      } else {
        updateQuestionField(index, 'conditionalOn', undefined);
      }
    } else if (target.classList.contains('conditional-value-select')) {
      const value = (target as HTMLSelectElement).value;
      const existing = questionsData[index]?.conditionalOn;
      if (existing) {
        updateQuestionField(index, 'conditionalOn', { ...existing, value });
      }
    }
  });

  el('questions-builder')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest('.question-remove');
    if (removeBtn) {
      const index = parseInt(removeBtn.getAttribute('data-index') || '-1', 10);
      if (index >= 0) removeQuestion(index);
    }
  });

  // Send modal
  el('send-questionnaire-modal-close')?.addEventListener('click', closeSendModal);
  el('send-questionnaire-cancel')?.addEventListener('click', closeSendModal);
  el('send-questionnaire-modal')?.addEventListener('click', (e) => {
    if (e.target === el('send-questionnaire-modal')) closeSendModal();
  });
  el('send-questionnaire-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendQuestionnaire();
  });

  // View response modal
  el('view-response-modal-close')?.addEventListener('click', closeViewResponseModal);
  el('view-response-close')?.addEventListener('click', closeViewResponseModal);
  el('view-response-modal')?.addEventListener('click', (e) => {
    if (e.target === el('view-response-modal')) closeViewResponseModal();
  });

  // Responses refresh
  el('responses-refresh')?.addEventListener('click', () => refreshResponses());

  // Table action delegation - Questionnaires
  el('questionnaires-table-body')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest('.questionnaire-edit');
    const sendBtn = target.closest('.questionnaire-send');
    const deleteBtn = target.closest('.questionnaire-delete');

    if (editBtn) {
      const id = parseInt(editBtn.getAttribute('data-id') || '0', 10);
      const questionnaire = questionnairesCache.find((q) => q.id === id);
      if (questionnaire) openQuestionnaireModal(questionnaire);
      return;
    }

    if (sendBtn) {
      const id = parseInt(sendBtn.getAttribute('data-id') || '0', 10);
      openSendModal(id);
      return;
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.getAttribute('data-id') || '0', 10);
      const name = deleteBtn.getAttribute('data-name') || '';
      await deleteQuestionnaire(id, name);
    }
  });

  // Table action delegation - Responses
  el('responses-table-body')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const viewBtn = target.closest('.response-view');
    const remindBtn = target.closest('.response-remind');
    const deleteBtn = target.closest('.response-delete');

    if (viewBtn) {
      const id = parseInt(viewBtn.getAttribute('data-id') || '0', 10);
      await openViewResponseModal(id);
      return;
    }

    if (remindBtn) {
      const id = parseInt(remindBtn.getAttribute('data-id') || '0', 10);
      await sendReminder(id);
      return;
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.getAttribute('data-id') || '0', 10);
      await deleteResponse(id);
    }
  });
}

// ---------------------------------------------------------------------------
// SVG ICONS FOR DYNAMIC RENDERING
// ---------------------------------------------------------------------------

const RENDER_ICONS = {
  REFRESH:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>',
  PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  PLUS_SM:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'
};

// ---------------------------------------------------------------------------
// DYNAMIC TAB RENDERING
// ---------------------------------------------------------------------------

/**
 * Cleanup function called when leaving the questionnaires tab
 * Unmounts React components if they were mounted
 */
export function cleanupQuestionnairesTab(): void {
  if (reactTableMounted && unmountQuestionnairesTable) {
    unmountQuestionnairesTable();
    reactTableMounted = false;
  }
}

/**
 * Renders the Questionnaires tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderQuestionnairesTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactQuestionnairesTable();

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Questionnaires Table Mount Point -->
      <div id="react-questionnaires-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML
  container.innerHTML = `
    <div class="data-table-card" id="questionnaires-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">Questionnaires</span><span class="title-mobile">Forms</span></h3>
        <div class="data-table-actions" id="questionnaires-filter-container">
          <button type="button" class="icon-btn" id="questionnaires-refresh" title="Refresh" aria-label="Refresh questionnaires">
            ${RENDER_ICONS.REFRESH}
          </button>
          <button type="button" class="icon-btn" id="questionnaires-add" title="Create Questionnaire" aria-label="Create questionnaire">
            ${RENDER_ICONS.PLUS}
          </button>
        </div>
      </div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
          <table class="data-table" aria-label="Questionnaires">
            <thead>
              <tr>
                <th scope="col" class="name-col">Name</th>
                <th scope="col" class="name-col">Description</th>
                <th scope="col" class="type-col">Project Type</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="questionnaires-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="5">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading questionnaires...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="questionnaires-pagination" class="table-pagination"></div>
    </div>

    <!-- Pending Responses Card -->
    <div class="data-table-card" id="responses-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">Pending Responses</span><span class="title-mobile">Responses</span></h3>
        <div class="data-table-actions">
          <button type="button" class="icon-btn" id="responses-refresh" title="Refresh" aria-label="Refresh responses">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
          <table class="data-table" aria-label="Pending questionnaire responses">
            <thead>
              <tr>
                <th scope="col" class="name-col">Questionnaire</th>
                <th scope="col" class="name-col">Client</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Due Date</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="responses-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="5">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading responses...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="responses-pagination" class="table-pagination"></div>
    </div>

    <!-- Create/Edit Questionnaire Modal -->
    <div class="admin-modal-overlay hidden" id="questionnaire-modal" role="dialog" aria-modal="true" aria-labelledby="questionnaire-modal-title">
      <div class="admin-modal admin-modal--lg">
        <div class="admin-modal-header">
          <div class="admin-modal-title flex items-center">
            <h2 id="questionnaire-modal-title">Create Questionnaire</h2>
          </div>
          <button class="admin-modal-close" id="questionnaire-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div class="admin-modal-body">
          <form id="questionnaire-form">
            <div class="form-row">
              <div class="form-group">
                <label for="questionnaire-name">Internal Name</label>
                <input type="text" id="questionnaire-name" name="name" required placeholder="e.g., website_discovery" />
              </div>
              <div class="form-group">
                <label for="questionnaire-project-type">Project Type</label>
                <select id="questionnaire-project-type" name="project_type">
                  <option value="">All Types</option>
                  <option value="website">Website</option>
                  <option value="branding">Branding</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="questionnaire-description">Description (shown to clients)</label>
              <textarea id="questionnaire-description" name="description" rows="2" placeholder="Help us understand your project needs..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group form-group--checkbox">
                <label>
                  <input type="checkbox" id="questionnaire-active" name="is_active" checked />
                  Active
                </label>
              </div>
              <div class="form-group form-group--checkbox">
                <label>
                  <input type="checkbox" id="questionnaire-auto-send" name="auto_send_on_project_create" />
                  Auto-send on project creation
                </label>
              </div>
            </div>
            <div class="form-group">
              <label>Questions</label>
              <div id="questions-builder">
                <!-- Questions will be added dynamically -->
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="add-question-btn">
                ${RENDER_ICONS.PLUS_SM}
                Add Question
              </button>
            </div>
          </form>
        </div>
        <div class="admin-modal-footer">
          <button type="button" class="btn btn-secondary" id="questionnaire-cancel">Cancel</button>
          <button type="submit" form="questionnaire-form" class="btn btn-primary" id="questionnaire-save">Save Questionnaire</button>
        </div>
      </div>
    </div>

    <!-- Send Questionnaire Modal -->
    <div class="admin-modal-overlay hidden" id="send-questionnaire-modal" role="dialog" aria-modal="true" aria-labelledby="send-questionnaire-modal-title">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <div class="admin-modal-title flex items-center">
            <h2 id="send-questionnaire-modal-title">Send Questionnaire</h2>
          </div>
          <button class="admin-modal-close" id="send-questionnaire-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div class="admin-modal-body">
          <form id="send-questionnaire-form">
            <input type="hidden" id="send-questionnaire-id" name="questionnaire_id" />
            <div class="form-group">
              <label for="send-questionnaire-client">Client</label>
              <select id="send-questionnaire-client" name="client_id" required>
                <option value="">Select a client...</option>
              </select>
            </div>
            <div class="form-group">
              <label for="send-questionnaire-due">Due Date (optional)</label>
              <input type="date" id="send-questionnaire-due" name="due_date" />
            </div>
          </form>
        </div>
        <div class="admin-modal-footer">
          <button type="button" class="btn btn-secondary" id="send-questionnaire-cancel">Cancel</button>
          <button type="submit" form="send-questionnaire-form" class="btn btn-primary" id="send-questionnaire-submit">Send</button>
        </div>
      </div>
    </div>

    <!-- View Response Modal -->
    <div class="admin-modal-overlay hidden" id="view-response-modal" role="dialog" aria-modal="true" aria-labelledby="view-response-modal-title">
      <div class="admin-modal admin-modal--lg">
        <div class="admin-modal-header">
          <div class="admin-modal-title flex items-center">
            <h2 id="view-response-modal-title">Questionnaire Response</h2>
          </div>
          <button class="admin-modal-close" id="view-response-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div id="view-response-body" class="admin-modal-body">
          <!-- Response content will be populated dynamically -->
        </div>
        <div class="admin-modal-footer">
          <button type="button" class="btn btn-secondary" id="view-response-close">Close</button>
        </div>
      </div>
    </div>
  `;

  // Reset listener flags so they get re-attached
  listenersSetup = false;
  clientDropdownInit = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadQuestionnairesModule(ctx: AdminDashboardContext): Promise<void> {
  // Check if React implementation should be used
  const useReact = shouldUseReactQuestionnairesTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React QuestionnairesTable
    const mountContainer = document.getElementById('react-questionnaires-mount');
    if (mountContainer) {
      const loaded = await loadReactQuestionnairesTable();
      if (loaded && mountQuestionnairesTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountQuestionnairesTable) {
          unmountQuestionnairesTable();
        }
        mountQuestionnairesTable(mountContainer, {
          onNavigate: (tab: string, entityId?: string) => {
            if (entityId) {
              ctx.switchTab(tab);
            } else {
              ctx.switchTab(tab);
            }
          }
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
      } else {
        logger.error(' React module failed to load, falling back to vanilla');
      }
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  setupListeners(ctx);
  await Promise.all([refreshQuestionnaires(), refreshResponses()]);
}
