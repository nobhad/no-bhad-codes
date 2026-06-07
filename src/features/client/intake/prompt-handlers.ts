/**
 * ===============================================
 * INTAKE - PROMPT HANDLERS
 * ===============================================
 * @file src/features/client/intake/prompt-handlers.ts
 *
 * Reusable prompt pattern for two-option confirmation dialogs.
 * Handles click and keyboard (1/2) input with cleanup.
 */

/**
 * Configuration for a two-option prompt
 */
export interface TwoOptionPromptConfig {
  chatContainer: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  onOption1: () => Promise<void>;
  onOption2: () => Promise<void>;
  placeholder?: string;
}

/**
 * Wait for the user to pick option 1 or 2 via click or keyboard.
 * Sets and clears the isInSpecialPrompt flag via callbacks.
 * Returns a Promise that resolves when a choice is made.
 */
export function waitForTwoOptionChoice(
  config: TwoOptionPromptConfig,
  setSpecialPrompt: (value: boolean) => void
): Promise<void> {
  setSpecialPrompt(true);

  return new Promise((resolve) => {
    let handleClick: ((e: Event) => Promise<void>) | null = null;
    let handleKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

    const cleanup = () => {
      setSpecialPrompt(false);
      if (handleClick) {
        config.chatContainer?.removeEventListener('click', handleClick, true);
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
        await config.onOption1();
        resolve();
      } else if (e.key === '2') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cleanup();
        await config.onOption2();
        resolve();
      }
    };

    handleClick = async (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        e.stopPropagation();
        const choice = target.dataset.value;

        cleanup();

        // Map the first option value to onOption1, second to onOption2
        // The options container lists them in order, so check the value
        const optionsContainer = target.closest('.chat-options');
        if (optionsContainer) {
          const buttons = optionsContainer.querySelectorAll('.chat-option');
          const isFirstOption = buttons[0] === target;

          if (isFirstOption || choice === 'yes' || choice === 'review' || choice === 'continue' || choice === 'resume') {
            await config.onOption1();
          } else {
            await config.onOption2();
          }
        } else {
          // Fallback: if we can't determine position, use the value
          if (choice === 'yes' || choice === 'review' || choice === 'continue' || choice === 'resume') {
            await config.onOption1();
          } else {
            await config.onOption2();
          }
        }
        resolve();
      }
    };

    config.chatContainer?.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown);

    if (config.inputElement) {
      config.inputElement.disabled = false;
      config.inputElement.placeholder = config.placeholder || 'Click or type 1 or 2...';
      config.inputElement.focus();
    }
  });
}

/**
 * Create the resume prompt DOM elements
 */
export interface ResumePromptElements {
  messageEl: HTMLElement;
  contentText: string;
  btn1: HTMLButtonElement;
  btn2: HTMLButtonElement;
}

export function createResumePromptUI(
  name: string | undefined
): ResumePromptElements {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message ai';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  const contentText = `Welcome back${name ? `, ${name}` : ''}! I found your previous progress. Would you like to continue where you left off or start fresh?`;
  contentEl.textContent = contentText;
  messageEl.appendChild(contentEl);

  const optionsEl = document.createElement('div');
  optionsEl.className = 'chat-options';

  const btn1 = document.createElement('button') as HTMLButtonElement;
  btn1.className = 'chat-option';
  btn1.dataset.value = 'resume';
  btn1.dataset.resumeBtn = '1';
  btn1.textContent = '[1] Resume where I left off';
  optionsEl.appendChild(btn1);

  const btn2 = document.createElement('button') as HTMLButtonElement;
  btn2.className = 'chat-option';
  btn2.dataset.value = 'restart';
  btn2.dataset.resumeBtn = '2';
  btn2.textContent = '[2] Start over';
  optionsEl.appendChild(btn2);

  messageEl.appendChild(optionsEl);

  return { messageEl, contentText, btn1, btn2 };
}
