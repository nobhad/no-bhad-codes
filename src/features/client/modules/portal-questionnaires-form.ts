/**
 * ===============================================
 * PORTAL QUESTIONNAIRES - FORM RENDERING
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires-form.ts
 *
 * Form rendering, question rendering, and conditional logic.
 * Extracted from portal-questionnaires.ts for maintainability.
 */

import { gsap } from 'gsap';
import type { Question, Questionnaire, QuestionnaireResponse } from './portal-questionnaires-types';

// =====================================================
// HELPERS
// =====================================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// CONDITIONAL LOGIC
// =====================================================

/**
 * Check if a question should be visible based on conditional logic
 */
export function isQuestionVisible(question: Question, answers: Record<string, unknown>): boolean {
  if (!question.conditionalOn) return true;

  const { questionId, value: conditionValue } = question.conditionalOn;
  const answer = answers[questionId];

  if (answer === undefined || answer === null || answer === '') return false;

  if (Array.isArray(conditionValue)) {
    if (Array.isArray(answer)) {
      return answer.some((a) => conditionValue.includes(String(a)));
    }
    return conditionValue.includes(String(answer));
  }

  if (Array.isArray(answer)) {
    return answer.includes(conditionValue);
  }

  return String(answer) === String(conditionValue);
}

/**
 * Get list of visible questions based on current answers
 */
export function getVisibleQuestions(questions: Question[], answers: Record<string, unknown>): Question[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

// =====================================================
// QUESTION RENDERING
// =====================================================

export function renderQuestion(question: Question, index: number, isCompleted: boolean): string {
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
          ${(question.options || []).map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
        </select>
      `;
    break;

  case 'multiselect':
    inputHtml = `
        <div class="cp-checkbox-group" id="q_${question.id}">
          ${(question.options || [])
    .map(
      (opt) => `
            <label class="cp-checkbox-label">
              <span class="portal-checkbox">
                <input type="checkbox" name="${question.id}" value="${escapeHtml(opt)}" ${disabled} />
              </span>
              <span>${escapeHtml(opt)}</span>
            </label>
          `
    )
    .join('')}
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

// =====================================================
// FORM RENDERING
// =====================================================

/**
 * Render the questionnaire form into the container
 */
export function renderQuestionnaireForm(
  container: HTMLElement,
  currentQuestionnaire: Questionnaire,
  currentResponse: QuestionnaireResponse,
  currentAnswers: Record<string, unknown>,
  callbacks: {
    onConditionalChange: () => void;
  }
): void {
  const isCompleted = currentResponse.status === 'completed';
  const visibleQuestions = getVisibleQuestions(currentQuestionnaire.questions, currentAnswers);

  const html = `
    <div class="cp-questionnaire-form-wrapper">
      <div class="cp-questionnaire-form-header">
        <button type="button" class="btn btn-ghost questionnaire-back" aria-label="Back to list">
          Back
        </button>
        <h2 class="cp-questionnaire-form-title">${escapeHtml(currentQuestionnaire.name)}</h2>
        ${!isCompleted ? '<button type="button" class="btn btn-secondary btn-sm questionnaire-save" id="save-progress-btn">Save Progress</button>' : ''}
      </div>
      ${currentQuestionnaire.description ? `<p class="cp-questionnaire-form-description">${escapeHtml(currentQuestionnaire.description)}</p>` : ''}

      <form id="questionnaire-answer-form" class="cp-questionnaire-form">
        ${visibleQuestions.map((q, index) => renderQuestion(q, index, isCompleted)).join('')}

        ${
  !isCompleted
    ? `
          <div class="cp-questionnaire-form-actions">
            <button type="button" class="btn btn-secondary questionnaire-save-btn">Save Progress</button>
            <button type="submit" class="btn btn-success">Submit Questionnaire</button>
          </div>
        `
    : ''
}
      </form>
    </div>
  `;

  container.innerHTML = html;

  // Populate answers
  if (currentAnswers) {
    populateAnswers(currentQuestionnaire, currentAnswers);
  }

  // Add change listeners for conditional question updates
  if (!isCompleted) {
    attachConditionalListeners(currentQuestionnaire, callbacks.onConditionalChange);
  }

  // Animate in
  gsap.fromTo(
    '.cp-questionnaire-form-wrapper',
    { opacity: 0, x: 20 },
    { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
  );
}

// =====================================================
// ANSWER POPULATION & COLLECTION
// =====================================================

export function populateAnswers(
  questionnaire: Questionnaire,
  answers: Record<string, unknown>
): void {
  questionnaire.questions.forEach((question) => {
    const answer = answers[question.id];
    if (answer === undefined || answer === null) return;

    if (question.type === 'multiselect') {
      const checkboxes = document.querySelectorAll(`input[name="${question.id}"]`);
      const values = Array.isArray(answer) ? answer : [answer];
      checkboxes.forEach((checkbox) => {
        const input = checkbox as HTMLInputElement;
        if (values.includes(input.value)) {
          input.checked = true;
        }
      });
    } else {
      const input = document.getElementById(`q_${question.id}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      if (input) {
        input.value = String(answer);
      }
    }
  });
}

export function collectAnswers(
  questionnaire: Questionnaire,
  currentAnswers: Record<string, unknown>
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  questionnaire.questions.forEach((question) => {
    if (question.type === 'multiselect') {
      const checkboxes = document.querySelectorAll(`input[name="${question.id}"]:checked`);
      if (checkboxes.length > 0) {
        answers[question.id] = Array.from(checkboxes).map((cb) => (cb as HTMLInputElement).value);
      } else if (currentAnswers[question.id]) {
        answers[question.id] = currentAnswers[question.id];
      }
    } else {
      const input = document.getElementById(`q_${question.id}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      if (input) {
        if (question.type === 'number' && input.value) {
          answers[question.id] = parseFloat(input.value);
        } else {
          answers[question.id] = input.value;
        }
      } else if (currentAnswers[question.id] !== undefined) {
        answers[question.id] = currentAnswers[question.id];
      }
    }
  });

  return answers;
}

export function validateAnswers(
  questionnaire: Questionnaire,
  answers: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  const visibleQuestions = getVisibleQuestions(questionnaire.questions, answers);

  visibleQuestions.forEach((question) => {
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
// CONDITIONAL LISTENERS
// =====================================================

function attachConditionalListeners(
  questionnaire: Questionnaire,
  onConditionalChange: () => void
): void {
  const hasConditionals = questionnaire.questions.some((q) => q.conditionalOn);
  if (!hasConditionals) return;

  const parentQuestionIds = new Set(
    questionnaire.questions
      .filter((q) => q.conditionalOn)
      .map((q) => q.conditionalOn!.questionId)
  );

  parentQuestionIds.forEach((questionId) => {
    const question = questionnaire.questions.find((q) => q.id === questionId);
    if (!question) return;

    if (question.type === 'multiselect') {
      const checkboxes = document.querySelectorAll(`input[name="${questionId}"]`);
      checkboxes.forEach((cb) => {
        cb.addEventListener('change', onConditionalChange);
      });
    } else {
      const input = document.getElementById(`q_${questionId}`);
      if (input) {
        input.addEventListener('change', onConditionalChange);
      }
    }
  });
}
