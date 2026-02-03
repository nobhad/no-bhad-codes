/**
 * ===============================================
 * TERMINAL INTAKE - UI UTILITIES
 * ===============================================
 * @file src/features/client/terminal-intake-ui.ts
 *
 * UI rendering, message display, and typing animations for the terminal intake module.
 */

import { gsap } from 'gsap';
import { BRANDING } from '../../config/branding';
import type { ChatMessage } from './terminal-intake-types';

/**
 * Generate the terminal window HTML
 */
export function renderTerminalHTML(isModal: boolean): string {
  const buttonsHtml = isModal
    ? `<div class="terminal-buttons">
            <button class="terminal-btn close" id="terminalClose" aria-label="Close terminal"></button>
            <button class="terminal-btn minimize" id="terminalMinimize" aria-label="Minimize"></button>
            <button class="terminal-btn maximize" id="terminalMaximize" aria-label="Maximize"></button>
          </div>`
    : `<div class="terminal-buttons">
            <span class="terminal-btn close" style="cursor: default;"></span>
            <span class="terminal-btn minimize" style="cursor: default;"></span>
            <span class="terminal-btn maximize" style="cursor: default;"></span>
          </div>`;

  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const date = now.getDate();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const loginTime = `Last login: ${dayName} ${monthName} ${date} ${hours}:${minutes}:${seconds} on ttys001`;

  return `
    <div class="terminal-intake">
      <div class="terminal-window">
        <div class="terminal-header">
          ${buttonsHtml}
          <span class="terminal-title">project_intake.sh - No Bhad Codes</span>
        </div>
        <div class="terminal-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Form completion progress">
          <span class="progress-label">Progress:</span>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
          </div>
          <span class="progress-percent" id="progressPercent" aria-live="polite">0%</span>
        </div>
        <div class="terminal-chat" id="terminalChat" role="log" aria-live="polite" aria-label="Chat conversation">
          <div class="terminal-login-info" aria-hidden="true">${loginTime}<br><span class="terminal-prompt-line">${BRANDING.TERMINAL.PROMPT} project-intake % </span><span class="terminal-typing-text" id="terminalTypingText">./project_intake.sh</span><span class="terminal-cursor" id="terminalCursor">█</span></div>
        </div>
        <div class="terminal-input-area" role="form" aria-label="Project intake form">
          <span class="terminal-prompt" aria-hidden="true">></span>
          <input type="text" class="terminal-input" id="terminalInput" placeholder="Click or type your response..." autocomplete="off" aria-label="Your response" data-1p-ignore data-lpignore="true" data-bwignore>
          <button class="terminal-send" id="terminalSend" aria-label="Send response">SEND</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Show the avatar introduction animation
 * Draws the SVG path-by-path for a "line by line" effect
 */
export async function showAvatarIntro(chatContainer: HTMLElement): Promise<void> {
  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'terminal-avatar-intro';

  // Create wrapper for the inline SVG
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-avatar-wrapper';
  avatarContainer.appendChild(wrapper);

  avatarContainer.style.opacity = '0';
  chatContainer.appendChild(avatarContainer);
  scrollToBottom(chatContainer);

  // Fetch and inline the SVG for path animation
  try {
    const response = await fetch('/images/avatar_terminal.svg');
    const svgText = await response.text();

    // Parse the SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');

    if (svgElement) {
      // Add class for styling
      svgElement.classList.add('terminal-avatar-img');

      // Fix relative image paths to absolute paths
      // SVG references images like "avatar_terminal-1.png" which need full path when inlined
      const images = svgElement.querySelectorAll('image');
      images.forEach((img) => {
        const href = img.getAttribute('xlink:href') || img.getAttribute('href');
        if (href && !href.startsWith('/') && !href.startsWith('data:') && !href.startsWith('http')) {
          img.setAttribute('xlink:href', `/images/${href}`);
          img.setAttribute('href', `/images/${href}`);
        }
      });

      // Insert the SVG into the wrapper
      wrapper.appendChild(svgElement);

      // SVG has named elements: #Head, #Ear, #Nose, #Eye
      // CSS targets these IDs for styling

      // Fade in the container with the full SVG
      gsap.to(avatarContainer, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out'
      });

      await delay(500);
    }
  } catch {
    // Fallback to img tag if fetch fails
    wrapper.innerHTML = '<img src="/images/avatar_terminal.svg" alt="No Bhad Codes" class="terminal-avatar-img" />';
    gsap.to(avatarContainer, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out'
    });
    await delay(500);
  }
}

/**
 * Add a boot message line to the terminal
 */
export function addBootMessage(chatContainer: HTMLElement, text: string): void {
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.textContent = text;
  chatContainer.appendChild(line);
  scrollToBottom(chatContainer);
}

/** Store for active bootstrap animation timeline */
let bootstrapTimeline: gsap.core.Timeline | null = null;

/**
 * Add bootstrapping message with animated dots using GSAP
 * Returns the element so dots can be stopped later
 */
export function addBootstrapMessage(chatContainer: HTMLElement): HTMLElement {
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.innerHTML = 'Bootstrapping<span class="pulsing-dots"><span>.</span><span>.</span><span>.</span></span>';
  chatContainer.appendChild(line);
  scrollToBottom(chatContainer);

  // Get dot spans and set initial state
  const dots = line.querySelectorAll('.pulsing-dots span');
  gsap.set(dots, { opacity: 0 });

  // Create repeating timeline: . -> .. -> ... -> (pause) -> reset
  // 800ms cycle for natural pacing
  bootstrapTimeline = gsap.timeline({ repeat: -1, repeatDelay: 0.2 });
  bootstrapTimeline
    .to(dots[0], { opacity: 1, duration: 0.01 }, 0)
    .to(dots[1], { opacity: 1, duration: 0.01 }, 0.2)
    .to(dots[2], { opacity: 1, duration: 0.01 }, 0.4)
    .to(dots, { opacity: 0, duration: 0.01 }, 0.6);

  return line;
}

/**
 * Stop pulsing dots on bootstrapping message
 */
export function stopBootstrapPulsing(element: HTMLElement): void {
  if (bootstrapTimeline) {
    bootstrapTimeline.kill();
    bootstrapTimeline = null;
  }
  element.textContent = 'Bootstrapping...';
}

/**
 * Show typing indicator
 */
export async function showTypingIndicator(
  chatContainer: HTMLElement,
  duration: number
): Promise<void> {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span>.</span><span>.</span><span>.</span>';
  chatContainer.appendChild(indicator);
  scrollToBottom(chatContainer);

  await delay(duration);

  indicator.remove();
}

/**
 * Create a message element with options
 */
export function createMessageElement(
  message: ChatMessage,
  currentQuestionIndex: number,
  onGoBack: (index: number) => void,
  onOptionClick: (target: HTMLElement) => void,
  onConfirmClick: () => void
): HTMLElement {
  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${message.type}`;

  // Make AI questions and user answers clickable to go back
  if (message.questionIndex !== undefined && (message.type === 'ai' || message.type === 'user')) {
    messageEl.classList.add('clickable-message');
    messageEl.dataset.questionIndex = String(message.questionIndex);
    messageEl.title = 'Click to edit this answer';
    messageEl.addEventListener('click', (e) => {
      if (message.questionIndex === currentQuestionIndex) {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains('chat-option') ||
          target.classList.contains('confirm-btn') ||
          target.closest('.chat-option') ||
          target.closest('.confirm-btn')
        ) {
          return;
        }
      }
      e.stopPropagation();
      onGoBack(message.questionIndex!);
    });
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.textContent = message.content;
  messageEl.appendChild(contentEl);

  // Add options if present
  if (message.options && message.options.length > 0) {
    const optionsEl = document.createElement('div');
    optionsEl.className = `chat-options${message.multiSelect ? ' multi-select' : ''}`;

    message.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'chat-option';
      btn.dataset.value = option.value;
      btn.dataset.index = String(index + 1);
      btn.textContent = `[${index + 1}] ${option.label}`;
      btn.setAttribute('aria-label', `Option ${index + 1}: ${option.label}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOptionClick(btn);
      });
      optionsEl.appendChild(btn);
    });

    messageEl.appendChild(optionsEl);

    // Add confirm button for multiselect
    if (message.multiSelect) {
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'terminal-send confirm-btn';
      confirmBtn.style.marginTop = '12px';
      confirmBtn.style.marginLeft = '20px';
      confirmBtn.textContent = '> CONFIRM SELECTION';
      confirmBtn.setAttribute('aria-label', 'Confirm your selections');
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onConfirmClick();
      });
      messageEl.appendChild(confirmBtn);
    }
  }

  return messageEl;
}

/**
 * Add a message with typing animation
 */
export async function addMessageWithTyping(
  chatContainer: HTMLElement,
  message: ChatMessage,
  currentQuestionIndex: number,
  onGoBack: (index: number) => void,
  onOptionClick: (target: HTMLElement) => void,
  onConfirmClick: () => void
): Promise<void> {
  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${message.type}`;

  if (message.questionIndex !== undefined && (message.type === 'ai' || message.type === 'user')) {
    messageEl.classList.add('clickable-message');
    messageEl.dataset.questionIndex = String(message.questionIndex);
    messageEl.title = 'Click to edit this answer';
    messageEl.addEventListener('click', (e) => {
      if (message.questionIndex === currentQuestionIndex) {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains('chat-option') ||
          target.classList.contains('confirm-btn') ||
          target.closest('.chat-option') ||
          target.closest('.confirm-btn')
        ) {
          return;
        }
      }
      e.stopPropagation();
      onGoBack(message.questionIndex!);
    });
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  messageEl.appendChild(contentEl);

  const textSpan = document.createElement('span');
  textSpan.className = 'typing-text';
  contentEl.appendChild(textSpan);

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  cursor.textContent = '█';
  // Color now set via CSS class .typing-cursor
  contentEl.appendChild(cursor);

  const cursorBlink = gsap.to(cursor, {
    opacity: 0,
    duration: 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'steps(1)'
  });

  chatContainer.appendChild(messageEl);
  scrollToBottom(chatContainer);

  // Type out the content - faster typing for snappier feel
  const text = message.content;
  for (let i = 0; i < text.length; i++) {
    textSpan.textContent += text[i];
    scrollToBottom(chatContainer);
    await delay(8 + Math.random() * 4);
  }

  await delay(400);
  cursorBlink.kill();
  cursor.remove();

  // Add options after typing completes
  if (message.options && message.options.length > 0) {
    const optionsEl = document.createElement('div');
    optionsEl.className = `chat-options${message.multiSelect ? ' multi-select' : ''}`;

    message.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'chat-option';
      btn.dataset.value = option.value;
      btn.dataset.index = String(index + 1);
      btn.textContent = `[${index + 1}] ${option.label}`;
      btn.setAttribute('aria-label', `Option ${index + 1}: ${option.label}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOptionClick(btn);
      });
      optionsEl.appendChild(btn);
    });

    messageEl.appendChild(optionsEl);

    if (message.multiSelect) {
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'terminal-send confirm-btn';
      confirmBtn.style.marginTop = '12px';
      confirmBtn.style.marginLeft = '20px';
      confirmBtn.textContent = '> CONFIRM SELECTION';
      confirmBtn.setAttribute('aria-label', 'Confirm your selections');
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onConfirmClick();
      });
      messageEl.appendChild(confirmBtn);
    }
  }

  scrollToBottom(chatContainer);
}

/**
 * Add a system message with typing animation
 */
export async function addSystemMessageWithTyping(
  chatContainer: HTMLElement,
  content: string
): Promise<void> {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message system';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  messageEl.appendChild(contentEl);

  const textSpan = document.createElement('span');
  textSpan.className = 'typing-text';
  contentEl.appendChild(textSpan);

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  cursor.textContent = '█';
  // Color now set via CSS class .typing-cursor
  contentEl.appendChild(cursor);

  const cursorBlink = gsap.to(cursor, {
    opacity: 0,
    duration: 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'steps(1)'
  });

  chatContainer.appendChild(messageEl);
  scrollToBottom(chatContainer);

  // Fast typing for system messages - snappier terminal feel
  for (let i = 0; i < content.length; i++) {
    textSpan.textContent += content[i];
    if (i % 20 === 0) scrollToBottom(chatContainer);
    await delay(4 + Math.random() * 3);
  }

  await delay(300);
  cursorBlink.kill();
  cursor.remove();

  scrollToBottom(chatContainer);
}

/**
 * Add a system message with HTML content (for styled summaries)
 * Renders HTML directly without typing animation for cleaner display
 */
export async function addSystemMessageHtml(
  chatContainer: HTMLElement,
  htmlContent: string
): Promise<void> {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message system';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.innerHTML = htmlContent;
  messageEl.appendChild(contentEl);

  chatContainer.appendChild(messageEl);
  scrollToBottom(chatContainer);
}

/**
 * Setup custom block cursor for input field
 */
export function setupCustomInputCursor(inputElement: HTMLInputElement): void {
  const inputArea = inputElement.closest('.terminal-input-area');
  if (!inputArea) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-input-wrapper';

  const cursor = document.createElement('span');
  cursor.className = 'terminal-input-cursor';

  const measurer = document.createElement('span');
  measurer.className = 'terminal-input-measurer';
  measurer.setAttribute('aria-hidden', 'true');

  inputElement.parentNode?.insertBefore(wrapper, inputElement);
  wrapper.appendChild(inputElement);
  wrapper.appendChild(cursor);
  wrapper.appendChild(measurer);

  const cursorBlink = gsap.to(cursor, {
    opacity: 0,
    duration: 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'steps(1)'
  });

  const updateCursorPosition = () => {
    const text = inputElement.value || '';
    measurer.textContent = text;
    const textWidth = measurer.offsetWidth;
    cursor.style.left = `${textWidth}px`;
  };

  cursor.style.opacity = '0';
  cursorBlink.pause();

  inputElement.addEventListener('focus', () => {
    cursor.style.opacity = '1';
    cursorBlink.play();
    updateCursorPosition();
  });

  inputElement.addEventListener('blur', () => {
    cursor.style.opacity = '0';
    cursorBlink.pause();
  });

  inputElement.addEventListener('input', updateCursorPosition);
  inputElement.addEventListener('keyup', updateCursorPosition);
  inputElement.addEventListener('click', updateCursorPosition);
}

/**
 * Update progress bar
 */
export function updateProgressBar(
  progressFill: HTMLElement | null,
  progressPercent: HTMLElement | null,
  progress: number
): void {
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    const progressBar = progressFill.closest('.terminal-progress');
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(progress));
    }
  }
  if (progressPercent) {
    progressPercent.textContent = `${progress}%`;
  }
}

/**
 * Scroll chat container to bottom
 */
export function scrollToBottom(chatContainer: HTMLElement): void {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Scroll to a specific question element
 */
export function scrollToQuestion(chatContainer: HTMLElement, questionIndex: number): void {
  const questionEl = chatContainer.querySelector(
    `[data-question-index="${questionIndex}"]`
  ) as HTMLElement;

  if (questionEl) {
    questionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    scrollToBottom(chatContainer);
  }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Format a phone number as (###) ###-####
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const cleaned = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Simple delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
