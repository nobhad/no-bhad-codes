/**
 * ===============================================
 * TERMINAL INTAKE MODULE
 * ===============================================
 * @file src/features/client/terminal-intake.ts
 *
 * AI Chat-style intake form that collects project information
 * through a conversational terminal interface.
 */

import { getContactEmail } from '../../config/branding';
import { BaseModule } from '../../modules/core/base';
import type {
  IntakeQuestion,
  IntakeData,
  ChatMessage,
  TerminalIntakeOptions,
  SavedProgress
} from './terminal-intake-types';
import { QUESTIONS, BUDGET_OPTIONS, FEATURE_OPTIONS, getBaseQuestionCount } from './terminal-intake-data';
import {
  renderTerminalHTML,
  showAvatarIntro,
  addBootMessage,
  addBootstrapMessage,
  stopBootstrapPulsing,
  showTypingIndicator,
  createMessageElement,
  addMessageWithTyping,
  addSystemMessageWithTyping,
  addSystemMessageHtml,
  setupCustomInputCursor,
  updateProgressBar,
  scrollToBottom,
  scrollToQuestion,
  sanitizeInput,
  capitalizeWords,
  delay
} from './terminal-intake-ui';
import {
  formatHelpText,
  formatStatusText,
  isCommand,
  parseCommand,
  commandExists
} from './terminal-intake-commands';

// Re-export types for external consumers
export type { TerminalIntakeOptions } from './terminal-intake-types';

export class TerminalIntakeModule extends BaseModule {
  private terminalContainer: HTMLElement;
  private chatContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressPercent: HTMLElement | null = null;

  private currentQuestionIndex = 0;
  private intakeData: IntakeData = {};
  private messages: ChatMessage[] = [];
  private isProcessing = false;
  private isInSpecialPrompt = false; // Blocks regular handlers during resume/confirm prompts
  private selectedOptions: string[] = [];
  private isModal: boolean;
  private clientData: TerminalIntakeOptions['clientData'];

  private static STORAGE_KEY = 'terminalIntakeProgress';

  // Command history for arrow key navigation
  private inputHistory: string[] = [];
  private historyIndex = -1;

  // Guard against duplicate askToResume calls
  private resumePromptShown = false;

  constructor(container: HTMLElement, options: TerminalIntakeOptions = {}) {
    super('TerminalIntake', { debug: false });
    this.terminalContainer = container;
    this.isModal = options.isModal ?? false;
    this.clientData = options.clientData;
  }

