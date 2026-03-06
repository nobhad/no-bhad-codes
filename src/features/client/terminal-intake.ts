/**
 * ===============================================
 * TERMINAL INTAKE MODULE
 * ===============================================
 * @file src/features/client/terminal-intake.ts
 *
 * AI Chat-style intake form that collects project information
 * through a conversational terminal interface.
 * Submodules live in ./intake/ (see ./intake/index.ts for barrel exports).
 */

import { BaseModule } from '../../modules/core/base';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TerminalIntake');
import type {
  IntakeData,
  ChatMessage,
  TerminalIntakeOptions,
  SavedProgress
} from './terminal-intake-types';
import { QUESTIONS, getBaseQuestionCount } from './terminal-intake-data';
import {
  renderTerminalHTML,
  showTypingIndicator,
  createMessageElement,
  addMessageWithTyping,
  addSystemMessageWithTyping,
  addSystemMessageHtml,
  updateProgressBar,
  scrollToBottom,
  scrollToQuestion,
  delay
} from './terminal-intake-ui';
import {
  isCommand,
  parseCommand,
  commandExists,
  resolveCommand,
  COMMAND_SIGNALS
} from './terminal-intake-commands';
import { ProposalBuilderModule } from './proposal-builder';
import type { ProposalSelection } from './proposal-builder-types';

import {
  resolveCurrentQuestion,
  findFirstRelevantQuestionIndex,
  applyDynamicOptions,
  interpolateQuestionText,
  findFirstDependentQuestionIndex,
  generateReviewSummary,
  renderPreviousConversation,
  updateAnswerDisplay,
  removeElementsFromIndex,
  markSelectedOptions,
  parseUserInput,
  getInvalidSelectMessage,
  submitIntakeData,
  buildSuccessMessage,
  runBootSequence,
  runResumeBootSequence,
  addBootMessageToChat,
  waitForTwoOptionChoice,
  createResumePromptUI,
  bindCoreInputEvents,
  bindCommandHistory,
  bindGlobalKeyboardShortcuts,
  bindChatOptionClicks,
  bindModalControls,
  saveIntakeProgress,
  loadIntakeProgress,
  clearIntakeProgress
} from './intake';

// Re-export types for external consumers
export type { TerminalIntakeOptions } from './terminal-intake-types';

export class TerminalIntakeModule extends BaseModule {
  private terminalContainer: HTMLElement;
  private chatContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressPercent: HTMLElement | null = null;

  private _intakeModal: HTMLElement | null | undefined = undefined;
  private _intakeModalBackdrop: HTMLElement | null | undefined = undefined;
  private _terminalCursor: HTMLElement | null | undefined = undefined;

  private get intakeModal(): HTMLElement | null {
    if (this._intakeModal === undefined) {
      this._intakeModal = document.getElementById('intake-modal');
    }
    return this._intakeModal;
  }

  private get intakeModalBackdrop(): HTMLElement | null {
    if (this._intakeModalBackdrop === undefined) {
      this._intakeModalBackdrop = document.getElementById('intake-modal-backdrop');
    }
    return this._intakeModalBackdrop;
  }

  private get terminalCursor(): HTMLElement | null {
    if (this._terminalCursor === undefined) {
      this._terminalCursor = document.getElementById('terminalCursor');
    }
    return this._terminalCursor;
  }

  private currentQuestionIndex = 0;
  private intakeData: IntakeData = {};
  private messages: ChatMessage[] = [];
  private isProcessing = false;
  private isInSpecialPrompt = false;
  private selectedOptions: string[] = [];
  private isModal: boolean;
  private clientData: TerminalIntakeOptions['clientData'];

  private inputHistory: string[] = [];
  private historyIndex = -1;
  private resumePromptShown = false;

  private proposalSelection: ProposalSelection | null = null;
  private proposalBuilderContainer: HTMLElement | null = null;

  private editingQuestionIndex: number | null = null;
  private editingOldAnswer: string | string[] | undefined = undefined;
  private lastAnsweredQuestionIndex: number = 0;

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

