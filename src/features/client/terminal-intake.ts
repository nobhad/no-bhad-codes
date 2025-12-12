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
  showTypingIndicator,
  createMessageElement,
  addMessageWithTyping,
  addSystemMessageWithTyping,
  setupCustomInputCursor,
  updateProgressBar,
  scrollToBottom,
  scrollToQuestion,
  sanitizeInput,
  formatPhoneNumber,
  capitalizeWords,
  delay
} from './terminal-intake-ui';

// Re-export types for external consumers
export type { TerminalIntakeOptions } from './terminal-intake-types';

export class TerminalIntakeModule {
  private container: HTMLElement;
  private chatContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressPercent: HTMLElement | null = null;

  private currentQuestionIndex = 0;
  private intakeData: IntakeData = {};
  private messages: ChatMessage[] = [];
  private isProcessing = false;
  private selectedOptions: string[] = [];
  private isModal: boolean;
  private clientData: TerminalIntakeOptions['clientData'];
  private confirmedCompany = false;

  private static STORAGE_KEY = 'terminalIntakeProgress';

  constructor(container: HTMLElement, options: TerminalIntakeOptions = {}) {
    this.container = container;
    this.isModal = options.isModal ?? false;
    this.clientData = options.clientData;
  }

  async init(): Promise<void> {
    console.log('[TerminalIntake] Initializing...');
    this.render();
    this.bindEvents();

    const savedProgress = this.loadProgress();
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      await this.askToResume(savedProgress);
    } else {
      await this.startConversation();
    }

