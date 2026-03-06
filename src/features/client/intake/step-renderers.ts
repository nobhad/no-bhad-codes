/**
 * ===============================================
 * INTAKE - STEP RENDERERS
 * ===============================================
 * @file src/features/client/intake/step-renderers.ts
 *
 * Functions that build review summaries and render
 * previous conversation history in the chat.
 */

import type { IntakeData, ChatMessage } from '../terminal-intake-types';
import { QUESTIONS } from '../terminal-intake-data';
import { capitalizeWords, scrollToBottom } from '../terminal-intake-ui';
import { isDependencyMet } from './step-config';

/**
 * Format a single field value for the review summary
 */
export function formatFieldForReview(
  field: string,
  value: string | string[] | undefined
): string {
  if (!value) return 'Not provided';

  if (field === 'name' && typeof value === 'string') {
    return capitalizeWords(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None selected';
  }

  return value;
}

/**
 * Generate the full review summary HTML string
 */
export function generateReviewSummary(data: IntakeData): string {
  const val = (value: string): string => `<span class="summary-value">${value}</span>`;

  const sections = [
    '--- PROJECT SUMMARY ---',
    '',
    '[CONTACT]',
    `Name: ${val(formatFieldForReview('name', data.name as string))}`,
    `Email: ${val(formatFieldForReview('email', data.email as string))}`,
    '',
    '[PROJECT]',
    `Type: ${val(formatFieldForReview('projectType', data.projectType as string))}`,
    `Description: ${val(formatFieldForReview('projectDescription', data.projectDescription as string))}`,
    `Timeline: ${val(formatFieldForReview('timeline', data.timeline as string))}`,
    `Budget: ${val(formatFieldForReview('budget', data.budget as string))}`,
    '',
    '[TECHNICAL]',
    `Tech Comfort: ${val(formatFieldForReview('techComfort', data.techComfort as string))}`,
    `Domain/Hosting: ${val(formatFieldForReview('domainHosting', data.domainHosting as string))}`,
    '',
    '[FEATURES & DESIGN]',
    `Features: ${val(formatFieldForReview('features', data.features as string[]))}`,
    `Design Level: ${val(formatFieldForReview('designLevel', data.designLevel as string))}`,
    '',
    '[NOTES]',
    `Additional Info: ${val(data.additionalInfo ? formatFieldForReview('additionalInfo', data.additionalInfo as string) : 'None')}`,
    '',
    '--- END SUMMARY ---'
  ];

  return sections.join('\n');
}

/**
 * Render the previous conversation (for session resume) into the chat container.
 * Adds question/answer message pairs and marks selected options visually.
 */
export function renderPreviousConversation(
  chatContainer: HTMLElement,
  intakeData: IntakeData,
  upToIndex: number,
  addMessageFn: (message: ChatMessage) => void
): void {
  addMessageFn({
    type: 'system',
    content: '--- Previous answers ---'
  });

  for (let i = 0; i < upToIndex; i++) {
    const question = QUESTIONS[i];

    if (question.dependsOn && !isDependencyMet(question.dependsOn, intakeData)) {
      continue;
    }

    const answer = question.field ? intakeData[question.field] : undefined;
    if (answer === undefined) continue;

    addMessageFn({
      type: 'ai',
      content: question.question,
      questionIndex: i,
      options: question.options
    });

    // Mark selected option(s) for visual feedback
    const questionEl = chatContainer.querySelector(
      `.chat-message[data-question-index="${i}"]`
    );
    if (questionEl && question.options) {
      if (Array.isArray(answer)) {
        answer.forEach((val) => {
          const optBtn = questionEl.querySelector(`.chat-option[data-value="${val}"]`);
          if (optBtn) optBtn.classList.add('selected');
        });
      } else {
        const optBtn = questionEl.querySelector(`.chat-option[data-value="${answer}"]`);
        if (optBtn) optBtn.classList.add('selected');
      }
    }

    const displayAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer);

    addMessageFn({
      type: 'user',
      content: displayAnswer,
      questionIndex: i
    });
  }

  addMessageFn({
    type: 'system',
    content: '--- Continuing ---'
  });
}

/**
 * Update the displayed answer text and option highlighting in-place
 * after an inline edit.
 */
export function updateAnswerDisplay(
  chatContainer: HTMLElement,
  questionIndex: number,
  newValue: string | string[],
  displayValue: string
): void {
  // Update the answer text in the DOM
  const answerElements = chatContainer.querySelectorAll(
    `.chat-message.user[data-question-index="${questionIndex}"]`
  );
  if (answerElements.length > 0) {
    const answerEl = answerElements[0];
    const contentEl = answerEl.querySelector('.message-content');
    if (contentEl) {
      const textNode = contentEl.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = displayValue;
      } else {
        contentEl.textContent = displayValue;
      }
    }
  }

  // Update option highlighting
  const questionEl = chatContainer.querySelector(
    `.chat-message[data-question-index="${questionIndex}"]`
  );
  if (questionEl) {
    questionEl.querySelectorAll('.chat-option.selected').forEach((opt) => {
      opt.classList.remove('selected');
    });

    if (Array.isArray(newValue)) {
      newValue.forEach((val) => {
        const optBtn = questionEl.querySelector(`.chat-option[data-value="${val}"]`);
        if (optBtn) optBtn.classList.add('selected');
      });
    } else {
      const optBtn = questionEl.querySelector(`.chat-option[data-value="${newValue}"]`);
      if (optBtn) optBtn.classList.add('selected');
    }
  }
}

/**
 * Remove all chat elements from a dependent question index onward.
 * Preserves login info and avatar intro elements.
 */
export function removeElementsFromIndex(
  chatContainer: HTMLElement,
  fromQuestionIndex: number
): void {
  const targetElement = chatContainer.querySelector(
    `[data-question-index="${fromQuestionIndex}"]`
  );

  if (!targetElement) return;

  const parent = targetElement.parentElement;
  if (!parent) return;

  const children = Array.from(parent.children);
  const targetIdx = children.indexOf(targetElement);

  for (let i = children.length - 1; i >= targetIdx; i--) {
    const child = children[i];
    if (
      !child.classList.contains('terminal-login-info') &&
      !child.classList.contains('terminal-avatar-intro')
    ) {
      child.remove();
    }
  }
}

/**
 * Mark selected option(s) visually on a question element
 */
export function markSelectedOptions(
  chatContainer: HTMLElement,
  questionIndex: number,
  value: string | string[]
): void {
  const questionEl = chatContainer.querySelector(
    `.chat-message[data-question-index="${questionIndex}"]`
  );
  if (!questionEl) return;

  if (Array.isArray(value)) {
    value.forEach((val) => {
      const optBtn = questionEl.querySelector(`.chat-option[data-value="${val}"]`);
      if (optBtn) optBtn.classList.add('selected');
    });
  } else {
    const optBtn = questionEl.querySelector(`.chat-option[data-value="${value}"]`);
    if (optBtn) optBtn.classList.add('selected');
  }
}

/**
 * Scroll the chat container to the bottom
 */
export { scrollToBottom };
