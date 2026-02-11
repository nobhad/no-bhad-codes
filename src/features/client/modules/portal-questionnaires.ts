/**
 * ===============================================
 * PORTAL QUESTIONNAIRES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires.ts
 *
 * Client portal UI for viewing and completing questionnaires.
 * Displays pending questionnaires and allows progress saving.
 */

import { gsap } from 'gsap';
import type { ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';

// =====================================================
// TYPES
// =====================================================

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
  questions: Question[];
}

interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  project_id?: number;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  created_at: string;
  questionnaire_name?: string;
  project_name?: string;
}

interface QuestionnaireStats {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const API_BASE = '/api/questionnaires';

// =====================================================
// MODULE STATE
// =====================================================

let responsesCache: QuestionnaireResponse[] = [];
let statsCache: QuestionnaireStats | null = null;
let currentResponse: QuestionnaireResponse | null = null;
let currentQuestionnaire: Questionnaire | null = null;
let currentAnswers: Record<string, unknown> = {};
let isSaving = false;
let ctx: ClientPortalContext | null = null;

// =====================================================
// HELPERS
// =====================================================

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusLabel(status: ResponseStatus): string {
  const map: Record<ResponseStatus, string> = {
    pending: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed'
  };
  return map[status] ?? status;
}

/**
 * Check if a question should be visible based on conditional logic
 * @param question - The question to check
 * @param answers - Current answers to all questions
 * @returns true if the question should be shown
 */
function isQuestionVisible(question: Question, answers: Record<string, unknown>): boolean {
  // No condition means always visible
  if (!question.conditionalOn) return true;

  const { questionId, value: conditionValue } = question.conditionalOn;
  const answer = answers[questionId];

  // If parent question hasn't been answered, hide dependent question
  if (answer === undefined || answer === null || answer === '') return false;

  // Handle array condition values (match any)
  if (Array.isArray(conditionValue)) {
    // If answer is also an array (multiselect), check for intersection
    if (Array.isArray(answer)) {
      return answer.some((a) => conditionValue.includes(String(a)));
    }
    // Single answer, check if it's in the condition values
    return conditionValue.includes(String(answer));
  }

  // Handle single condition value
  if (Array.isArray(answer)) {
    // Multiselect answer, check if condition value is selected
    return answer.includes(conditionValue);
  }

  // Simple string comparison
  return String(answer) === String(conditionValue);
}

/**
 * Get list of visible questions based on current answers
 */
function getVisibleQuestions(questions: Question[], answers: Record<string, unknown>): Question[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

function getStatusClass(status: ResponseStatus): string {
  const map: Record<ResponseStatus, string> = {
    pending: 'status-pending',
    in_progress: 'status-in_progress',
    completed: 'status-completed'
  };
  return map[status] ?? '';
}

// =====================================================
// DATA LOADING
// =====================================================

async function loadMyResponses(): Promise<{ responses: QuestionnaireResponse[]; stats: QuestionnaireStats }> {
  const res = await fetch(`${API_BASE}/my-responses`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load questionnaires');
  return await res.json();
}

async function loadResponseDetails(responseId: number): Promise<{ response: QuestionnaireResponse; questionnaire: Questionnaire }> {
  const res = await fetch(`${API_BASE}/responses/${responseId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load questionnaire');
  return await res.json();
}

async function saveProgress(responseId: number, answers: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE}/responses/${responseId}/save`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to save progress');
  }
}

async function submitResponse(responseId: number, answers: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE}/responses/${responseId}/submit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to submit questionnaire');
  }
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

function renderQuestionnairesList(): void {
  const container = el('questionnaires-list-container');
  if (!container) return;

  // Group by status
  const pending = responsesCache.filter(r => r.status === 'pending' || r.status === 'in_progress');
  const completed = responsesCache.filter(r => r.status === 'completed');

  let html = '';

  // Stats summary
  if (statsCache) {
    html += `
      <div class="cp-questionnaires-stats">
        <div class="stat-card">
          <span class="stat-number">${statsCache.pending + statsCache.in_progress}</span>
          <span class="stat-label">To Complete</span>
        </div>
        <div class="stat-card stat-card-success">
          <span class="stat-number">${statsCache.completed}</span>
          <span class="stat-label">Completed</span>
        </div>
      </div>
    `;
  }

  // Pending questionnaires
  if (pending.length > 0) {
    html += `
      <div class="cp-questionnaires-section">
        <h3 class="cp-section-title">Pending Questionnaires</h3>
        <div class="cp-questionnaires-grid">
          ${pending.map(r => renderQuestionnaireCard(r)).join('')}
        </div>
      </div>
    `;
  }

  // Completed questionnaires
  if (completed.length > 0) {
    html += `
      <div class="cp-questionnaires-section">
        <h3 class="cp-section-title">Completed</h3>
        <div class="cp-questionnaires-grid">
          ${completed.map(r => renderQuestionnaireCard(r)).join('')}
        </div>
      </div>
    `;
  }

  // Empty state
  if (responsesCache.length === 0) {
    html = `
      <div class="cp-questionnaires-empty">
        <div class="cp-empty-icon">${ICONS.CLIPBOARD}</div>
        <h3>No Questionnaires</h3>
        <p>You don't have any questionnaires to complete at this time.</p>
      </div>
    `;
  }

  container.innerHTML = html;
  animateCards();
}

function renderQuestionnaireCard(response: QuestionnaireResponse): string {
  const isComplete = response.status === 'completed';
  const isPending = response.status === 'pending';
  const dueClass = response.due_date && new Date(response.due_date) < new Date() && !isComplete ? 'overdue' : '';

  return `
    <div class="cp-questionnaire-card overview-card ${isComplete ? 'completed' : ''}" data-response-id="${response.id}">
      <div class="cp-questionnaire-header">
        <h4 class="cp-questionnaire-title">${escapeHtml(response.questionnaire_name || 'Questionnaire')}</h4>
        <span class="status-badge ${getStatusClass(response.status)}">
          ${getStatusLabel(response.status)}
        </span>
      </div>
      ${response.project_name ? `<p class="cp-questionnaire-project">For: ${escapeHtml(response.project_name)}</p>` : ''}
      <div class="cp-questionnaire-meta">
        ${response.due_date ? `<span class="cp-questionnaire-due ${dueClass}">Due: ${formatDate(response.due_date)}</span>` : ''}
        ${response.completed_at ? `<span class="cp-questionnaire-completed">Completed: ${formatDate(response.completed_at)}</span>` : ''}
      </div>
      <div class="cp-questionnaire-actions">
        ${isComplete
    ? `<button type="button" class="btn btn-secondary btn-sm questionnaire-view" data-id="${response.id}">View Answers</button>`
    : `<button type="button" class="btn btn-primary btn-sm questionnaire-start" data-id="${response.id}">${isPending ? 'Start' : 'Continue'}</button>`
}
      </div>
    </div>
  `;
}

function animateCards(): void {
  const cards = document.querySelectorAll('.cp-questionnaire-card');
  gsap.fromTo(cards, {
    opacity: 0,
    y: 10
  }, {
    opacity: 1,
    y: 0,
    duration: 0.3,
    stagger: 0.05,
    ease: 'power2.out'
  });
}

// =====================================================
// QUESTIONNAIRE FORM
// =====================================================

function renderQuestionnaireForm(): void {
  const container = el('questionnaires-list-container');
  if (!container || !currentQuestionnaire || !currentResponse) return;

  const isCompleted = currentResponse.status === 'completed';

  // Get visible questions based on current answers
  const visibleQuestions = getVisibleQuestions(currentQuestionnaire.questions, currentAnswers);

  const html = `
    <div class="cp-questionnaire-form-wrapper">
      <div class="cp-questionnaire-form-header">
        <button type="button" class="btn btn-ghost questionnaire-back" aria-label="Back to list">
          ${ICONS.ARROW_LEFT} Back
        </button>
        <h2 class="cp-questionnaire-form-title">${escapeHtml(currentQuestionnaire.name)}</h2>
        ${!isCompleted ? '<button type="button" class="btn btn-secondary btn-sm questionnaire-save" id="save-progress-btn">Save Progress</button>' : ''}
      </div>
      ${currentQuestionnaire.description ? `<p class="cp-questionnaire-form-description">${escapeHtml(currentQuestionnaire.description)}</p>` : ''}

      <form id="questionnaire-answer-form" class="cp-questionnaire-form">
        ${visibleQuestions.map((q, index) => renderQuestion(q, index, isCompleted)).join('')}

        ${!isCompleted ? `
          <div class="cp-questionnaire-form-actions">
            <button type="button" class="btn btn-secondary questionnaire-save-btn">Save Progress</button>
            <button type="submit" class="btn btn-success">Submit Questionnaire</button>
          </div>
        ` : ''}
      </form>
    </div>
  `;

  container.innerHTML = html;

  // Populate answers
  if (currentAnswers) {
    populateAnswers();
  }

  // Add change listeners for conditional question updates
  if (!isCompleted) {
    attachConditionalListeners();
  }

  // Animate in
  gsap.fromTo('.cp-questionnaire-form-wrapper', {
    opacity: 0,
    x: 20
  }, {
    opacity: 1,
    x: 0,
    duration: 0.3,
    ease: 'power2.out'
  });
}

/**
 * Attach listeners for conditional question updates
 * When an answer changes, re-render form to show/hide dependent questions
 */
function attachConditionalListeners(): void {
  if (!currentQuestionnaire) return;

  // Check if any questions have conditionals
  const hasConditionals = currentQuestionnaire.questions.some((q) => q.conditionalOn);
  if (!hasConditionals) return;

  // Find all parent questions that have dependents
  const parentQuestionIds = new Set(
    currentQuestionnaire.questions
      .filter((q) => q.conditionalOn)
      .map((q) => q.conditionalOn!.questionId)
  );

  // Attach change listeners to parent questions
  parentQuestionIds.forEach((questionId) => {
    const question = currentQuestionnaire!.questions.find((q) => q.id === questionId);
    if (!question) return;

    if (question.type === 'multiselect') {
      const checkboxes = document.querySelectorAll(`input[name="${questionId}"]`);
      checkboxes.forEach((cb) => {
        cb.addEventListener('change', handleConditionalChange);
      });
    } else {
      const input = document.getElementById(`q_${questionId}`);
      if (input) {
        input.addEventListener('change', handleConditionalChange);
      }
    }
  });
}

/**
 * Handle change on a question that has dependent conditionals
 */
function handleConditionalChange(): void {
  // Collect current answers before re-render
  currentAnswers = collectAnswers();
  // Re-render form with updated visibility
  renderQuestionnaireForm();
}

function renderQuestion(question: Question, index: number, isCompleted: boolean): string {
  const disabled = isCompleted ? 'disabled' : '';

  let inputHtml = '';

  switch (question.type) {
  case 'text':
    inputHtml = `
        <input type="text" id="q_${question.id}" name="${question.id}"
               class="form-input" placeholder="${escapeHtml(question.placeholder || '')}" ${disabled} />
      `;
    break;

  case 'textarea':
    inputHtml = `
        <textarea id="q_${question.id}" name="${question.id}"
                  class="form-textarea" rows="4" placeholder="${escapeHtml(question.placeholder || '')}" ${disabled}></textarea>
      `;
    break;

  case 'number':
    inputHtml = `
        <input type="number" id="q_${question.id}" name="${question.id}"
               class="form-input" placeholder="${escapeHtml(question.placeholder || '')}" ${disabled} />
      `;
    break;

  case 'select':
    inputHtml = `
        <select id="q_${question.id}" name="${question.id}" class="form-select" ${disabled}>
          <option value="">Select an option...</option>
          ${(question.options || []).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
        </select>
      `;
    break;

  case 'multiselect':
    inputHtml = `
        <div class="cp-checkbox-group" id="q_${question.id}">
          ${(question.options || []).map(opt => `
            <label class="cp-checkbox-label">
              <span class="portal-checkbox">
                <input type="checkbox" name="${question.id}" value="${escapeHtml(opt)}" ${disabled} />
              </span>
              <span>${escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
      `;
    break;

  default:
    inputHtml = `
        <input type="text" id="q_${question.id}" name="${question.id}"
               class="form-input" ${disabled} />
      `;
  }

  return `
    <div class="cp-question-item" data-question-id="${question.id}">
      <label class="cp-question-label">
        <span class="cp-question-number">${index + 1}.</span>
        ${escapeHtml(question.question)}
        ${question.required ? '<span class="cp-required">*</span>' : ''}
      </label>
      ${question.helpText ? `<p class="cp-question-help">${escapeHtml(question.helpText)}</p>` : ''}
      ${inputHtml}
    </div>
  `;
}

function populateAnswers(): void {
  if (!currentQuestionnaire || !currentAnswers) return;

  currentQuestionnaire.questions.forEach(question => {
    const answer = currentAnswers[question.id];
    if (answer === undefined || answer === null) return;

    if (question.type === 'multiselect') {
      // Handle checkbox groups
      const checkboxes = document.querySelectorAll(`input[name="${question.id}"]`);
      const values = Array.isArray(answer) ? answer : [answer];
      checkboxes.forEach((checkbox) => {
        const input = checkbox as HTMLInputElement;
        if (values.includes(input.value)) {
          input.checked = true;
        }
      });
    } else {
      const input = document.getElementById(`q_${question.id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (input) {
        input.value = String(answer);
      }
    }
  });
}

function collectAnswers(): Record<string, unknown> {
  if (!currentQuestionnaire) return {};

  const answers: Record<string, unknown> = {};

  // Collect from all questions (not just visible) to preserve answers for conditionally hidden questions
  currentQuestionnaire.questions.forEach(question => {
    if (question.type === 'multiselect') {
      const checkboxes = document.querySelectorAll(`input[name="${question.id}"]:checked`);
      if (checkboxes.length > 0) {
        answers[question.id] = Array.from(checkboxes).map(cb => (cb as HTMLInputElement).value);
      } else if (currentAnswers[question.id]) {
        // Preserve existing answer for hidden questions
        answers[question.id] = currentAnswers[question.id];
      }
    } else {
      const input = document.getElementById(`q_${question.id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (input) {
        if (question.type === 'number' && input.value) {
          answers[question.id] = parseFloat(input.value);
        } else {
          answers[question.id] = input.value;
        }
      } else if (currentAnswers[question.id] !== undefined) {
        // Preserve existing answer for hidden questions
        answers[question.id] = currentAnswers[question.id];
      }
    }
  });

  return answers;
}

function validateAnswers(): { valid: boolean; missingFields: string[] } {
  if (!currentQuestionnaire) return { valid: false, missingFields: [] };

  const missingFields: string[] = [];
  const answers = collectAnswers();

  // Only validate visible questions
  const visibleQuestions = getVisibleQuestions(currentQuestionnaire.questions, answers);

  visibleQuestions.forEach(question => {
    if (!question.required) return;

    const answer = answers[question.id];

    if (answer === undefined || answer === null || answer === '') {
      missingFields.push(question.question);
    } else if (Array.isArray(answer) && answer.length === 0) {
      missingFields.push(question.question);
    }
  });

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

// =====================================================
// EVENT HANDLERS
// =====================================================

async function handleStartQuestionnaire(responseId: number): Promise<void> {
  try {
    const data = await loadResponseDetails(responseId);
    currentResponse = data.response;
    currentQuestionnaire = data.questionnaire;
    currentAnswers = data.response.answers || {};
    renderQuestionnaireForm();
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
  }
}

async function handleSaveProgress(): Promise<void> {
  if (!currentResponse || isSaving) return;

  isSaving = true;
  const saveBtn = document.getElementById('save-progress-btn');
  const saveBtnAlt = document.querySelector('.questionnaire-save-btn') as HTMLButtonElement;

  if (saveBtn) saveBtn.textContent = 'Saving...';
  if (saveBtnAlt) saveBtnAlt.textContent = 'Saving...';

  try {
    currentAnswers = collectAnswers();
    await saveProgress(currentResponse.id, currentAnswers);
    ctx?.showNotification('Progress saved', 'success');

    // Update local cache
    const cached = responsesCache.find(r => r.id === currentResponse!.id);
    if (cached) {
      cached.status = 'in_progress';
      cached.answers = currentAnswers;
    }
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
  } finally {
    isSaving = false;
    if (saveBtn) saveBtn.textContent = 'Save Progress';
    if (saveBtnAlt) saveBtnAlt.textContent = 'Save Progress';
  }
}

async function handleSubmit(): Promise<void> {
  if (!currentResponse) return;

  const { valid, missingFields } = validateAnswers();

  if (!valid) {
    ctx?.showNotification(`Please answer all required fields: ${missingFields.join(', ')}`, 'error');
    return;
  }

  const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  try {
    currentAnswers = collectAnswers();
    await submitResponse(currentResponse.id, currentAnswers);
    ctx?.showNotification('Questionnaire submitted successfully!', 'success');

    // Go back to list and refresh
    currentResponse = null;
    currentQuestionnaire = null;
    currentAnswers = {};
    await refreshQuestionnaires();
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Questionnaire';
    }
  }
}

function handleBack(): void {
  // Animate out and show list
  gsap.to('.cp-questionnaire-form-wrapper', {
    opacity: 0,
    x: 20,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      currentResponse = null;
      currentQuestionnaire = null;
      currentAnswers = {};
      renderQuestionnairesList();
    }
  });
}

// =====================================================
// REFRESH
// =====================================================

async function refreshQuestionnaires(): Promise<void> {
  const container = el('questionnaires-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="cp-loading">
      <div class="cp-loading-spinner"></div>
      <p>Loading questionnaires...</p>
    </div>
  `;

  try {
    const data = await loadMyResponses();
    responsesCache = data.responses || [];
    statsCache = data.stats || null;
    renderQuestionnairesList();
  } catch (err) {
    container.innerHTML = `
      <div class="cp-error">
        <p>Failed to load questionnaires. Please try again.</p>
        <button type="button" class="btn btn-secondary questionnaires-retry">Retry</button>
      </div>
    `;
    ctx?.showNotification((err as Error).message, 'error');
  }
}

// =====================================================
// EVENT DELEGATION
// =====================================================

function setupEventListeners(): void {
  const container = el('questionnaires-list-container');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    // Start/Continue button
    const startBtn = target.closest('.questionnaire-start');
    if (startBtn) {
      const id = parseInt(startBtn.getAttribute('data-id') || '0', 10);
      if (id) await handleStartQuestionnaire(id);
      return;
    }

    // View completed button
    const viewBtn = target.closest('.questionnaire-view');
    if (viewBtn) {
      const id = parseInt(viewBtn.getAttribute('data-id') || '0', 10);
      if (id) await handleStartQuestionnaire(id);
      return;
    }

    // Back button
    if (target.closest('.questionnaire-back')) {
      handleBack();
      return;
    }

    // Save progress buttons
    if (target.closest('.questionnaire-save') || target.closest('.questionnaire-save-btn')) {
      await handleSaveProgress();
      return;
    }

    // Retry button
    if (target.closest('.questionnaires-retry')) {
      await refreshQuestionnaires();

    }
  });

  // Form submission
  container.addEventListener('submit', async (e) => {
    if ((e.target as HTMLElement).id === 'questionnaire-answer-form') {
      e.preventDefault();
      await handleSubmit();
    }
  });

  // Auto-save on input change (debounced)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  container.addEventListener('change', () => {
    if (!currentResponse || currentResponse.status === 'completed') return;

    // Debounce auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      currentAnswers = collectAnswers();
    }, 500);
  });
}

// =====================================================
// PUBLIC API
// =====================================================

export async function loadQuestionnaires(context: ClientPortalContext): Promise<void> {
  ctx = context;
  setupEventListeners();
  await refreshQuestionnaires();
}