    console.log('[TerminalIntake] Initialized successfully');
  }

  renderOnly(): void {
    console.log('[TerminalIntake] Rendering only (no animations)...');
    this.render();
    this.bindEvents();
  }

  startAnimations(): void {
    console.log('[TerminalIntake] Starting animations...');
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
      console.error('[TerminalIntake] Error loading progress:', e);
    }
    return null;
  }

  private clearProgress(): void {
    localStorage.removeItem(TerminalIntakeModule.STORAGE_KEY);
  }

  private async askToResume(savedProgress: SavedProgress): Promise<void> {
    await this.addBootMessageLocal('Bootstrapping...');
    await delay(300);
    await this.addBootMessageLocal('  ✓ Previous session detected');
    await delay(400);

    this.addMessage({
      type: 'ai',
      content: `Welcome back${savedProgress.intakeData.name ? `, ${savedProgress.intakeData.name}` : ''}! I found your previous progress. Would you like to continue where you left off or start fresh?`,
      options: [
        { value: 'resume', label: 'Resume where I left off' },
        { value: 'restart', label: 'Start over' }
      ]
    });

    let handled = false;
    let handleResumeClick: ((e: Event) => Promise<void>) | null = null;
    let handleResumeKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

    const processChoice = async (choice: 'resume' | 'restart', displayText: string) => {
      if (handled) return;
      handled = true;

      if (handleResumeClick) {
        this.chatContainer?.removeEventListener('click', handleResumeClick, true);
      }
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

    handleResumeClick = async (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        e.stopPropagation();
        const choice = target.dataset.value as 'resume' | 'restart';
        const displayText = target.textContent || choice || '';
        await processChoice(choice, displayText);
      }
    };

    handleResumeKeydown = async (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        e.stopPropagation();
        await processChoice('resume', '[1] Resume where I left off');
      } else if (e.key === '2') {
        e.preventDefault();
        e.stopPropagation();
        await processChoice('restart', '[2] Start over');
      }
    };

    this.chatContainer?.addEventListener('click', handleResumeClick, true);
    document.addEventListener('keydown', handleResumeKeydown);

    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.placeholder = 'Click or type 1 or 2...';
      this.inputElement.focus();
    }
  }

  private render(): void {
    this.container.innerHTML = renderTerminalHTML(this.isModal);

    this.chatContainer = this.container.querySelector('#terminalChat');
    this.inputElement = this.container.querySelector('#terminalInput');
    this.sendButton = this.container.querySelector('#terminalSend');
    this.progressFill = this.container.querySelector('#progressFill');
    this.progressPercent = this.container.querySelector('#progressPercent');
  }

  private bindEvents(): void {
    this.sendButton?.addEventListener('click', () => this.handleUserInput());

    this.inputElement?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    if (this.inputElement) {
      setupCustomInputCursor(this.inputElement);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const modal = document.getElementById('intakeModal');
        const isModalClosed = modal && !modal.classList.contains('open');
        if (isModalClosed) return;

        if (this.isProcessing) return;

        const question = this.getCurrentQuestion();
        if (question?.type === 'multiselect' && this.selectedOptions.length > 0) {
          e.preventDefault();
          this.handleUserInput();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isProcessing) return;

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

      const modal = document.getElementById('intakeModal');
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
      if (this.isProcessing) return;

      const modal = document.getElementById('intakeModal');
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
        e.stopPropagation();
        this.handleOptionClick(target);
      }
    });

    this.bindModalControls();
  }

  private bindModalControls(): void {
    const closeBtn = this.container.querySelector('#terminalClose');
    closeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('open', 'minimized', 'fullscreen');
        document.body.style.overflow = '';
        (window as typeof globalThis & { terminalIntakeInitialized?: boolean }).terminalIntakeInitialized = false;
        const container = document.querySelector('#intakeModal .terminal-intake-container');
        if (container) container.innerHTML = '';
      }
    });

    const minimizeBtn = this.container.querySelector('#terminalMinimize');
    minimizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('fullscreen');
        modal.classList.toggle('minimized');
      }
    });

    const maximizeBtn = this.container.querySelector('#terminalMaximize');
    maximizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('minimized');
        modal.classList.toggle('fullscreen');
      }
    });

    const header = this.container.querySelector('.terminal-header');
    header?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('terminal-btn')) {
        const modal = document.getElementById('intakeModal');
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

    await delay(200);

    if (this.chatContainer) {
      await showAvatarIntro(this.chatContainer);
    }
    await delay(300);

    await this.addBootMessageLocal('Bootstrapping...');
    await delay(300);

    await this.addBootMessageLocal('  ✓ Loading intake module');
    await delay(200);

    await this.addBootMessageLocal('  ✓ Initializing question flow');
    await delay(200);

    await this.addBootMessageLocal('  ✓ Ready to collect project details');
    await delay(400);

    await this.addBootMessageLocal('');
    await delay(300);

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

    if (this.clientData?.company) {
      await this.askCompanyConfirmation();
    } else {
      await this.askIfForCompany();
    }
  }

  private async askCompanyConfirmation(): Promise<void> {
    const companyName = this.clientData?.company || '';
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 500);
    }

    this.addMessage({
      type: 'ai',
      content: `Is this project for "${companyName}"?`,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No, different company/personal' }
      ]
    });

    this.setupCompanyConfirmHandler(companyName);
  }

  private setupCompanyConfirmHandler(companyName: string): void {
    if (this.inputElement) {
      this.inputElement.placeholder = 'Click or type 1 or 2...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    const originalClickHandler = this.handleOptionClick.bind(this);
    const originalInputHandler = this.handleUserInput.bind(this);

    let keyHandler: ((e: KeyboardEvent) => void) | null = null;

    const cleanup = () => {
      this.handleUserInput = originalInputHandler;
      this.handleOptionClick = originalClickHandler;
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
    };

    keyHandler = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        cleanup();
        this.handleCompanyConfirmAnswer('yes', companyName);
      } else if (e.key === '2') {
        e.preventDefault();
        cleanup();
        this.handleCompanyConfirmAnswer('no', companyName);
      }
    };

    this.handleOptionClick = (target: HTMLElement) => {
      const value = target.dataset.value;
      if (value === 'yes' || value === 'no') {
        cleanup();
        this.handleCompanyConfirmAnswer(value, companyName);
      }
    };

    this.handleUserInput = async () => {
      const input = this.inputElement?.value.trim();
      if (input === '1') {
        cleanup();
        this.handleCompanyConfirmAnswer('yes', companyName);
      } else if (input === '2') {
        cleanup();
        this.handleCompanyConfirmAnswer('no', companyName);
      }
    };

    document.addEventListener('keydown', keyHandler);
  }

  private async handleCompanyConfirmAnswer(value: string, companyName: string): Promise<void> {
    const displayText = value === 'yes' ? 'Yes' : 'No, different company/personal';
    this.addMessage({ type: 'user', content: displayText });
    if (this.inputElement) this.inputElement.value = '';

    if (value === 'yes') {
      this.intakeData.company = companyName;
      this.confirmedCompany = true;
      await this.skipToRelevantQuestion();
    } else {
      await this.askIfForCompany();
    }
  }

  private async askIfForCompany(): Promise<void> {
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 500);
    }

    this.addMessage({
      type: 'ai',
      content: 'Is this project for a company or business?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No, personal project' }
      ]
    });

    this.setupForCompanyHandler();
  }

  private setupForCompanyHandler(): void {
    if (this.inputElement) {
      this.inputElement.placeholder = 'Click or type 1 or 2...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    const originalClickHandler = this.handleOptionClick.bind(this);
    const originalInputHandler = this.handleUserInput.bind(this);

    let keyHandler: ((e: KeyboardEvent) => void) | null = null;

    const cleanup = () => {
      this.handleUserInput = originalInputHandler;
      this.handleOptionClick = originalClickHandler;
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
    };

    keyHandler = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        cleanup();
        this.handleForCompanyAnswer('yes');
      } else if (e.key === '2') {
        e.preventDefault();
        cleanup();
        this.handleForCompanyAnswer('no');
      }
    };

    this.handleOptionClick = (target: HTMLElement) => {
      const value = target.dataset.value;
      if (value === 'yes' || value === 'no') {
        cleanup();
        this.handleForCompanyAnswer(value);
      }
    };

    this.handleUserInput = async () => {
      const input = this.inputElement?.value.trim();
      if (input === '1') {
        cleanup();
        this.handleForCompanyAnswer('yes');
      } else if (input === '2') {
        cleanup();
        this.handleForCompanyAnswer('no');
      }
    };

    document.addEventListener('keydown', keyHandler);
  }

  private async handleForCompanyAnswer(value: string): Promise<void> {
    const displayText = value === 'yes' ? 'Yes' : 'No, personal project';
    this.addMessage({ type: 'user', content: displayText });
    if (this.inputElement) this.inputElement.value = '';

    if (value === 'yes') {
      this.confirmedCompany = true;
      await this.askForCompanyName();
    } else {
      this.intakeData.company = '';
      this.confirmedCompany = true;
      await this.skipToRelevantQuestion();
    }
  }

  private async askForCompanyName(): Promise<void> {
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 500);
    }

    this.addMessage({
      type: 'ai',
      content: 'What\'s the company or business name?'
    });

    if (this.inputElement) {
      this.inputElement.placeholder = 'Click or type company name...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    const originalInputHandler = this.handleUserInput.bind(this);
    this.handleUserInput = async () => {
      const value = this.inputElement?.value.trim();
      if (!value) return;

      this.addMessage({ type: 'user', content: value });
      this.intakeData.company = value;
      if (this.inputElement) this.inputElement.value = '';

      this.handleUserInput = originalInputHandler;
      await this.skipToRelevantQuestion();
    };
  }

  private async skipToRelevantQuestion(): Promise<void> {
    const fieldsToSkip = ['name', 'email', 'company'];

    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      if (
        fieldsToSkip.includes(question.field) &&
        this.intakeData[question.field as keyof IntakeData]
      ) {
        this.currentQuestionIndex++;
        continue;
      }

      if (question.field === 'company' && this.confirmedCompany) {
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
        questionIndex: i
      });

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
    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

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
          this.currentQuestionIndex++;
          continue;
        }
      }

      return question;
    }

    return null;
  }

  private async askCurrentQuestion(skipTyping: boolean = false): Promise<void> {
    const question = this.getCurrentQuestion();

    if (!question) {
      await this.showReviewAndConfirm();
      return;
    }

    if (question.field === 'company' && !this.confirmedCompany) {
      await this.askIfForCompany();
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
      await showTypingIndicator(this.chatContainer, 600);
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
    const value = target.dataset.value;
    if (!value) return;

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
    if (this.isProcessing) return;

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
      const inputValue = this.inputElement?.value.trim();
      if (!inputValue || !question.options) return;

      const numericInput = parseInt(inputValue, 10);
      let matchedOption: { value: string; label: string } | undefined;

      if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= question.options.length) {
        matchedOption = question.options[numericInput - 1];
      } else {
        const lowerInput = inputValue.toLowerCase();
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
      const inputValue = this.inputElement?.value.trim();
      if (!inputValue) return;
      value = sanitizeInput(inputValue);
      displayValue = sanitizeInput(inputValue);
    }

    await this.processAnswer(value, displayValue);
  }

  private async processAnswer(value: string | string[], displayValue: string): Promise<void> {
    this.isProcessing = true;

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
    this.isProcessing = false;

    this.saveProgress();
    this.selectedOptions = [];

    await delay(300);
    await this.askCurrentQuestion();
  }

  private formatFieldForReview(field: string, value: string | string[] | undefined): string {
    if (field === 'company' && value === '') {
      return 'N/A (Personal Project)';
    }
    if (!value) return 'Not provided';

    if (field === 'phone' && typeof value === 'string') {
      return formatPhoneNumber(value);
    }

    if (field === 'name' && typeof value === 'string') {
      return capitalizeWords(value);
    }

    if (field === 'company' && typeof value === 'string') {
      return capitalizeWords(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None selected';
    }

    if (typeof value === 'string' && value.length > 0) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    return value;
  }

  private generateReviewSummary(): string {
    const data = this.intakeData;

    const sections = [
      '--- PROJECT SUMMARY ---',
      '',
      '[CONTACT]',
      `Name: ${this.formatFieldForReview('name', data.name as string)}`,
      `Email: ${this.formatFieldForReview('email', data.email as string)}`,
      `Company: ${this.formatFieldForReview('company', data.company as string)}`,
      `Phone: ${this.formatFieldForReview('phone', data.phone as string)}`,
      '',
      '[PROJECT]',
      `Type: ${this.formatFieldForReview('projectType', data.projectType as string)}`,
      `Description: ${this.formatFieldForReview('projectDescription', data.projectDescription as string)}`,
      `Timeline: ${this.formatFieldForReview('timeline', data.timeline as string)}`,
      `Budget: ${this.formatFieldForReview('budget', data.budget as string)}`,
      '',
      '[FEATURES]',
      `Features: ${this.formatFieldForReview('features', data.features as string[])}`,
      `Custom Features: ${data.customFeatures ? data.customFeatures : 'N/A'}`,
      `Need Integrations: ${this.formatFieldForReview('hasIntegrations', data.hasIntegrations as string)}`,
      `Integrations: ${data.hasIntegrations === 'yes' ? this.formatFieldForReview('integrations', data.integrations as string[]) : 'N/A'}`,
      '',
      '[DESIGN]',
      `Design Level: ${this.formatFieldForReview('designLevel', data.designLevel as string)}`,
      `Brand Assets: ${this.formatFieldForReview('brandAssets', data.brandAssets as string[])}`,
      `Has Inspiration: ${this.formatFieldForReview('hasInspiration', data.hasInspiration as string)}`,
      `Inspiration URLs: ${data.hasInspiration === 'yes' ? this.formatFieldForReview('inspiration', data.inspiration as string) : 'N/A'}`,
      '',
      '[TECHNICAL]',
      `Tech Comfort: ${this.formatFieldForReview('techComfort', data.techComfort as string)}`,
      `Has Current Site: ${this.formatFieldForReview('hasCurrentSite', data.hasCurrentSite as string)}`,
      `Current Site URL: ${data.hasCurrentSite === 'yes' ? this.formatFieldForReview('currentSite', data.currentSite as string) : 'N/A'}`,
      `Has Domain: ${data.hasCurrentSite === 'no' ? this.formatFieldForReview('hasDomain', data.hasDomain as string) : 'N/A (has current site)'}`,
      `Domain Name: ${data.hasCurrentSite === 'no' && data.hasDomain === 'yes' ? this.formatFieldForReview('domainName', data.domainName as string) : 'N/A'}`,
      `Hosting: ${this.formatFieldForReview('hosting', data.hosting as string)}`,
      `Hosting Provider: ${data.hosting === 'have-hosting' ? this.formatFieldForReview('hostingProvider', data.hostingProvider as string) : 'N/A'}`,
      '',
      '[OTHER]',
      `Concerns: ${this.formatFieldForReview('challenges', data.challenges as string[])}`,
      `Has Additional Info: ${this.formatFieldForReview('hasAdditionalInfo', data.hasAdditionalInfo as string)}`,
      `Additional Notes: ${data.hasAdditionalInfo === 'yes' ? this.formatFieldForReview('additionalInfo', data.additionalInfo as string) : 'N/A'}`,
      `Was Referred: ${this.formatFieldForReview('wasReferred', data.wasReferred as string)}`,
      `Referral Name: ${data.wasReferred === 'yes' ? this.formatFieldForReview('referralName', data.referralName as string) : 'N/A'}`,
      '',
      '--- END SUMMARY ---'
    ];

    return sections.join('\n');
  }

  private async showReviewAndConfirm(): Promise<void> {
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 800);

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
      await addSystemMessageWithTyping(this.chatContainer, this.generateReviewSummary());
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
    return new Promise((resolve) => {
      let handleConfirmClick: ((e: Event) => Promise<void>) | null = null;
      let handleConfirmKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      handleConfirmKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }
          this.addMessage({ type: 'user', content: '[1] Yes, submit my request' });
          await this.submitIntake();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }
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

          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }

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
    return new Promise((resolve) => {
      let handleClick: ((e: Event) => Promise<void>) | null = null;
      let handleKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      handleKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }
          this.addMessage({ type: 'user', content: '[1] Done - show summary again' });
          await this.showReviewAndConfirm();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }
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

          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }

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
      await showTypingIndicator(this.chatContainer, 1000);
    }
    this.addMessage({
      type: 'ai',
      content: 'Processing your project request...'
    });

    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 1500);
    }

    try {
      const submitData = {
        ...this.intakeData,
        features: Array.isArray(this.intakeData.features)
          ? this.intakeData.features
          : [this.intakeData.features].filter(Boolean),
        brandAssets: Array.isArray(this.intakeData.brandAssets)
          ? this.intakeData.brandAssets
          : [this.intakeData.brandAssets].filter(Boolean),
        submittedAt: new Date().toISOString()
      };

      console.log('[TerminalIntake] Submitting data:', submitData);

      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TerminalIntake] Server error response:', errorText);
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
      console.error('[TerminalIntake] Submission error:', error);
      this.addMessage({
        type: 'error',
        content: `Failed to submit your request. Please try again or contact ${getContactEmail('fallback')}`
      });

      if (this.inputElement) this.inputElement.disabled = false;
      if (this.sendButton) this.sendButton.disabled = false;
    }

    this.isProcessing = false;
  }

  private async goBackToQuestion(questionIndex: number): Promise<void> {
    if (this.isProcessing) return;

    if (questionIndex >= QUESTIONS.length || questionIndex < 0) return;

    this.isProcessing = true;

    const question = QUESTIONS[questionIndex];
    let oldAnswer: string | string[] | undefined;
    if (question.id === 'greeting') {
      oldAnswer = this.intakeData.name as string;
    } else if (question.field) {
      oldAnswer = this.intakeData[question.field];
    }

    for (let i = questionIndex; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (q.field && this.intakeData[q.field]) {
        delete this.intakeData[q.field];
      }
    }
    if (questionIndex === 0 && this.intakeData.name) {
      delete this.intakeData.name;
    }

    if (this.chatContainer) {
      const elementsToRemove: Element[] = [];
      this.chatContainer.querySelectorAll('[data-question-index]').forEach((el) => {
        const idx = parseInt(el.getAttribute('data-question-index') || '-1', 10);
        if (idx >= questionIndex) {
          elementsToRemove.push(el);
        }
      });
      elementsToRemove.forEach((el) => el.remove());

      const typingIndicators = this.chatContainer.querySelectorAll('.typing-indicator');
      typingIndicators.forEach((el) => el.remove());
    }

    this.messages = this.messages.filter((msg) => {
      if (msg.questionIndex === undefined) return true;
      return msg.questionIndex < questionIndex;
    });

    this.selectedOptions = [];
    this.currentQuestionIndex = questionIndex;

    this.saveProgress();
    this.updateProgress();

    this.isProcessing = false;

    await delay(200);
    await this.askCurrentQuestion(true);

    if (oldAnswer) {
      if (question.type === 'multiselect' && Array.isArray(oldAnswer)) {
        this.selectedOptions = [...oldAnswer];
        oldAnswer.forEach((value) => {
          const optionBtn = this.chatContainer?.querySelector(
            `.chat-option[data-value="${value}"]`
          ) as HTMLElement;
          if (optionBtn) {
            optionBtn.classList.add('selected');
          }
        });
      } else if (typeof oldAnswer === 'string') {
        const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
        if (textTypes.includes(question.type) && this.inputElement) {
          this.inputElement.value = oldAnswer;
          this.inputElement.focus();
          this.inputElement.setSelectionRange(oldAnswer.length, oldAnswer.length);
        }
      }
    }

    if (this.chatContainer) {
      scrollToQuestion(this.chatContainer, questionIndex);
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