    const savedProgress = loadIntakeProgress();
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      await this.askToResume(savedProgress);
    } else {
      await this.startConversation();
    }
  }

  renderOnly(): void {
    this.render();
    this.bindEvents();
  }

  startAnimations(): void {
    const savedProgress = loadIntakeProgress();
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      this.askToResume(savedProgress);
    } else {
      this.startConversation();
    }
  }

  // -- Rendering & event binding ----------------------------------------------

  private render(): void {
    this.terminalContainer.innerHTML = renderTerminalHTML(this.isModal);
    this.chatContainer = this.terminalContainer.querySelector('#terminalChat');
    this.inputElement = this.terminalContainer.querySelector('#terminalInput');
    this.sendButton = this.terminalContainer.querySelector('#terminalSend');
    this.progressFill = this.terminalContainer.querySelector('#progressFill');
    this.progressPercent = this.terminalContainer.querySelector('#progressPercent');
  }

  private bindEvents(): void {
    // We need a proxy-like context so the extracted handlers read live state
    const self = this;
    const ctx = {
      get inputElement() { return self.inputElement; },
      get sendButton() { return self.sendButton; },
      get chatContainer() { return self.chatContainer; },
      get intakeModal() { return self.intakeModal; },
      get intakeModalBackdrop() { return self.intakeModalBackdrop; },
      get terminalContainer() { return self.terminalContainer; },
      get isProcessing() { return self.isProcessing; },
      set isProcessing(v: boolean) { self.isProcessing = v; },
      get isInSpecialPrompt() { return self.isInSpecialPrompt; },
      set isInSpecialPrompt(v: boolean) { self.isInSpecialPrompt = v; },
      get selectedOptions() { return self.selectedOptions; },
      set selectedOptions(v: string[]) { self.selectedOptions = v; },
      get inputHistory() { return self.inputHistory; },
      set inputHistory(v: string[]) { self.inputHistory = v; },
      get historyIndex() { return self.historyIndex; },
      set historyIndex(v: number) { self.historyIndex = v; },
      get currentQuestionIndex() { return self.currentQuestionIndex; },
      set currentQuestionIndex(v: number) { self.currentQuestionIndex = v; },
      getCurrentQuestion: () => self.getCurrentQuestion(),
      handleUserInput: () => self.handleUserInput(),
      handleOptionClick: (t: HTMLElement) => self.handleOptionClick(t),
      goBackToQuestion: (i: number) => self.goBackToQuestion(i),
      processAnswer: (v: string | string[], d: string) => self.processAnswer(v, d)
    };

    bindCoreInputEvents(ctx);
    bindCommandHistory(ctx);
    bindGlobalKeyboardShortcuts(ctx);
    bindChatOptionClicks(ctx);
    bindModalControls(ctx);
  }

  // -- Conversation flow ------------------------------------------------------

  private async startConversation(): Promise<void> {
    if (this.terminalCursor) {
      this.terminalCursor.style.display = 'none';
    }
    await delay(100);

    if (this.chatContainer) {
      await runBootSequence(this.chatContainer);
    }
    await delay(150);

    if (this.clientData) {
      await this.handleExistingClientData();
    } else {
      await this.askCurrentQuestion();
    }
  }

  private async askToResume(savedProgress: SavedProgress): Promise<void> {
    if (this.resumePromptShown) return;
    this.resumePromptShown = true;

    if (this.chatContainer) {
      await runResumeBootSequence(this.chatContainer);
    }

    this.isInSpecialPrompt = true;
    let handled = false;
    let handleResumeKeydown: ((e: KeyboardEvent) => void) | null = null;

    const processChoice = async (choice: 'resume' | 'restart', displayText: string) => {
      if (handled) return;
      handled = true;
      this.isInSpecialPrompt = false;
      if (handleResumeKeydown) document.removeEventListener('keydown', handleResumeKeydown);

      this.addMessage({ type: 'user', content: displayText });
      if (this.inputElement) this.inputElement.value = '';

      if (choice === 'resume') {
        this.currentQuestionIndex = savedProgress.currentQuestionIndex;
        this.intakeData = savedProgress.intakeData;
        this.updateProgress();
        await delay(300);
        if (this.chatContainer) addBootMessageToChat(this.chatContainer, '  \u2713 Progress restored');
        await delay(200);
        await this.showPreviousConversation(savedProgress.currentQuestionIndex);
        await delay(300);
        await this.askCurrentQuestion();
      } else {
        this.resetState();
        await this.startConversation();
      }
    };

    const { messageEl, contentText, btn1, btn2 } = createResumePromptUI(
      savedProgress.intakeData.name as string | undefined
    );

    const optionsEl = messageEl.querySelector('.chat-options');
    optionsEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btnNum = target.dataset.resumeBtn;
      if (!btnNum) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      btn1.disabled = true;
      btn2.disabled = true;
      if (btnNum === '1') processChoice('resume', '[1] Resume where I left off');
      else if (btnNum === '2') processChoice('restart', '[2] Start over');
    });

    if (this.chatContainer) {
      this.chatContainer.appendChild(messageEl);
      scrollToBottom(this.chatContainer);
    }
    this.messages.push({ type: 'ai', content: contentText });

    handleResumeKeydown = (e: KeyboardEvent) => {
      if (handled) return;
      if (e.key === '1') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        processChoice('resume', '[1] Resume where I left off');
      } else if (e.key === '2') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
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

  private async handleExistingClientData(): Promise<void> {
    if (this.clientData?.name) this.intakeData.name = this.clientData.name;
    if (this.clientData?.email) this.intakeData.email = this.clientData.email;
    if (this.clientData?.company) this.intakeData.companyName = this.clientData.company;

    const firstName = this.clientData?.name?.split(' ')[0] || 'there';
    const greetingMessage = `Hello, ${firstName}! I'm Arrow - Noelle's personal assistant. Since you're already a client, let's get your new project started. I just have a few quick questions.`;

    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 300);
      await addMessageWithTyping(this.chatContainer, { type: 'ai', content: greetingMessage }, -1, () => {}, () => {}, () => {});
      this.messages.push({ type: 'ai', content: greetingMessage });
    }
    await delay(300);

    if (this.clientData?.lastBilling) {
      await this.askAboutPreviousBilling();
    } else {
      await this.skipToRelevantQuestion();
    }
  }

  private async askAboutPreviousBilling(): Promise<void> {
    const billing = this.clientData?.lastBilling;
    if (!billing) { await this.skipToRelevantQuestion(); return; }

    const billingDescription = billing.description || (billing.amount ? `${billing.type} - ${billing.amount}` : billing.type);

    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 300);
      const message: ChatMessage = {
        type: 'ai',
        content: `Your last project was billed as: ${billingDescription}. Would you like to use the same billing arrangement for this project?`,
        options: [
          { value: 'same', label: 'Yes, same billing arrangement' },
          { value: 'different', label: 'No, I\'d like to discuss different options' }
        ]
      };
      await addMessageWithTyping(this.chatContainer, message, -1, () => {}, (target) => this.handleBillingChoice(target), () => {});
      this.messages.push(message);
    }
  }

  private async handleBillingChoice(target: HTMLElement): Promise<void> {
    const choice = target.dataset.value;
    this.addMessage({ type: 'user', content: target.textContent || '' });

    if (choice === 'same' && this.clientData?.lastBilling) {
      this.intakeData.billingPreference = 'same-as-last';
      this.intakeData.previousBillingType = this.clientData.lastBilling.type;
      if (this.clientData.lastBilling.amount) this.intakeData.previousBillingAmount = this.clientData.lastBilling.amount;

      if (this.chatContainer) {
        await showTypingIndicator(this.chatContainer, 200);
        this.addMessage({ type: 'ai', content: 'Great! We\'ll use the same billing arrangement.' });
      }
    } else {
      this.intakeData.billingPreference = 'discuss-new';
    }
    await delay(300);
    await this.skipToRelevantQuestion();
  }

  private async skipToRelevantQuestion(): Promise<void> {
    this.currentQuestionIndex = findFirstRelevantQuestionIndex(this.intakeData);
    await this.askCurrentQuestion();
  }

  private async showPreviousConversation(upToIndex: number): Promise<void> {
    if (!this.chatContainer) return;
    renderPreviousConversation(this.chatContainer, this.intakeData, upToIndex, (msg) => this.addMessage(msg));
    await delay(100);
  }

  // -- Question resolution ----------------------------------------------------

  private getCurrentQuestion() {
    const [question, resolvedIndex] = resolveCurrentQuestion(this.currentQuestionIndex, this.intakeData);
    this.currentQuestionIndex = resolvedIndex;
    return question;
  }

  private async askCurrentQuestion(skipTyping: boolean = false): Promise<void> {
    const question = this.getCurrentQuestion();
    if (!question) { await this.showReviewAndConfirm(); return; }

    applyDynamicOptions(question, this.intakeData);
    const questionText = interpolateQuestionText(question.question, this.intakeData);

    if (!skipTyping && this.chatContainer) await showTypingIndicator(this.chatContainer, 350);

    const message: ChatMessage = { type: 'ai', content: questionText, questionIndex: this.currentQuestionIndex };
    if (question.type === 'select' && question.options) message.options = question.options;
    else if (question.type === 'multiselect' && question.options) { message.options = question.options; message.multiSelect = true; }

    if (skipTyping) {
      this.addMessage(message);
    } else if (this.chatContainer) {
      await addMessageWithTyping(this.chatContainer, message, this.currentQuestionIndex, (i) => this.goBackToQuestion(i), (t) => this.handleOptionClick(t), () => this.handleUserInput());
      this.messages.push(message);
    }

    if (this.inputElement) { this.inputElement.placeholder = question.placeholder || 'Click or type your response...'; this.inputElement.disabled = false; this.inputElement.focus(); }
    if (this.sendButton) this.sendButton.disabled = false;
    this.selectedOptions = [];
    this.updateProgress();
  }

  // -- Input handling ---------------------------------------------------------

  private handleOptionClick(target: HTMLElement): void {
    if (this.isProcessing || this.isInSpecialPrompt) return;
    const value = target.dataset.value;
    if (!value) return;

    const parentMessage = target.closest('[data-question-index]');
    if (parentMessage) {
      const idx = parseInt(parentMessage.getAttribute('data-question-index') || '-1', 10);
      if (idx !== -1 && idx !== this.currentQuestionIndex) { this.goBackToQuestion(idx); return; }
    }

    const question = this.getCurrentQuestion();
    if (!question) return;

    if (question.type === 'multiselect') {
      target.classList.toggle('selected');
      if (target.classList.contains('selected')) this.selectedOptions.push(value);
      else this.selectedOptions = this.selectedOptions.filter((v) => v !== value);
    } else {
      this.processAnswer(value, target.textContent || value);
    }
  }

  private async handleUserInput(): Promise<void> {
    if (this.isProcessing || this.isInSpecialPrompt) return;
    const inputValue = this.inputElement?.value.trim() || '';

    if (isCommand(inputValue)) { await this.handleCommand(inputValue); return; }

    const question = this.getCurrentQuestion();
    if (!question) return;

    const parsed = parseUserInput(inputValue, question, this.selectedOptions);
    if (!parsed) {
      if (question.type === 'select' && inputValue && question.options) {
        this.addMessage({ type: 'error', content: getInvalidSelectMessage(question.options.length) });
      }
      return;
    }
    await this.processAnswer(parsed.value, parsed.displayValue);
  }

  private async handleCommand(input: string): Promise<void> {
    const { command } = parseCommand(input);
    this.addMessage({ type: 'user', content: input });
    this.inputHistory.push(input);
    this.historyIndex = this.inputHistory.length;
    if (this.inputElement) this.inputElement.value = '';

    if (!commandExists(command)) {
      this.addMessage({ type: 'error', content: `Command not found: /${command}. Type /help for available commands.` });
      return;
    }

    const result = resolveCommand(command, this.currentQuestionIndex, getBaseQuestionCount(), Object.keys(this.intakeData));

    if (result.message) {
      this.addMessage(result.message);
      return;
    }

    if (result.signal === COMMAND_SIGNALS.CLEAR && this.chatContainer) {
      const loginInfo = this.chatContainer.querySelector('.terminal-login-info');
      this.chatContainer.innerHTML = '';
      if (loginInfo) this.chatContainer.appendChild(loginInfo.cloneNode(true));
    } else if (result.signal === COMMAND_SIGNALS.RESTART) {
      this.resetState();
      this.inputHistory = [];
      this.historyIndex = -1;
      await this.startConversation();
    } else if (result.signal === COMMAND_SIGNALS.BACK) {
      await this.goBackToQuestion(this.currentQuestionIndex - 1);
    }
  }

  // -- Answer processing ------------------------------------------------------

  private async processAnswer(value: string | string[], displayValue: string): Promise<void> {
    this.isProcessing = true;

    if (this.editingQuestionIndex !== null) {
      const editIndex = this.editingQuestionIndex;
      const question = QUESTIONS[editIndex];
      if (question.validation && typeof value === 'string') {
        const error = question.validation(value);
        if (error) { this.addMessage({ type: 'error', content: error }); this.isProcessing = false; return; }
      }
      await this.updateAnswerInPlace(editIndex, value, displayValue);
      this.isProcessing = false;
      return;
    }

    const question = this.getCurrentQuestion();
    if (!question) { this.isProcessing = false; return; }

    if (question.validation && typeof value === 'string') {
      const error = question.validation(value);
      if (error) { this.addMessage({ type: 'error', content: error }); this.isProcessing = false; return; }
    }

    this.addMessage({ type: 'user', content: displayValue, questionIndex: this.currentQuestionIndex });
    if (this.chatContainer) markSelectedOptions(this.chatContainer, this.currentQuestionIndex, value);

    this.inputHistory.push(displayValue);
    this.historyIndex = this.inputHistory.length;

    if (question.field) this.intakeData[question.field] = value;
    else if (question.id === 'greeting') this.intakeData.name = value as string;

    if (this.inputElement) { this.inputElement.value = ''; this.inputElement.disabled = true; }

    this.currentQuestionIndex++;
    saveIntakeProgress(this.currentQuestionIndex, this.intakeData);
    this.selectedOptions = [];

    await delay(300);
    await this.askCurrentQuestion();
    this.isProcessing = false;
  }

  private async showReviewAndConfirm(): Promise<void> {
    if (this.chatContainer) {
      await showTypingIndicator(this.chatContainer, 400);
      await addMessageWithTyping(this.chatContainer, { type: 'ai', content: 'Great! Here\'s a summary of your project request. Please review:' }, this.currentQuestionIndex, (i) => this.goBackToQuestion(i), (t) => this.handleOptionClick(t), () => this.handleUserInput());
    }
    await delay(300);
    if (this.chatContainer) await addSystemMessageHtml(this.chatContainer, generateReviewSummary(this.intakeData));
    await delay(300);
    if (this.chatContainer) await addSystemMessageWithTyping(this.chatContainer, 'To make changes, scroll back up to the questions and click on the answer you would like to change.');
    await delay(200);
    if (this.chatContainer) {
      await addMessageWithTyping(this.chatContainer, {
        type: 'ai', content: 'Does everything look correct?',
        options: [{ value: 'yes', label: 'Yes, continue to package selection' }, { value: 'no', label: 'No, I need to make changes' }]
      }, this.currentQuestionIndex, (i) => this.goBackToQuestion(i), (t) => this.handleOptionClick(t), () => this.handleUserInput());
    }

    await waitForTwoOptionChoice({
      chatContainer: this.chatContainer,
      inputElement: this.inputElement,
      onOption1: async () => {
        this.addMessage({ type: 'user', content: '[1] Yes, continue to proposal' });
        await this.showProposalBuilder();
      },
      onOption2: async () => {
        this.addMessage({ type: 'user', content: '[2] No, I need to make changes' });
        this.addMessage({
          type: 'ai',
          content: 'No problem! Scroll back up to the questions and click on the answer you would like to change. When you\'re done, select an option below.',
          options: [{ value: 'review', label: 'Done - show summary again' }, { value: 'restart', label: 'Start over completely' }]
        });
        await this.waitForChangeDecision();
      }
    }, (v) => { this.isInSpecialPrompt = v; });
  }

  private async waitForChangeDecision(): Promise<void> {
    await waitForTwoOptionChoice({
      chatContainer: this.chatContainer,
      inputElement: this.inputElement,
      onOption1: async () => {
        this.addMessage({ type: 'user', content: '[1] Done - show summary again' });
        await this.showReviewAndConfirm();
      },
      onOption2: async () => {
        this.addMessage({ type: 'user', content: '[2] Start over completely' });
        this.resetState();
        await this.startConversation();
      }
    }, (v) => { this.isInSpecialPrompt = v; });
  }

  private async showProposalBuilder(): Promise<void> {
    this.isProcessing = true;
    if (this.inputElement) this.inputElement.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;

    if (this.chatContainer) await showTypingIndicator(this.chatContainer, 400);
    this.addMessage({ type: 'ai', content: 'Now let\'s customize your project package. I\'ll show you our tier options so you can select the features that best fit your needs.' });
    await delay(500);

    this.proposalBuilderContainer = document.createElement('div');
    this.proposalBuilderContainer.className = 'terminal-proposal-builder';

    const terminalWindow = this.terminalContainer.querySelector('.terminal-window');
    if (terminalWindow?.parentNode) {
      terminalWindow.parentNode.insertBefore(this.proposalBuilderContainer, terminalWindow.nextSibling);
    } else {
      this.terminalContainer.appendChild(this.proposalBuilderContainer);
    }

    const inputArea = this.terminalContainer.querySelector('.terminal-input-area') as HTMLElement;
    if (inputArea) inputArea.style.display = 'none';

    const proposalBuilder = new ProposalBuilderModule(this.proposalBuilderContainer, this.intakeData, {
      onComplete: async (selection) => { this.proposalSelection = selection; this.cleanupProposalBuilder(); await this.submitIntake(); },
      onCancel: () => {
        this.proposalSelection = null;
        this.cleanupProposalBuilder();
        this.addMessage({ type: 'ai', content: 'No problem! Let me know when you\'re ready to continue.', options: [{ value: 'continue', label: 'Continue to proposal builder' }, { value: 'changes', label: 'I need to make changes first' }] });
        this.waitForProposalDecision();
      }
    });
    await proposalBuilder.init();
  }

  private async waitForProposalDecision(): Promise<void> {
    this.isProcessing = false;
    await waitForTwoOptionChoice({
      chatContainer: this.chatContainer,
      inputElement: this.inputElement,
      onOption1: async () => {
        this.addMessage({ type: 'user', content: 'Continue to proposal builder' });
        await this.showProposalBuilder();
      },
      onOption2: async () => {
        this.addMessage({ type: 'user', content: 'I need to make changes first' });
        this.addMessage({ type: 'ai', content: 'Scroll back up to make changes, then select an option below when ready.', options: [{ value: 'review', label: 'Done - show summary again' }, { value: 'restart', label: 'Start over completely' }] });
        await this.waitForChangeDecision();
      }
    }, (v) => { this.isInSpecialPrompt = v; });
  }

  private cleanupProposalBuilder(): void {
    if (this.proposalBuilderContainer) { this.proposalBuilderContainer.remove(); this.proposalBuilderContainer = null; }
    const inputArea = this.terminalContainer.querySelector('.terminal-input-area') as HTMLElement;
    if (inputArea) inputArea.style.display = '';
  }

  private async submitIntake(): Promise<void> {
    this.isProcessing = true;
    if (this.inputElement) this.inputElement.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;

    if (this.chatContainer) await showTypingIndicator(this.chatContainer, 500);
    this.addMessage({ type: 'ai', content: 'Processing your project request...' });
    if (this.chatContainer) await showTypingIndicator(this.chatContainer, 700);

    const result = await submitIntakeData(this.intakeData, this.proposalSelection);

    if (result.success) {
      clearIntakeProgress();
      this.addMessage({ type: 'success', content: buildSuccessMessage(result.tierName!) });
      localStorage.removeItem('terminalIntakeData');
      this.updateProgress(100);
    } else {
      this.error('Submission error');
      this.addMessage({ type: 'error', content: result.errorMessage! });
      if (this.inputElement) this.inputElement.disabled = false;
      if (this.sendButton) this.sendButton.disabled = false;
    }
    this.isProcessing = false;
  }

  // -- Editing / go-back ------------------------------------------------------

  private async goBackToQuestion(questionIndex: number): Promise<void> {
    if (this.isProcessing) return;
    if (questionIndex >= QUESTIONS.length || questionIndex < 0) return;
    this.isProcessing = true;

    const question = QUESTIONS[questionIndex];
    let oldAnswer: string | string[] | undefined;
    if (question.id === 'greeting') oldAnswer = this.intakeData.name as string;
    else if (question.field) oldAnswer = this.intakeData[question.field];

    this.editingQuestionIndex = questionIndex;
    this.editingOldAnswer = oldAnswer;
    this.lastAnsweredQuestionIndex = this.currentQuestionIndex;
    this.currentQuestionIndex = questionIndex;
    this.selectedOptions = [];

    if (oldAnswer) {
      if (question.type === 'multiselect' && Array.isArray(oldAnswer)) {
        this.selectedOptions = [...oldAnswer];
        oldAnswer.forEach((value) => {
          const optionBtn = this.chatContainer?.querySelector(`.chat-message[data-question-index="${questionIndex}"] .chat-option[data-value="${value}"]`) as HTMLElement;
          if (optionBtn) optionBtn.classList.add('selected');
        });
      } else if (question.type === 'select' && typeof oldAnswer === 'string') {
        const optionBtn = this.chatContainer?.querySelector(`.chat-message[data-question-index="${questionIndex}"] .chat-option[data-value="${oldAnswer}"]`) as HTMLElement;
        if (optionBtn) optionBtn.classList.add('selected');
      } else if (typeof oldAnswer === 'string') {
        const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
        if (textTypes.includes(question.type) && this.inputElement) {
          this.inputElement.value = oldAnswer;
          this.inputElement.focus();
          this.inputElement.setSelectionRange(oldAnswer.length, oldAnswer.length);
        }
      }
    }

    if (this.chatContainer) scrollToQuestion(this.chatContainer, questionIndex);
    if (this.inputElement) { this.inputElement.placeholder = question.placeholder || 'Click or type your response...'; this.inputElement.disabled = false; this.inputElement.focus(); }
    this.isProcessing = false;
  }

  private async updateAnswerInPlace(questionIndex: number, newValue: string | string[], displayValue: string): Promise<void> {
    const question = QUESTIONS[questionIndex];
    const oldAnswer = this.editingOldAnswer;
    const changedField = question.field || (question.id === 'greeting' ? 'name' : '');
    const answerChanged = JSON.stringify(newValue) !== JSON.stringify(oldAnswer);

    if (this.chatContainer) updateAnswerDisplay(this.chatContainer, questionIndex, newValue, displayValue);

    if (question.field) this.intakeData[question.field] = newValue;
    else if (question.id === 'greeting') this.intakeData.name = newValue as string;

    const lastAnswered = this.lastAnsweredQuestionIndex;
    this.editingQuestionIndex = null;
    this.editingOldAnswer = undefined;

    if (answerChanged && changedField) {
      const firstDependentIndex = findFirstDependentQuestionIndex(changedField, questionIndex);
      if (firstDependentIndex !== -1) {
        if (this.chatContainer) removeElementsFromIndex(this.chatContainer, firstDependentIndex);
        for (let i = firstDependentIndex; i < QUESTIONS.length; i++) {
          const q = QUESTIONS[i];
          if (q.field && this.intakeData[q.field]) delete this.intakeData[q.field];
        }
        this.messages = this.messages.filter((msg) => msg.questionIndex === undefined || msg.questionIndex < firstDependentIndex);
        this.currentQuestionIndex = firstDependentIndex;
        saveIntakeProgress(this.currentQuestionIndex, this.intakeData);
        this.updateProgress();
        await delay(300);
        await this.askCurrentQuestion();
        return;
      }
    }

    this.currentQuestionIndex = lastAnswered;
    saveIntakeProgress(this.currentQuestionIndex, this.intakeData);
    this.updateProgress();
    if (this.chatContainer) scrollToBottom(this.chatContainer);
    if (this.inputElement) {
      const currentQ = this.getCurrentQuestion();
      if (currentQ) this.inputElement.placeholder = currentQ.placeholder || 'Click or type your response...';
      this.inputElement.disabled = false;
    }
  }

  private addMessage(message: ChatMessage): void {
    if (!this.chatContainer) return;
    this.messages.push(message);
    const messageEl = createMessageElement(message, this.currentQuestionIndex, (i) => this.goBackToQuestion(i), (t) => this.handleOptionClick(t), () => this.handleUserInput());
    this.chatContainer.appendChild(messageEl);
    scrollToBottom(this.chatContainer);
  }

  private updateProgress(override?: number): void {
    const totalBaseQuestions = getBaseQuestionCount();
    const answeredCount = Object.keys(this.intakeData).length;
    const progress = override ?? Math.min(Math.round((answeredCount / totalBaseQuestions) * 100), 95);
    updateProgressBar(this.progressFill, this.progressPercent, progress);
  }

  /** Reset state for a fresh start */
  private resetState(): void {
    clearIntakeProgress();
    this.currentQuestionIndex = 0;
    this.intakeData = {};
    this.messages = [];
    if (this.chatContainer) this.chatContainer.innerHTML = '';
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const intakeContainer = document.querySelector('.terminal-intake-container') as HTMLElement;
  if (intakeContainer) {
    const module = new TerminalIntakeModule(intakeContainer);
    module.init().catch((error) => { logger.error('Failed to initialize:', error); });
  }
});
