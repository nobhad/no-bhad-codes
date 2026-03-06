/**
 * ===============================================
 * INTAKE - EVENT BINDING
 * ===============================================
 * @file src/features/client/intake/event-binding.ts
 *
 * Event handler setup for the terminal intake module.
 * Extracted to reduce the main module file size.
 */

import type { IntakeQuestion } from '../terminal-intake-types';
import { setupCustomInputCursor } from '../terminal-intake-ui';

/**
 * Context object providing access to the module's state and methods
 * needed by event handlers.
 */
export interface EventBindingContext {
  readonly inputElement: HTMLInputElement | null;
  readonly sendButton: HTMLButtonElement | null;
  readonly chatContainer: HTMLElement | null;
  readonly intakeModal: HTMLElement | null;
  readonly intakeModalBackdrop: HTMLElement | null;
  readonly terminalContainer: HTMLElement;
  isProcessing: boolean;
  isInSpecialPrompt: boolean;
  selectedOptions: string[];
  inputHistory: string[];
  historyIndex: number;
  currentQuestionIndex: number;
  getCurrentQuestion: () => IntakeQuestion | null;
  handleUserInput: () => void;
  handleOptionClick: (target: HTMLElement) => void;
  goBackToQuestion: (index: number) => void;
  processAnswer: (value: string | string[], displayValue: string) => void;
}

/**
 * Bind the core terminal input events (send button, enter key, cursor).
 */
export function bindCoreInputEvents(ctx: EventBindingContext): void {
  ctx.sendButton?.addEventListener('click', () => ctx.handleUserInput());

  ctx.inputElement?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ctx.handleUserInput();
    }
  });

  if (ctx.inputElement) {
    setupCustomInputCursor(ctx.inputElement);
  }
}

/**
 * Bind arrow key command history navigation on the input element.
 */
export function bindCommandHistory(ctx: EventBindingContext): void {
  ctx.inputElement?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && ctx.inputHistory.length > 0) {
      e.preventDefault();
      if (ctx.historyIndex > 0) {
        ctx.historyIndex--;
      } else if (ctx.historyIndex === -1) {
        ctx.historyIndex = ctx.inputHistory.length - 1;
      }
      ctx.inputElement!.value = ctx.inputHistory[ctx.historyIndex] || '';
    }

    if (e.key === 'ArrowDown' && ctx.inputHistory.length > 0) {
      e.preventDefault();
      if (ctx.historyIndex < ctx.inputHistory.length - 1) {
        ctx.historyIndex++;
        ctx.inputElement!.value = ctx.inputHistory[ctx.historyIndex] || '';
      } else {
        ctx.historyIndex = ctx.inputHistory.length;
        ctx.inputElement!.value = '';
      }
    }
  });
}

/**
 * Bind global keyboard shortcuts (Escape, Enter for multiselect,
 * number keys for option selection, ArrowUp to go back).
 */
