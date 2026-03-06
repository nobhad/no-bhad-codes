/**
 * ===============================================
 * PORTAL QUESTIONNAIRES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires.ts
 *
 * Client portal UI for viewing and completing questionnaires.
 * Displays pending questionnaires and allows progress saving.
 *
 * Types: ./portal-questionnaires-types.ts
 * Form rendering: ./portal-questionnaires-form.ts
 * Response handling: ./portal-questionnaires-responses.ts
 */

import { gsap } from 'gsap';
import type { ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';
import { getStatusBadgeHTML } from '../../../components/status-badge';
import { getReactComponent } from '../../../react/registry';
import { showToast } from '../../../utils/toast-notifications';
import { formatDate } from '../../../utils/format-utils';
import type {
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireStats,
  ResponseStatus
} from './portal-questionnaires-types';
import { renderQuestionnaireForm, collectAnswers } from './portal-questionnaires-form';
import {
  loadMyResponses,
  loadResponseDetails,
  handleSaveProgress,
  handleSubmit,
  handleBack
} from './portal-questionnaires-responses';

// Track React unmount function
let reactQuestionnairesUnmountFn: (() => void) | null = null;

/**
 * Check if React portal questionnaires should be used
 */
function shouldUseReactPortalQuestionnaires(): boolean {
  return true;
}

/**
 * Cleanup React portal questionnaires
 */
export function cleanupPortalQuestionnaires(): void {
  if (reactQuestionnairesUnmountFn) {
    reactQuestionnairesUnmountFn();
    reactQuestionnairesUnmountFn = null;
  }
}

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

function formatDateDisplay(dateStr: string | undefined): string {
  return formatDate(dateStr) || '\u2014';
}

function getStatusLabel(status: ResponseStatus): string {
  const map: Record<ResponseStatus, string> = {
    pending: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed'
  };
  return map[status] ?? status;
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

function renderQuestionnairesList(): void {
  const container = el('questionnaires-list-container');
  if (!container) return;

  const pending = responsesCache.filter(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  );
  const completed = responsesCache.filter((r) => r.status === 'completed');

  let html = '';

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

  if (pending.length > 0) {
    html += `
      <div class="cp-questionnaires-section">
        <h3 class="cp-section-title">Pending Questionnaires</h3>
        <div class="cp-questionnaires-grid">
          ${pending.map((r) => renderQuestionnaireCard(r)).join('')}
        </div>
      </div>
    `;
  }

  if (completed.length > 0) {
    html += `
      <div class="cp-questionnaires-section">
        <h3 class="cp-section-title">Completed</h3>
        <div class="cp-questionnaires-grid">
          ${completed.map((r) => renderQuestionnaireCard(r)).join('')}
        </div>
      </div>
    `;
  }

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
  const dueClass =
    response.due_date && new Date(response.due_date) < new Date() && !isComplete ? 'overdue' : '';

  return `
    <div class="cp-questionnaire-card overview-card ${isComplete ? 'completed' : ''}" data-response-id="${response.id}">
      <div class="cp-questionnaire-header">
        <h4 class="cp-questionnaire-title">${escapeHtml(response.questionnaire_name || 'Questionnaire')}</h4>
        ${getStatusBadgeHTML(getStatusLabel(response.status), response.status)}
      </div>
      ${response.project_name ? `<p class="cp-questionnaire-project">For: ${escapeHtml(response.project_name)}</p>` : ''}
      <div class="cp-questionnaire-meta">
        ${response.due_date ? `<span class="cp-questionnaire-due ${dueClass}">Due: ${formatDateDisplay(response.due_date)}</span>` : ''}
        ${response.completed_at ? `<span class="cp-questionnaire-completed">Completed: ${formatDateDisplay(response.completed_at)}</span>` : ''}
      </div>
      <div class="cp-questionnaire-actions">
        ${
  isComplete
    ? `<button type="button" class="btn btn-secondary btn-sm questionnaire-view" data-id="${response.id}">View Answers</button>`
    : `<button type="button" class="btn btn-primary btn-sm questionnaire-start" data-id="${response.id}">${isPending ? 'Start' : 'Continue'}</button>`
}
      </div>
    </div>
  `;
}

function animateCards(): void {
  const cards = document.querySelectorAll('.cp-questionnaire-card');
  gsap.fromTo(
    cards,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }
  );
}

// =====================================================
// EVENT HANDLERS (delegating to extracted modules)
// =====================================================

async function handleStartQuestionnaire(responseId: number): Promise<void> {
  try {
    const data = await loadResponseDetails(responseId);
    currentResponse = data.response;
    currentQuestionnaire = data.questionnaire;
    currentAnswers = data.response.answers || {};
    doRenderForm();
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
  }
}

function doRenderForm(): void {
  const container = el('questionnaires-list-container');
  if (!container || !currentQuestionnaire || !currentResponse) return;

  renderQuestionnaireForm(container, currentQuestionnaire, currentResponse, currentAnswers, {
    onConditionalChange: () => {
      if (currentQuestionnaire) {
        currentAnswers = collectAnswers(currentQuestionnaire, currentAnswers);
      }
      doRenderForm();
    }
  });
}

async function onSaveProgress(): Promise<void> {
  if (!currentResponse || !currentQuestionnaire || isSaving) return;
  isSaving = true;

  const result = await handleSaveProgress(
    currentResponse,
    currentQuestionnaire,
    currentAnswers,
    ctx,
    responsesCache
  );

  currentAnswers = result.answers;
  isSaving = result.isSaving;
}

async function onSubmit(): Promise<void> {
  if (!currentResponse || !currentQuestionnaire) return;

  const result = await handleSubmit(
    currentResponse,
    currentQuestionnaire,
    currentAnswers,
    ctx,
    async () => {
      currentResponse = null;
      currentQuestionnaire = null;
      currentAnswers = {};
      await refreshQuestionnaires();
    }
  );

  if (result) {
    currentAnswers = result.answers;
  }
}

function onBack(): void {
  handleBack(() => {
    currentResponse = null;
    currentQuestionnaire = null;
    currentAnswers = {};
    renderQuestionnairesList();
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

    const startBtn = target.closest('.questionnaire-start');
    if (startBtn) {
      const id = parseInt(startBtn.getAttribute('data-id') || '0', 10);
      if (id) await handleStartQuestionnaire(id);
      return;
    }

    const viewBtn = target.closest('.questionnaire-view');
    if (viewBtn) {
      const id = parseInt(viewBtn.getAttribute('data-id') || '0', 10);
      if (id) await handleStartQuestionnaire(id);
      return;
    }

    if (target.closest('.questionnaire-back')) {
      onBack();
      return;
    }

    if (target.closest('.questionnaire-save') || target.closest('.questionnaire-save-btn')) {
      await onSaveProgress();
      return;
    }

    if (target.closest('.questionnaires-retry')) {
      await refreshQuestionnaires();
    }
  });

  container.addEventListener('submit', async (e) => {
    if ((e.target as HTMLElement).id === 'questionnaire-answer-form') {
      e.preventDefault();
      await onSubmit();
    }
  });

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  container.addEventListener('change', () => {
    if (!currentResponse || currentResponse.status === 'completed') return;
    if (!currentQuestionnaire) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (currentQuestionnaire) {
        currentAnswers = collectAnswers(currentQuestionnaire, currentAnswers);
      }
    }, 500);
  });
}

// =====================================================
// PUBLIC API
// =====================================================

export async function loadQuestionnaires(context: ClientPortalContext): Promise<void> {
  ctx = context;

  if (shouldUseReactPortalQuestionnaires()) {
    const component = getReactComponent('portalQuestionnaires');
    const container =
      el('questionnaires-list') || document.querySelector('.questionnaires-section');
    if (component && container) {
      const unmountResult = component.mount(container as HTMLElement, {
        getAuthToken: context.getAuthToken,
        showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
          showToast(message, type);
        }
      });

      if (typeof unmountResult === 'function') {
        reactQuestionnairesUnmountFn = unmountResult;
      }

      return;
    }
  }

  setupEventListeners();
  await refreshQuestionnaires();
}
