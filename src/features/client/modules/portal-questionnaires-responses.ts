/**
 * ===============================================
 * PORTAL QUESTIONNAIRES - RESPONSE HANDLING
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires-responses.ts
 *
 * Event handlers for questionnaire interactions:
 * save progress, submit, navigation.
 * Extracted from portal-questionnaires.ts for maintainability.
 */

import { gsap } from 'gsap';
import type { ClientPortalContext } from '../portal-types';
import type {
  Questionnaire,
  QuestionnaireResponse
} from './portal-questionnaires-types';
import { apiFetch, unwrapApiData } from '../../../utils/api-client';
import { collectAnswers, validateAnswers } from './portal-questionnaires-form';

// =====================================================
// DATA LOADING
// =====================================================

const API_BASE = '/api/questionnaires';

export async function loadMyResponses(): Promise<{
  responses: QuestionnaireResponse[];
  stats: { pending: number; in_progress: number; completed: number; total: number };
}> {
  const res = await apiFetch(`${API_BASE}/my-responses`);
  if (!res.ok) throw new Error('Failed to load questionnaires');
  const raw = await res.json();
  return unwrapApiData<{
    responses: QuestionnaireResponse[];
    stats: { pending: number; in_progress: number; completed: number; total: number };
  }>(raw);
}

export async function loadResponseDetails(
  responseId: number
): Promise<{ response: QuestionnaireResponse; questionnaire: Questionnaire }> {
  const res = await apiFetch(`${API_BASE}/responses/${responseId}`);
  if (!res.ok) throw new Error('Failed to load questionnaire');
  const raw = await res.json();
  return unwrapApiData<{ response: QuestionnaireResponse; questionnaire: Questionnaire }>(raw);
}

async function saveProgressAPI(responseId: number, answers: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`${API_BASE}/responses/${responseId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to save progress');
  }
}

async function submitResponseAPI(responseId: number, answers: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`${API_BASE}/responses/${responseId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to submit questionnaire');
  }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

export async function handleSaveProgress(
  currentResponse: QuestionnaireResponse,
  currentQuestionnaire: Questionnaire,
  currentAnswers: Record<string, unknown>,
  ctx: ClientPortalContext | null,
  responsesCache: QuestionnaireResponse[]
): Promise<{ answers: Record<string, unknown>; isSaving: boolean }> {
  const saveBtn = document.getElementById('save-progress-btn');
  const saveBtnAlt = document.querySelector('.questionnaire-save-btn') as HTMLButtonElement;

  if (saveBtn) saveBtn.textContent = 'Saving...';
  if (saveBtnAlt) saveBtnAlt.textContent = 'Saving...';

  try {
    const answers = collectAnswers(currentQuestionnaire, currentAnswers);
    await saveProgressAPI(currentResponse.id, answers);
    ctx?.showNotification('Progress saved', 'success');

    // Update local cache
    const cached = responsesCache.find((r) => r.id === currentResponse.id);
    if (cached) {
      cached.status = 'in_progress';
      cached.answers = answers;
    }

    return { answers, isSaving: false };
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
    return { answers: currentAnswers, isSaving: false };
  } finally {
    if (saveBtn) saveBtn.textContent = 'Save Progress';
    if (saveBtnAlt) saveBtnAlt.textContent = 'Save Progress';
  }
}

export async function handleSubmit(
  currentResponse: QuestionnaireResponse,
  currentQuestionnaire: Questionnaire,
  currentAnswers: Record<string, unknown>,
  ctx: ClientPortalContext | null,
  onSuccess: () => Promise<void>
): Promise<{ answers: Record<string, unknown> } | null> {
  const answers = collectAnswers(currentQuestionnaire, currentAnswers);
  const { valid, missingFields } = validateAnswers(currentQuestionnaire, answers);

  if (!valid) {
    ctx?.showNotification(
      `Please answer all required fields: ${missingFields.join(', ')}`,
      'error'
    );
    return null;
  }

  const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  try {
    await submitResponseAPI(currentResponse.id, answers);
    ctx?.showNotification('Questionnaire submitted successfully!', 'success');

    await onSuccess();
    return { answers };
  } catch (err) {
    ctx?.showNotification((err as Error).message, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Questionnaire';
    }
    return null;
  }
}

export function handleBack(onComplete: () => void): void {
  gsap.to('.cp-questionnaire-form-wrapper', {
    opacity: 0,
    x: 20,
    duration: 0.2,
    ease: 'power2.in',
    onComplete
  });
}