export function bindGlobalKeyboardShortcuts(ctx: EventBindingContext): void {
  // Escape toggles fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ctx.intakeModal?.classList.contains('open')) {
        ctx.intakeModal.classList.toggle('fullscreen');
      }
    }
  });

  // Enter key for multiselect confirm
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isModalClosed = ctx.intakeModal && !ctx.intakeModal.classList.contains('open');
      if (isModalClosed) return;
      if (ctx.isProcessing || ctx.isInSpecialPrompt) return;

      const question = ctx.getCurrentQuestion();
      if (question?.type === 'multiselect' && ctx.selectedOptions.length > 0) {
        e.preventDefault();
        ctx.handleUserInput();
      }
    }
  });

  // Number key shortcuts for select/multiselect
  document.addEventListener('keydown', (e) => {
    if (ctx.isProcessing || ctx.isInSpecialPrompt) return;

    if (ctx.inputElement) {
      const inputHasText = ctx.inputElement.value.trim().length > 0;
      const inputIsFocused = document.activeElement === ctx.inputElement;

      if (inputHasText) return;

      const question = ctx.getCurrentQuestion();
      if (inputIsFocused && question) {
        const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
        if (textTypes.includes(question.type)) return;
      }
    }

    if (ctx.intakeModal && !ctx.intakeModal.classList.contains('open')) return;

    const question = ctx.getCurrentQuestion();
    if (!question || !question.options) return;
    if (question.type !== 'select' && question.type !== 'multiselect') return;

    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= question.options.length) {
      e.preventDefault();
      const option = question.options[num - 1];

      if (question.type === 'select') {
        ctx.processAnswer(option.value, option.label);
      } else {
        const optionBtn = ctx.chatContainer?.querySelector(
          `.chat-option[data-value="${option.value}"]`
        ) as HTMLElement;
        if (optionBtn) {
          optionBtn.classList.toggle('selected');
          if (optionBtn.classList.contains('selected')) {
            if (!ctx.selectedOptions.includes(option.value)) {
              ctx.selectedOptions.push(option.value);
            }
          } else {
            ctx.selectedOptions = ctx.selectedOptions.filter((v) => v !== option.value);
          }
        }
      }
    }
  });

  // ArrowUp to go back
  document.addEventListener('keydown', (e) => {
    if (ctx.isProcessing || ctx.isInSpecialPrompt) return;
    if (ctx.intakeModal && !ctx.intakeModal.classList.contains('open')) return;
    if (e.key !== 'ArrowUp') return;
    if (document.activeElement === ctx.inputElement && ctx.inputElement?.value) return;

    if (ctx.currentQuestionIndex > 0) {
      e.preventDefault();
      ctx.goBackToQuestion(ctx.currentQuestionIndex - 1);
    }
  });
}

/**
 * Bind chat option click delegation on the chat container.
 */
export function bindChatOptionClicks(ctx: EventBindingContext): void {
  ctx.chatContainer?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('chat-option')) {
      if (target.dataset.resumeBtn) return;
      e.stopPropagation();
      ctx.handleOptionClick(target);
    }
  });
}

/**
 * Bind modal window controls (close, minimize, maximize, header click).
 */
export function bindModalControls(ctx: EventBindingContext): void {
  const closeBtn = ctx.terminalContainer.querySelector('#terminalClose');
  closeBtn?.addEventListener('click', () => {
    if (ctx.intakeModal) {
      ctx.intakeModal.classList.remove('open', 'minimized', 'fullscreen');
      document.body.style.overflow = '';
      (
        window as typeof globalThis & { terminalIntakeInitialized?: boolean }
      ).terminalIntakeInitialized = false;
      const container = ctx.intakeModal.querySelector('.terminal-intake-container');
      if (container) container.innerHTML = '';
    }
    if (ctx.intakeModalBackdrop) {
      ctx.intakeModalBackdrop.classList.remove('open');
    }
    window.dispatchEvent(new CustomEvent('intakeModalClosed'));
  });

  const minimizeBtn = ctx.terminalContainer.querySelector('#terminalMinimize');
  minimizeBtn?.addEventListener('click', () => {
    if (ctx.intakeModal) {
      ctx.intakeModal.classList.remove('fullscreen');
      ctx.intakeModal.classList.toggle('minimized');
    }
  });

  const maximizeBtn = ctx.terminalContainer.querySelector('#terminalMaximize');
  maximizeBtn?.addEventListener('click', () => {
    if (ctx.intakeModal) {
      ctx.intakeModal.classList.remove('minimized');
      ctx.intakeModal.classList.toggle('fullscreen');
    }
  });

  const header = ctx.terminalContainer.querySelector('.terminal-header');
  header?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('terminal-btn')) {
      if (ctx.intakeModal?.classList.contains('minimized')) {
        ctx.intakeModal.classList.remove('minimized');
      }
    }
  });
}
