/**
 * ===============================================
 * INTAKE - BARREL EXPORTS
 * ===============================================
 * @file src/features/client/intake/index.ts
 */

export {
  resolveCurrentQuestion,
  findFirstRelevantQuestionIndex,
  applyDynamicOptions,
  interpolateQuestionText,
  findFirstDependentQuestionIndex,
  isDependencyMet
} from './step-config';

export {
  formatFieldForReview,
  generateReviewSummary,
  renderPreviousConversation,
  updateAnswerDisplay,
  removeElementsFromIndex,
  markSelectedOptions
} from './step-renderers';

export {
  validateAnswer,
  parseSelectInput,
  parseUserInput,
  getInvalidSelectMessage
} from './validation';
export type { ParsedInput } from './validation';

export {
  submitIntakeData,
  buildSubmitPayload,
  buildSuccessMessage
} from './api-handler';
export type { SubmissionResult } from './api-handler';

export {
  runBootSequence,
  runResumeBootSequence,
  addBootMessageToChat
} from './terminal-effects';

export {
  waitForTwoOptionChoice,
  createResumePromptUI
} from './prompt-handlers';
export type { TwoOptionPromptConfig, ResumePromptElements } from './prompt-handlers';

export {
  bindCoreInputEvents,
  bindCommandHistory,
  bindGlobalKeyboardShortcuts,
  bindChatOptionClicks,
  bindModalControls
} from './event-binding';
export type { EventBindingContext } from './event-binding';

export {
  saveIntakeProgress,
  loadIntakeProgress,
  clearIntakeProgress
} from './progress-store';