  protected override async onInit(): Promise<void> {
    this.log('onInit called');
    this.render();
    this.bindEvents();

    const savedProgress = this.loadProgress();
    this.log('Saved progress:', savedProgress ? `index=${savedProgress.currentQuestionIndex}` : 'none');
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      this.log('Calling askToResume');
      await this.askToResume(savedProgress);
    } else {
      this.log('Calling startConversation');
      await this.startConversation();
    }
  }

  renderOnly(): void {
    this.log('Rendering only (no animations)...');
    this.render();
    this.bindEvents();
  }

  startAnimations(): void {
    this.log('Starting animations...');
    const savedProgress = this.loadProgress();
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      this.askToResume(savedProgress);
    } else {
      this.startConversation();
    }
  }

  private saveProgress(): void {
    const progress: SavedProgress = {
      currentQuestionIndex: this.currentQuestionIndex,
      intakeData: this.intakeData,
      timestamp: Date.now()
    };
    localStorage.setItem(TerminalIntakeModule.STORAGE_KEY, JSON.stringify(progress));
  }

  private loadProgress(): SavedProgress | null {
    try {
      const saved = localStorage.getItem(TerminalIntakeModule.STORAGE_KEY);
      if (saved) {
        const progress = JSON.parse(saved) as SavedProgress;
        if (Date.now() - progress.timestamp < 24 * 60 * 60 * 1000) {
          return progress;
        }
      }
    } catch (e) {
      this.error('Error loading progress:', e);
    }
    return null;
  }

  private clearProgress(): void {
    localStorage.removeItem(TerminalIntakeModule.STORAGE_KEY);
  }

  private async askToResume(savedProgress: SavedProgress): Promise<void> {
    // Prevent duplicate resume prompts
    if (this.resumePromptShown) {
      this.log('[askToResume] Already shown, skipping');
      return;
    }
    this.resumePromptShown = true;

    let bootstrapElement: HTMLElement | null = null;
    if (this.chatContainer) {
      bootstrapElement = addBootstrapMessage(this.chatContainer);
    }
    await delay(300);
    await this.addBootMessageLocal('  ✓ Previous session detected');
    if (bootstrapElement) {
      stopBootstrapPulsing(bootstrapElement);
    }
    await delay(400);

    // Block regular handlers during this special prompt
    this.isInSpecialPrompt = true;

    let handled = false;
    let handleResumeKeydown: ((e: KeyboardEvent) => void) | null = null;

    const processChoice = async (choice: 'resume' | 'restart', displayText: string) => {
      this.log('[PROCESS CHOICE] Called with choice:', choice, 'displayText:', displayText, 'handled:', handled);
      if (handled) return;
      handled = true;
      this.log('[PROCESS CHOICE] Processing choice:', choice);

      // Re-enable regular handlers
      this.isInSpecialPrompt = false;

      if (handleResumeKeydown) {
        document.removeEventListener('keydown', handleResumeKeydown);
      }

      this.addMessage({ type: 'user', content: displayText });
      if (this.inputElement) this.inputElement.value = '';

      if (choice === 'resume') {
        this.currentQuestionIndex = savedProgress.currentQuestionIndex;
        this.intakeData = savedProgress.intakeData;
        this.updateProgress();

        await delay(300);
        await this.addBootMessageLocal('  ✓ Progress restored');
        await delay(200);

        await this.showPreviousConversation(savedProgress.currentQuestionIndex);

        await delay(300);
        await this.askCurrentQuestion();
      } else {
        this.clearProgress();
        this.currentQuestionIndex = 0;
        this.intakeData = {};
        this.messages = [];

        if (this.chatContainer) {
          this.chatContainer.innerHTML = '';
        }

        await this.startConversation();
      }
    };

    // Create the message with options that have DIRECT click handlers
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message ai';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = `Welcome back${savedProgress.intakeData.name ? `, ${savedProgress.intakeData.name}` : ''}! I found your previous progress. Would you like to continue where you left off or start fresh?`;
    messageEl.appendChild(contentEl);

    const optionsEl = document.createElement('div');
    optionsEl.className = 'chat-options';

    // Button 1: Resume
    const btn1 = document.createElement('button');
    btn1.className = 'chat-option';
    btn1.dataset.value = 'resume';
    btn1.dataset.resumeBtn = '1';
    btn1.textContent = '[1] Resume where I left off';
    optionsEl.appendChild(btn1);

    // Button 2: Start over
    const btn2 = document.createElement('button');
    btn2.className = 'chat-option';
    btn2.dataset.value = 'restart';
    btn2.dataset.resumeBtn = '2';
    btn2.textContent = '[2] Start over';
    optionsEl.appendChild(btn2);

    // Use event delegation on the options container instead of individual button handlers
    optionsEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btnNum = target.dataset.resumeBtn;
      this.log('[RESUME OPTIONS CLICK] Clicked element:', target.tagName, 'data-resume-btn:', btnNum, 'data-value:', target.dataset.value);

      if (!btnNum) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Disable both buttons immediately
      btn1.disabled = true;
      btn2.disabled = true;

      if (btnNum === '1') {
        processChoice('resume', '[1] Resume where I left off');
      } else if (btnNum === '2') {
        processChoice('restart', '[2] Start over');
      }
    });

    messageEl.appendChild(optionsEl);

    if (this.chatContainer) {
      this.chatContainer.appendChild(messageEl);
      scrollToBottom(this.chatContainer);
    }
    this.messages.push({
      type: 'ai',
      content: contentEl.textContent
    });

    handleResumeKeydown = (e: KeyboardEvent) => {
      this.log('[RESUME KEYDOWN] Key pressed:', e.key, 'handled:', handled);
      if (handled) return;
      if (e.key === '1') {
        this.log('[RESUME KEYDOWN] Processing key 1 - RESUME');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        processChoice('resume', '[1] Resume where I left off');
      } else if (e.key === '2') {
        this.log('[RESUME KEYDOWN] Processing key 2 - START OVER');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        processChoice('restart', '[2] Start over');
      }
    };

    document.addEventListener('keydown', handleResumeKeydown);

    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.placeholder = 'Click or type 1 or 2...';
      this.inputElement.focus();
    }
  }

  private render(): void {
    this.terminalContainer.innerHTML = renderTerminalHTML(this.isModal);

    this.chatContainer = this.terminalContainer.querySelector('#terminalChat');
    this.inputElement = this.terminalContainer.querySelector('#terminalInput');
    this.sendButton = this.terminalContainer.querySelector('#terminalSend');
    this.progressFill = this.terminalContainer.querySelector('#progressFill');
    this.progressPercent = this.terminalContainer.querySelector('#progressPercent');
  }

  private bindEvents(): void {
    this.sendButton?.addEventListener('click', () => this.handleUserInput());

    this.inputElement?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    // Escape key toggles fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('intake-modal');
        if (modal?.classList.contains('open')) {
          modal.classList.toggle('fullscreen');
        }
      }
    });

    // Arrow key command history navigation
    this.inputElement?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && this.inputHistory.length > 0) {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
        } else if (this.historyIndex === -1) {
          this.historyIndex = this.inputHistory.length - 1;
        }
        this.inputElement!.value = this.inputHistory[this.historyIndex] || '';
      }

      if (e.key === 'ArrowDown' && this.inputHistory.length > 0) {
        e.preventDefault();
        if (this.historyIndex < this.inputHistory.length - 1) {
          this.historyIndex++;
          this.inputElement!.value = this.inputHistory[this.historyIndex] || '';
        } else {
          this.historyIndex = this.inputHistory.length;
          this.inputElement!.value = '';
        }
      }
    });

    if (this.inputElement) {
      setupCustomInputCursor(this.inputElement);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const modal = document.getElementById('intake-modal');
        const isModalClosed = modal && !modal.classList.contains('open');
        if (isModalClosed) return;

        // Skip if processing or in a special prompt
        if (this.isProcessing || this.isInSpecialPrompt) return;

        const question = this.getCurrentQuestion();
        if (question?.type === 'multiselect' && this.selectedOptions.length > 0) {
          e.preventDefault();
          this.handleUserInput();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      // Skip if processing or in a special prompt (resume, company confirm, etc.)
      if (this.isProcessing || this.isInSpecialPrompt) return;

      if (this.inputElement) {
        const inputHasText = this.inputElement.value.trim().length > 0;
        const inputIsFocused = document.activeElement === this.inputElement;

        if (inputHasText) return;

        const question = this.getCurrentQuestion();
        if (inputIsFocused && question) {
          const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
          if (textTypes.includes(question.type)) return;
        }
      }

      const modal = document.getElementById('intake-modal');
      if (modal && !modal.classList.contains('open')) return;

      const question = this.getCurrentQuestion();
      if (!question || !question.options) return;
      if (question.type !== 'select' && question.type !== 'multiselect') return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= question.options.length) {
        e.preventDefault();
        const option = question.options[num - 1];

        if (question.type === 'select') {
          this.processAnswer(option.value, option.label);
        } else {
          const optionBtn = this.chatContainer?.querySelector(
            `.chat-option[data-value="${option.value}"]`
          ) as HTMLElement;
          if (optionBtn) {
            optionBtn.classList.toggle('selected');
            if (optionBtn.classList.contains('selected')) {
              if (!this.selectedOptions.includes(option.value)) {
                this.selectedOptions.push(option.value);
              }
            } else {
              this.selectedOptions = this.selectedOptions.filter((v) => v !== option.value);
            }
          }
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      // Skip if processing or in a special prompt
      if (this.isProcessing || this.isInSpecialPrompt) return;

      const modal = document.getElementById('intake-modal');
      if (modal && !modal.classList.contains('open')) return;

      if (e.key !== 'ArrowUp') return;

      if (document.activeElement === this.inputElement && this.inputElement?.value) return;

      if (this.currentQuestionIndex > 0) {
        e.preventDefault();
        this.goBackToQuestion(this.currentQuestionIndex - 1);
      }
    });

    this.chatContainer?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        // Skip resume/restart buttons - they have their own handler
        if (target.dataset.resumeBtn) {
          this.log('[CHAT CONTAINER CLICK] Skipping resume button');
          return;
        }
        this.log('[CHAT CONTAINER CLICK] Option clicked:', target.dataset.value, target.textContent);
        e.stopPropagation();
        this.handleOptionClick(target);
      }
    });

    this.bindModalControls();
  }

  private bindModalControls(): void {
    const closeBtn = this.terminalContainer.querySelector('#terminalClose');
    closeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intake-modal');
      const backdrop = document.getElementById('intake-modal-backdrop');
      if (modal) {
        modal.classList.remove('open', 'minimized', 'fullscreen');
        document.body.style.overflow = '';
        (window as typeof globalThis & { terminalIntakeInitialized?: boolean }).terminalIntakeInitialized = false;
        const container = document.querySelector('#intake-modal .terminal-intake-container');
        if (container) container.innerHTML = '';
      }
      if (backdrop) {
        backdrop.classList.remove('open');
      }
      // Dispatch event so index.html can reset terminalModule
      window.dispatchEvent(new CustomEvent('intakeModalClosed'));
    });

    const minimizeBtn = this.terminalContainer.querySelector('#terminalMinimize');
    minimizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intake-modal');
      if (modal) {
        modal.classList.remove('fullscreen');
        modal.classList.toggle('minimized');
      }
    });

    const maximizeBtn = this.terminalContainer.querySelector('#terminalMaximize');
    maximizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intake-modal');
      if (modal) {
        modal.classList.remove('minimized');
        modal.classList.toggle('fullscreen');
      }
    });

    const header = this.terminalContainer.querySelector('.terminal-header');
    header?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('terminal-btn')) {
        const modal = document.getElementById('intake-modal');
        if (modal?.classList.contains('minimized')) {
          modal.classList.remove('minimized');
        }
      }
    });
  }

  private async startConversation(): Promise<void> {
    const cursor = document.getElementById('terminalCursor');
    if (cursor) {
      cursor.style.display = 'none';
    }

    await delay(100);

    if (this.chatContainer) {
      await showAvatarIntro(this.chatContainer);
    }
    await delay(150);

    // Boot sequence with animated dots
    let bootstrapElement: HTMLElement | null = null;
    if (this.chatContainer) {
      bootstrapElement = addBootstrapMessage(this.chatContainer);
    }
    await delay(1000);

    await this.addBootMessageLocal('  ✓ Loading intake module');
    await delay(700);

    await this.addBootMessageLocal('  ✓ Initializing question flow');
    await delay(700);

    await this.addBootMessageLocal('  ✓ Ready to collect project details');

    // Stop pulsing dots
    if (bootstrapElement) {
      stopBootstrapPulsing(bootstrapElement);
    }
    await delay(200);

    await this.addBootMessageLocal('');
    await delay(150);

    if (this.clientData) {
      await this.handleExistingClientData();
    } else {
      await this.askCurrentQuestion();
    }
  }

  private async addBootMessageLocal(text: string): Promise<void> {
    if (this.chatContainer) {
      addBootMessage(this.chatContainer, text);
    }
  }

  private async handleExistingClientData(): Promise<void> {
    if (this.clientData?.name) {
      this.intakeData.name = this.clientData.name;
    }
    if (this.clientData?.email) {
      this.intakeData.email = this.clientData.email;
    }

    // Skip to the first unanswered question
    await this.skipToRelevantQuestion();
  }

  private async skipToRelevantQuestion(): Promise<void> {
    const fieldsToSkip = ['name', 'email'];

    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      if (
        fieldsToSkip.includes(question.field) &&
        this.intakeData[question.field as keyof IntakeData]
      ) {
        this.currentQuestionIndex++;
        continue;
      }

      if (question.dependsOn) {
        const depValue = this.intakeData[question.dependsOn.field as keyof IntakeData];
        const expectedValue = question.dependsOn.value;

        let matches = false;
        if (Array.isArray(depValue)) {
          matches = Array.isArray(expectedValue)
            ? expectedValue.some((v) => depValue.includes(v))
            : depValue.includes(expectedValue);
        } else {
          matches = depValue === expectedValue;
        }

        if (!matches) {
          this.currentQuestionIndex++;
          continue;
        }
      }

      break;
    }

    await this.askCurrentQuestion();
  }

  private async showPreviousConversation(upToIndex: number): Promise<void> {
    this.addMessage({
      type: 'system',
      content: '--- Previous answers ---'
    });

    await delay(100);

    for (let i = 0; i < upToIndex; i++) {
      const question = QUESTIONS[i];

      if (question.dependsOn) {
        const dependencyField = question.dependsOn.field;
        const dependencyValue = this.intakeData[dependencyField];
        const requiredValue = question.dependsOn.value;

        const matches = Array.isArray(requiredValue)
          ? requiredValue.includes(dependencyValue as string)
          : dependencyValue === requiredValue;

        if (!matches) continue;
      }

      const answer = question.field ? this.intakeData[question.field] : undefined;
      if (answer === undefined) continue;

      this.addMessage({
        type: 'ai',
        content: question.question,
        questionIndex: i,
        options: question.options
      });

      // Mark selected option(s) for visual feedback
      const questionEl = this.chatContainer?.querySelector(
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

      let displayAnswer: string;
      if (Array.isArray(answer)) {
        displayAnswer = answer.join(', ');
      } else {
        displayAnswer = String(answer);
      }

      this.addMessage({
        type: 'user',
        content: displayAnswer,
        questionIndex: i
      });
    }

    this.addMessage({
      type: 'system',
      content: '--- Continuing ---'
    });

    await delay(100);
  }

  private getCurrentQuestion(): IntakeQuestion | null {
    // Find the next valid question starting from currentQuestionIndex
    let searchIndex = this.currentQuestionIndex;

    while (searchIndex < QUESTIONS.length) {
      const question = QUESTIONS[searchIndex];

      if (question.dependsOn) {
        const dependentValue = this.intakeData[question.dependsOn.field];
        const requiredValue = question.dependsOn.value;

        let matches = false;
        if (Array.isArray(dependentValue)) {
          matches = Array.isArray(requiredValue)
            ? requiredValue.some((v) => dependentValue.includes(v))
            : dependentValue.includes(requiredValue);
        } else if (Array.isArray(requiredValue)) {
          matches = requiredValue.includes(dependentValue as string);
        } else {
          matches = dependentValue === requiredValue;
        }

        if (!matches) {
          searchIndex++;
          continue;
        }
      }

      // Found a valid question - update index and return
      this.currentQuestionIndex = searchIndex;
      return question;
    }

    // No more questions
    this.currentQuestionIndex = searchIndex;
    return null;
  }

  private async askCurrentQuestion(skipTyping: boolean = false): Promise<void> {
    const question = this.getCurrentQuestion();

    if (!question) {
      await this.showReviewAndConfirm();
      return;
    }

    if (question.id === 'budget') {
      const projectType = (this.intakeData.projectType as string) || 'other';
      question.options = BUDGET_OPTIONS[projectType] || BUDGET_OPTIONS.other;
    }

    if (question.id === 'features') {
      const projectType = (this.intakeData.projectType as string) || 'other';
      question.options = FEATURE_OPTIONS[projectType] || FEATURE_OPTIONS.other;
    }

    let questionText = question.question;
    if (questionText.includes('{{name}}')) {
      questionText = questionText.replace('{{name}}', (this.intakeData.name as string) || 'there');
    }

    if (!skipTyping && this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 350);
    }

    const message: ChatMessage = {
      type: 'ai',
      content: questionText,
      questionIndex: this.currentQuestionIndex
    };

    if (question.type === 'select' && question.options) {
      message.options = question.options;
    } else if (question.type === 'multiselect' && question.options) {
      message.options = question.options;
      message.multiSelect = true;
    }

    if (skipTyping) {
      this.addMessage(message);
    } else if (this.chatContainer) {
      await addMessageWithTyping(
        this.chatContainer,
        message,
        this.currentQuestionIndex,
        (index) => this.goBackToQuestion(index),
        (target) => this.handleOptionClick(target),
        () => this.handleUserInput()
      );
      this.messages.push(message);
    }

    if (this.inputElement) {
      this.inputElement.placeholder = question.placeholder || 'Click or type your response...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    if (this.sendButton) {
      this.sendButton.disabled = false;
    }

    this.selectedOptions = [];
    this.updateProgress();
  }

  private handleOptionClick(target: HTMLElement): void {
    this.log('[HANDLE OPTION CLICK] Called with value:', target.dataset.value, 'isProcessing:', this.isProcessing, 'isInSpecialPrompt:', this.isInSpecialPrompt);
    // Skip if processing or in a special prompt (resume, review, etc.)
    if (this.isProcessing || this.isInSpecialPrompt) return;

    const value = target.dataset.value;
    if (!value) return;

    // Check if this option belongs to the current question or a different one
    const parentMessage = target.closest('[data-question-index]');
    if (parentMessage) {
      const optionQuestionIndex = parseInt(
        parentMessage.getAttribute('data-question-index') || '-1',
        10
      );

      // If clicking on an option from a DIFFERENT question, go to that question for editing
      if (optionQuestionIndex !== -1 && optionQuestionIndex !== this.currentQuestionIndex) {
        this.goBackToQuestion(optionQuestionIndex);
        return;
      }
    }

    const question = this.getCurrentQuestion();
    if (!question) return;

    if (question.type === 'multiselect') {
      target.classList.toggle('selected');
      if (target.classList.contains('selected')) {
        this.selectedOptions.push(value);
      } else {
        this.selectedOptions = this.selectedOptions.filter((v) => v !== value);
      }
    } else {
      this.processAnswer(value, target.textContent || value);
    }
  }

  private async handleUserInput(): Promise<void> {
    // Skip if processing or in a special prompt (resume, review, etc.)
    if (this.isProcessing || this.isInSpecialPrompt) return;

    const inputValue = this.inputElement?.value.trim() || '';

    // Check for CLI commands (start with /)
    if (isCommand(inputValue)) {
      await this.handleCommand(inputValue);
      return;
    }

    const question = this.getCurrentQuestion();
    if (!question) return;

    let value: string | string[];
    let displayValue: string;

    if (question.type === 'multiselect' && this.selectedOptions.length > 0) {
      value = this.selectedOptions;
      displayValue = this.selectedOptions
        .map((v) => question.options?.find((o) => o.value === v)?.label || v)
        .join(', ');
    } else if (question.type === 'select') {
      const selectInput = this.inputElement?.value.trim();
      if (!selectInput || !question.options) return;

      const numericInput = parseInt(selectInput, 10);
      let matchedOption: { value: string; label: string } | undefined;

      if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= question.options.length) {
        matchedOption = question.options[numericInput - 1];
      } else {
        const lowerInput = selectInput.toLowerCase();
        matchedOption = question.options.find(
          (opt) =>
            opt.label.toLowerCase().includes(lowerInput) ||
            opt.value.toLowerCase().includes(lowerInput)
        );
      }

      if (!matchedOption) {
        this.addMessage({
          type: 'error',
          content: `Invalid selection. Please enter a number (1-${question.options.length}) or click an option.`
        });
        return;
      }

      value = matchedOption.value;
      displayValue = matchedOption.label;
    } else {
      const textInput = this.inputElement?.value.trim();
      if (!textInput) return;
      value = sanitizeInput(textInput);
      displayValue = sanitizeInput(textInput);
    }

    await this.processAnswer(value, displayValue);
  }

  /**
   * Handle CLI commands (starting with /)
   */
  private async handleCommand(input: string): Promise<void> {
    const { command } = parseCommand(input);

    // Show the command in chat
    this.addMessage({ type: 'user', content: input });

    // Add to history
    this.inputHistory.push(input);
    this.historyIndex = this.inputHistory.length;

    // Clear input
    if (this.inputElement) {
      this.inputElement.value = '';
    }

    // Check if command exists
    if (!commandExists(command)) {
      this.addMessage({
        type: 'error',
        content: `Command not found: /${command}. Type /help for available commands.`
      });
      return;
    }

    // Handle each command
    switch (command) {
    case 'help':
      this.addMessage({ type: 'system', content: formatHelpText() });
      break;

    case 'clear':
      if (this.chatContainer) {
        // Keep the login info, clear everything else
        const loginInfo = this.chatContainer.querySelector('.terminal-login-info');
        this.chatContainer.innerHTML = '';
        if (loginInfo) {
          this.chatContainer.appendChild(loginInfo.cloneNode(true));
        }
      }
      break;

    case 'restart':
      this.clearProgress();
      this.currentQuestionIndex = 0;
      this.intakeData = {};
      this.messages = [];
      this.inputHistory = [];
      this.historyIndex = -1;
      if (this.chatContainer) {
        this.chatContainer.innerHTML = '';
      }
      await this.startConversation();
      break;

    case 'back':
      if (this.currentQuestionIndex > 0) {
        await this.goBackToQuestion(this.currentQuestionIndex - 1);
      } else {
        this.addMessage({
          type: 'error',
          content: 'Already at the first question.'
        });
      }
      break;

    case 'skip':
      // Only allow skip for optional questions (none currently, but infrastructure ready)
      this.addMessage({
        type: 'error',
        content: 'This question is required and cannot be skipped.'
      });
      break;

    case 'status': {
      const answeredFields = Object.keys(this.intakeData);
      const totalQuestions = getBaseQuestionCount();
      this.addMessage({
        type: 'system',
        content: formatStatusText(this.currentQuestionIndex, totalQuestions, answeredFields)
      });
      break;
    }

    default:
      this.addMessage({
        type: 'error',
        content: `Unknown command: /${command}`
      });
    }
  }

  private async processAnswer(value: string | string[], displayValue: string): Promise<void> {
    this.isProcessing = true;

    // If we're editing a previous answer, use in-place update
    if (this.editingQuestionIndex !== null) {
      const editIndex = this.editingQuestionIndex;
      const question = QUESTIONS[editIndex];

      // Validate if needed
      if (question.validation && typeof value === 'string') {
        const error = question.validation(value);
        if (error) {
          this.addMessage({ type: 'error', content: error });
          this.isProcessing = false;
          return;
        }
      }

      await this.updateAnswerInPlace(editIndex, value, displayValue);
      this.isProcessing = false;
      return;
    }

    const question = this.getCurrentQuestion();
    if (!question) {
      this.isProcessing = false;
      return;
    }

    if (question.validation && typeof value === 'string') {
      const error = question.validation(value);
      if (error) {
        this.addMessage({ type: 'error', content: error });
        this.isProcessing = false;
        return;
      }
    }

    this.addMessage({
      type: 'user',
      content: displayValue,
      questionIndex: this.currentQuestionIndex
    });

    // Mark the selected option(s) as selected for visual feedback
    const questionEl = this.chatContainer?.querySelector(
      `.chat-message[data-question-index="${this.currentQuestionIndex}"]`
    );
    if (questionEl && question.options) {
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

    // Add to command history for arrow key navigation
    this.inputHistory.push(displayValue);
    this.historyIndex = this.inputHistory.length;

    if (question.field) {
      this.intakeData[question.field] = value;
    } else if (question.id === 'greeting') {
      this.intakeData.name = value as string;
    }

    if (this.inputElement) {
      this.inputElement.value = '';
      this.inputElement.disabled = true;
    }

    this.currentQuestionIndex++;

    this.saveProgress();
    this.selectedOptions = [];

    await delay(300);
    await this.askCurrentQuestion();

    // Only set isProcessing to false AFTER the next question is displayed
    this.isProcessing = false;
  }

  private formatFieldForReview(field: string, value: string | string[] | undefined): string {
    if (!value) return 'Not provided';

    if (field === 'name' && typeof value === 'string') {
      return capitalizeWords(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None selected';
    }

    return value;
  }

  private generateReviewSummary(): string {
    const data = this.intakeData;

    // Helper to wrap values in span for blue color styling
    const val = (value: string): string => `<span class="summary-value">${value}</span>`;

    const sections = [
      '--- PROJECT SUMMARY ---',
      '',
      '[CONTACT]',
      `Name: ${val(this.formatFieldForReview('name', data.name as string))}`,
      `Email: ${val(this.formatFieldForReview('email', data.email as string))}`,
      '',
      '[PROJECT]',
      `Type: ${val(this.formatFieldForReview('projectType', data.projectType as string))}`,
      `Description: ${val(this.formatFieldForReview('projectDescription', data.projectDescription as string))}`,
      `Timeline: ${val(this.formatFieldForReview('timeline', data.timeline as string))}`,
      `Budget: ${val(this.formatFieldForReview('budget', data.budget as string))}`,
      '',
      '[TECHNICAL]',
      `Tech Comfort: ${val(this.formatFieldForReview('techComfort', data.techComfort as string))}`,
      `Domain/Hosting: ${val(this.formatFieldForReview('domainHosting', data.domainHosting as string))}`,
      '',
      '[FEATURES & DESIGN]',
      `Features: ${val(this.formatFieldForReview('features', data.features as string[]))}`,
      `Design Level: ${val(this.formatFieldForReview('designLevel', data.designLevel as string))}`,
      '',
      '[NOTES]',
      `Additional Info: ${val(data.additionalInfo ? this.formatFieldForReview('additionalInfo', data.additionalInfo as string) : 'None')}`,
      '',
      '--- END SUMMARY ---'
    ];

    return sections.join('\n');
  }

  private async showReviewAndConfirm(): Promise<void> {
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 400);

      await addMessageWithTyping(
        this.chatContainer,
        {
          type: 'ai',
          content: 'Great! Here\'s a summary of your project request. Please review:'
        },
        this.currentQuestionIndex,
        (index) => this.goBackToQuestion(index),
        (target) => this.handleOptionClick(target),
        () => this.handleUserInput()
      );
    }

    await delay(300);

    if (this.chatContainer) {
      // Render summary with correct colors from the start
      await addSystemMessageHtml(this.chatContainer, this.generateReviewSummary());
    }

    await delay(300);

    if (this.chatContainer) {
      await addSystemMessageWithTyping(
        this.chatContainer,
        'To make changes, scroll back up to the questions and click on the answer you would like to change.'
      );
    }

    await delay(200);

    if (this.chatContainer) {
      await addMessageWithTyping(
        this.chatContainer,
        {
          type: 'ai',
          content: 'Does everything look correct?',
          options: [
            { value: 'yes', label: 'Yes, submit my request' },
            { value: 'no', label: 'No, I need to make changes' }
          ]
        },
        this.currentQuestionIndex,
        (index) => this.goBackToQuestion(index),
        (target) => this.handleOptionClick(target),
        () => this.handleUserInput()
      );
    }

    await this.waitForReviewConfirmation();
  }

  private async waitForReviewConfirmation(): Promise<void> {
    // Block regular handlers during this special prompt
    this.isInSpecialPrompt = true;

    return new Promise((resolve) => {
      let handleConfirmClick: ((e: Event) => Promise<void>) | null = null;
      let handleConfirmKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      const cleanup = () => {
        this.isInSpecialPrompt = false;
        if (handleConfirmClick) {
          this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
        }
        if (handleConfirmKeydown) {
          document.removeEventListener('keydown', handleConfirmKeydown);
        }
      };

      handleConfirmKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          cleanup();
          this.addMessage({ type: 'user', content: '[1] Yes, submit my request' });
          await this.submitIntake();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          cleanup();
          this.addMessage({ type: 'user', content: '[2] No, I need to make changes' });
          this.addMessage({
            type: 'ai',
            content:
              'No problem! Scroll back up to the questions and click on the answer you would like to change. When you\'re done, select an option below.',
            options: [
              { value: 'review', label: 'Done - show summary again' },
              { value: 'restart', label: 'Start over completely' }
            ]
          });
          await this.waitForChangeDecision();
          resolve();
        }
      };

      handleConfirmClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('chat-option')) {
          e.stopPropagation();
          const choice = target.dataset.value;
          const displayText = target.textContent || '';

          cleanup();
          this.addMessage({ type: 'user', content: displayText });

          if (choice === 'yes') {
            await this.submitIntake();
          } else {
            this.addMessage({
              type: 'ai',
              content:
                'No problem! Scroll back up to the questions and click on the answer you would like to change. When you\'re done, select an option below.',
              options: [
                { value: 'review', label: 'Done - show summary again' },
                { value: 'restart', label: 'Start over completely' }
              ]
            });
            await this.waitForChangeDecision();
          }
          resolve();
        }
      };

      this.chatContainer?.addEventListener('click', handleConfirmClick, true);
      document.addEventListener('keydown', handleConfirmKeydown);

      if (this.inputElement) {
        this.inputElement.disabled = false;
        this.inputElement.placeholder = 'Click or type 1 or 2...';
        this.inputElement.focus();
      }
    });
  }

  private async waitForChangeDecision(): Promise<void> {
    // Block regular handlers during this special prompt
    this.isInSpecialPrompt = true;

    return new Promise((resolve) => {
      let handleClick: ((e: Event) => Promise<void>) | null = null;
      let handleKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      const cleanup = () => {
        this.isInSpecialPrompt = false;
        if (handleClick) {
          this.chatContainer?.removeEventListener('click', handleClick, true);
        }
        if (handleKeydown) {
          document.removeEventListener('keydown', handleKeydown);
        }
      };

      handleKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          cleanup();
          this.addMessage({ type: 'user', content: '[1] Done - show summary again' });
          await this.showReviewAndConfirm();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          cleanup();
          this.addMessage({ type: 'user', content: '[2] Start over completely' });
          this.clearProgress();
          this.currentQuestionIndex = 0;
          this.intakeData = {};
          this.messages = [];
          if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
          }
          await this.startConversation();
          resolve();
        }
      };

      handleClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('chat-option')) {
          e.stopPropagation();
          const choice = target.dataset.value;
          const displayText = target.textContent || '';

          cleanup();
          this.addMessage({ type: 'user', content: displayText });

          if (choice === 'review') {
            await this.showReviewAndConfirm();
          } else if (choice === 'restart') {
            this.clearProgress();
            this.currentQuestionIndex = 0;
            this.intakeData = {};
            this.messages = [];
            if (this.chatContainer) {
              this.chatContainer.innerHTML = '';
            }
            await this.startConversation();
          }
          resolve();
        }
      };

      this.chatContainer?.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeydown);

      if (this.inputElement) {
        this.inputElement.disabled = false;
        this.inputElement.placeholder = 'Click or type 1 or 2...';
        this.inputElement.focus();
      }
    });
  }

  private async submitIntake(): Promise<void> {
    this.isProcessing = true;

    if (this.inputElement) this.inputElement.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;

    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 500);
    }
    this.addMessage({
      type: 'ai',
      content: 'Processing your project request...'
    });

    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 700);
    }

    try {
      const submitData = {
        ...this.intakeData,
        features: Array.isArray(this.intakeData.features)
          ? this.intakeData.features
          : [this.intakeData.features].filter(Boolean),
        submittedAt: new Date().toISOString()
      };

      this.log('Submitting data:', submitData);

      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.error('Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();

      this.clearProgress();

      this.addMessage({
        type: 'success',
        content: `
PROJECT REQUEST SUBMITTED SUCCESSFULLY!

What happens next:
1. You'll receive a confirmation email shortly
2. I'll review your requirements within 24-48 hours
3. You'll get a detailed proposal and timeline
4. We'll schedule a call to discuss the details

Thank you for choosing No Bhad Codes!
        `.trim()
      });

      localStorage.removeItem('terminalIntakeData');

      this.updateProgress(100);
    } catch (error) {
      this.error('Submission error:', error);
      this.addMessage({
        type: 'error',
        content: `Failed to submit your request. Please try again or contact ${getContactEmail('fallback')}`
      });

      if (this.inputElement) this.inputElement.disabled = false;
      if (this.sendButton) this.sendButton.disabled = false;
    }

    this.isProcessing = false;
  }

  // Track editing state
  private editingQuestionIndex: number | null = null;
  private editingOldAnswer: string | string[] | undefined = undefined;
  private lastAnsweredQuestionIndex: number = 0;

  private async goBackToQuestion(questionIndex: number): Promise<void> {
    if (this.isProcessing) return;

    if (questionIndex >= QUESTIONS.length || questionIndex < 0) return;

    this.isProcessing = true;

    const question = QUESTIONS[questionIndex];

    // Store the old answer and editing state
    let oldAnswer: string | string[] | undefined;
    if (question.id === 'greeting') {
      oldAnswer = this.intakeData.name as string;
    } else if (question.field) {
      oldAnswer = this.intakeData[question.field];
    }

    // Store editing context
    this.editingQuestionIndex = questionIndex;
    this.editingOldAnswer = oldAnswer;
    this.lastAnsweredQuestionIndex = this.currentQuestionIndex;

    // Set current question to the one being edited
    this.currentQuestionIndex = questionIndex;
    this.selectedOptions = [];

    // For select questions, pre-select the old answer
    if (oldAnswer) {
      if (question.type === 'multiselect' && Array.isArray(oldAnswer)) {
        this.selectedOptions = [...oldAnswer];
        oldAnswer.forEach((value) => {
          const optionBtn = this.chatContainer?.querySelector(
            `.chat-message[data-question-index="${questionIndex}"] .chat-option[data-value="${value}"]`
          ) as HTMLElement;
          if (optionBtn) {
            optionBtn.classList.add('selected');
          }
        });
      } else if (question.type === 'select' && typeof oldAnswer === 'string') {
        const optionBtn = this.chatContainer?.querySelector(
          `.chat-message[data-question-index="${questionIndex}"] .chat-option[data-value="${oldAnswer}"]`
        ) as HTMLElement;
        if (optionBtn) {
          optionBtn.classList.add('selected');
        }
      } else if (typeof oldAnswer === 'string') {
        const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
        if (textTypes.includes(question.type) && this.inputElement) {
          this.inputElement.value = oldAnswer;
          this.inputElement.focus();
          this.inputElement.setSelectionRange(oldAnswer.length, oldAnswer.length);
        }
      }
    }

    // Scroll to the question being edited
    if (this.chatContainer) {
      scrollToQuestion(this.chatContainer, questionIndex);
    }

    // Update input placeholder
    if (this.inputElement) {
      this.inputElement.placeholder = question.placeholder || 'Click or type your response...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    this.isProcessing = false;
  }

  /**
   * Check if any subsequent questions depend on a given field
   */
  private findFirstDependentQuestionIndex(changedField: string, fromIndex: number): number {
    for (let i = fromIndex + 1; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (q.dependsOn && q.dependsOn.field === changedField) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Update answer in place and handle dependencies
   */
  private async updateAnswerInPlace(
    questionIndex: number,
    newValue: string | string[],
    displayValue: string
  ): Promise<void> {
    const question = QUESTIONS[questionIndex];
    const oldAnswer = this.editingOldAnswer;
    const changedField = question.field || (question.id === 'greeting' ? 'name' : '');

    // Check if the answer actually changed
    const answerChanged = JSON.stringify(newValue) !== JSON.stringify(oldAnswer);

    // Update the answer text in the DOM
    const answerElements = this.chatContainer?.querySelectorAll(
      `.chat-message.user[data-question-index="${questionIndex}"]`
    );
    if (answerElements && answerElements.length > 0) {
      const answerEl = answerElements[0];
      const contentEl = answerEl.querySelector('.message-content');
      if (contentEl) {
        // Update just the text, keeping the ::before pseudo-element
        const textNode = contentEl.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = displayValue;
        } else {
          contentEl.textContent = displayValue;
        }
      }
    }

    // Update option highlighting - remove old selection and add new
    const questionEl = this.chatContainer?.querySelector(
      `.chat-message[data-question-index="${questionIndex}"]`
    );
    if (questionEl) {
      // Remove all selected classes from this question's options
      questionEl.querySelectorAll('.chat-option.selected').forEach((opt) => {
        opt.classList.remove('selected');
      });

      // Add selected class to the newly chosen option(s)
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

    // Update the data
    if (question.field) {
      this.intakeData[question.field] = newValue;
    } else if (question.id === 'greeting') {
      this.intakeData.name = newValue as string;
    }

    // Clear editing state
    const lastAnswered = this.lastAnsweredQuestionIndex;
    this.editingQuestionIndex = null;
    this.editingOldAnswer = undefined;

    // If answer changed, check for dependent questions
    if (answerChanged && changedField) {
      const firstDependentIndex = this.findFirstDependentQuestionIndex(changedField, questionIndex);

      if (firstDependentIndex !== -1) {
        // There are dependent questions - need to clear from that point
        // Remove elements from the first dependent question onwards
        if (this.chatContainer) {
          const targetElement = this.chatContainer.querySelector(
            `[data-question-index="${firstDependentIndex}"]`
          );

          if (targetElement) {
            const parent = targetElement.parentElement;
            if (parent) {
              const children = Array.from(parent.children);
              const targetIndex = children.indexOf(targetElement);

              for (let i = children.length - 1; i >= targetIndex; i--) {
                const child = children[i];
                if (
                  !child.classList.contains('terminal-login-info') &&
                  !child.classList.contains('terminal-avatar-intro')
                ) {
                  child.remove();
                }
              }
            }
          }
        }

        // Clear data for dependent questions
        for (let i = firstDependentIndex; i < QUESTIONS.length; i++) {
          const q = QUESTIONS[i];
          if (q.field && this.intakeData[q.field]) {
            delete this.intakeData[q.field];
          }
        }

        // Filter messages array
        this.messages = this.messages.filter((msg) => {
          if (msg.questionIndex === undefined) return true;
          return msg.questionIndex < firstDependentIndex;
        });

        // Continue from the dependent question
        this.currentQuestionIndex = firstDependentIndex;
        this.saveProgress();
        this.updateProgress();

        await delay(300);
        await this.askCurrentQuestion();
        return;
      }
    }

    // No dependent questions affected or answer didn't change
    // Return to where we were
    this.currentQuestionIndex = lastAnswered;
    this.saveProgress();
    this.updateProgress();

    // Scroll back to the last question
    if (this.chatContainer) {
      scrollToBottom(this.chatContainer);
    }

    // Re-enable input for the current question
    if (this.inputElement) {
      const currentQ = this.getCurrentQuestion();
      if (currentQ) {
        this.inputElement.placeholder = currentQ.placeholder || 'Click or type your response...';
      }
      this.inputElement.disabled = false;
    }
  }

  private addMessage(message: ChatMessage): void {
    if (!this.chatContainer) return;

    this.messages.push(message);

    const messageEl = createMessageElement(
      message,
      this.currentQuestionIndex,
      (index) => this.goBackToQuestion(index),
      (target) => this.handleOptionClick(target),
      () => this.handleUserInput()
    );

    this.chatContainer.appendChild(messageEl);
    scrollToBottom(this.chatContainer);
  }

  private updateProgress(override?: number): void {
    const totalBaseQuestions = getBaseQuestionCount();
    const answeredCount = Object.keys(this.intakeData).length;
    const progress =
      override ?? Math.min(Math.round((answeredCount / totalBaseQuestions) * 100), 95);

    updateProgressBar(this.progressFill, this.progressPercent, progress);
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const intakeContainer = document.querySelector('.terminal-intake-container') as HTMLElement;
  if (intakeContainer) {
    const module = new TerminalIntakeModule(intakeContainer);
    module.init().catch((error) => {
      console.error('[TerminalIntake] Failed to initialize:', error);
    });
  }
});
