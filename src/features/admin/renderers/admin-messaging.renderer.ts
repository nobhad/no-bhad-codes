/**
 * ===============================================
 * ADMIN MESSAGING RENDERER
 * ===============================================
 * @file src/features/admin/renderers/admin-messaging.renderer.ts
 *
 * Renders messaging UI in the admin dashboard.
 * Handles thread list, message display, and message composition.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { createLogger } from '../../../utils/logging';
import { type MessageThread, type Message } from '../services/admin-data.service';

const logger = createLogger('AdminMessagingRenderer');

// ============================================
// Types
// ============================================

interface ThreadSelectCallback {
  (clientId: number, threadId: number, clientName: string): void;
}

// ============================================
// Cached DOM References
// ============================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

/** Get cached element by ID */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

/** Get messages container (checks two possible IDs) */
function getMessagesContainer(): HTMLElement | null {
  return getElement('admin-messages-thread') || getElement('admin-messages-container');
}

// ============================================
// Admin Messaging Renderer
// ============================================

class AdminMessagingRenderer {
  private selectedThreadId: number | null = null;
  private selectedClientId: number | null = null;
  private onThreadSelect: ThreadSelectCallback | null = null;

  /**
   * Get currently selected thread ID
   */
  getSelectedThreadId(): number | null {
    return this.selectedThreadId;
  }

  /**
   * Get currently selected client ID
   */
  getSelectedClientId(): number | null {
    return this.selectedClientId;
  }

  /**
   * Set the callback for thread selection
   */
  setThreadSelectCallback(callback: ThreadSelectCallback): void {
    this.onThreadSelect = callback;
  }

  /**
   * Render the threads list
   */
  renderThreadsList(threads: MessageThread[]): void {
    const listContainer = getElement('admin-threads-list');
    if (!listContainer) {
      logger.warn('Threads list container not found');
      return;
    }

    if (threads.length === 0) {
      listContainer.innerHTML = `
        <div class="no-threads-message">
          No message threads yet. Threads will appear when clients send messages.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = threads
      .map((thread) => this.renderThreadItem(thread))
      .join('');

    this.attachThreadClickHandlers(listContainer, threads);
  }

  /**
   * Render a single thread list item
   */
  private renderThreadItem(thread: MessageThread): string {
    const safeClientName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(thread.client_name || 'Unknown Client'));
    const safeSubject = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(thread.subject || 'No Subject'));
    const lastMessageDate = thread.last_message_at
      ? formatDate(thread.last_message_at)
      : '';
    const unreadBadge = thread.unread_count > 0
      ? `<span class="unread-badge">${thread.unread_count}</span>`
      : '';
    const activeClass = this.selectedThreadId === thread.id ? 'active' : '';

    return `
      <div class="thread-item ${activeClass}" data-thread-id="${thread.id}" data-client-id="${thread.client_id}">
        <div class="thread-header">
          <span class="thread-client-name">${safeClientName}</span>
          ${unreadBadge}
        </div>
        <div class="thread-subject">${safeSubject}</div>
        <div class="thread-date">${lastMessageDate}</div>
      </div>
    `;
  }

  /**
   * Attach click handlers to thread items
   */
  private attachThreadClickHandlers(container: HTMLElement, threads: MessageThread[]): void {
    const threadItems = container.querySelectorAll('.thread-item');
    threadItems.forEach((item) => {
      item.addEventListener('click', () => {
        const threadId = parseInt((item as HTMLElement).dataset.threadId || '0');
        const clientId = parseInt((item as HTMLElement).dataset.clientId || '0');
        const thread = threads.find(t => t.id === threadId);
        const clientName = thread?.client_name || 'Unknown';

        this.selectThread(threadId, clientId);

        if (this.onThreadSelect) {
          this.onThreadSelect(clientId, threadId, clientName);
        }
      });
    });
  }

  /**
   * Select a thread (updates UI state)
   */
  selectThread(threadId: number, clientId: number): void {
    this.selectedThreadId = threadId;
    this.selectedClientId = clientId;

    // Update active state in thread list
    const threadItems = document.querySelectorAll('.thread-item');
    threadItems.forEach((item) => {
      item.classList.toggle('active', (item as HTMLElement).dataset.threadId === String(threadId));
    });

    // Enable compose area
    this.enableComposeArea();

    logger.debug('Thread selected', { threadId, clientId });
  }

  /**
   * Enable the message compose area
   */
  private enableComposeArea(): void {
    const textarea = getElement('admin-message-text') as HTMLTextAreaElement;
    const sendButton = getElement('admin-send-message') as HTMLButtonElement;

    if (textarea) {
      textarea.disabled = false;
      textarea.placeholder = 'Type your message...';
    }

    if (sendButton) {
      sendButton.disabled = false;
    }
  }

  /**
   * Disable the message compose area
   */
  disableComposeArea(): void {
    const textarea = getElement('admin-message-text') as HTMLTextAreaElement;
    const sendButton = getElement('admin-send-message') as HTMLButtonElement;

    if (textarea) {
      textarea.disabled = true;
      textarea.placeholder = 'Select a conversation to start messaging...';
      textarea.value = '';
    }

    if (sendButton) {
      sendButton.disabled = true;
    }
  }

  /**
   * Render messages in the thread view
   */
  renderMessages(messages: Message[]): void {
    const container = getMessagesContainer();

    if (!container) {
      logger.warn('Messages container not found');
      return;
    }

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="no-messages-message">
          No messages yet. Start the conversation!
        </div>
      `;
      return;
    }

    container.innerHTML = messages
      .map((msg) => this.renderMessage(msg))
      .join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Render a single message
   */
  private renderMessage(msg: Message): string {
    const isAdmin = msg.sender_type === 'admin';
    const dateTime = formatDateTime(msg.created_at);

    const rawSenderName = isAdmin ? 'You (Admin)' : SanitizationUtils.decodeHtmlEntities(msg.sender_name || 'Client');
    const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
    const safeContent = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(msg.message || msg.content || ''));
    const safeInitials = SanitizationUtils.escapeHtml(rawSenderName.substring(0, 2).toUpperCase());

    if (isAdmin) {
      return `
        <div class="message message-sent">
          <div class="message-content">
            <div class="message-header">
              <span class="message-sender">${safeSenderName}</span>
              <span class="message-time">${dateTime}</span>
            </div>
            <div class="message-body">${safeContent}</div>
          </div>
          <div class="message-avatar">
            <img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
          </div>
        </div>
      `;
    }

    return `
      <div class="message message-received">
        <div class="message-avatar">
          <div class="avatar-placeholder">${safeInitials}</div>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${safeSenderName}</span>
            <span class="message-time">${dateTime}</span>
          </div>
          <div class="message-body">${safeContent}</div>
        </div>
      </div>
    `;
  }

  /**
   * Show loading state in messages container
   */
  showMessagesLoading(): void {
    const container = getMessagesContainer();

    if (container) {
      container.innerHTML = `
        <div class="messages-loading">
          Loading messages...
        </div>
      `;
    }
  }

  /**
   * Show error state in messages container
   */
  showMessagesError(message: string = 'Failed to load messages'): void {
    const container = getMessagesContainer();

    if (container) {
      container.innerHTML = `
        <div class="messages-error">
          ${SanitizationUtils.escapeHtml(message)}
        </div>
      `;
    }
  }

  /**
   * Append a new message to the view (for optimistic updates)
   */
  appendMessage(message: Message): void {
    const container = getMessagesContainer();

    if (!container) return;

    const messageHtml = this.renderMessage(message);
    container.insertAdjacentHTML('beforeend', messageHtml);
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Clear the message input
   */
  clearMessageInput(): void {
    const input = getElement('admin-message-text') as HTMLTextAreaElement;
    if (input) {
      input.value = '';
    }
  }

  /**
   * Get the current message input value
   */
  getMessageInputValue(): string {
    const input = getElement('admin-message-text') as HTMLTextAreaElement;
    return input?.value.trim() || '';
  }

  /**
   * Set message input disabled state
   */
  setMessageInputDisabled(disabled: boolean): void {
    const input = getElement('admin-message-text') as HTMLTextAreaElement;
    const sendButton = getElement('admin-send-message') as HTMLButtonElement;

    if (input) {
      input.disabled = disabled;
    }
    if (sendButton) {
      sendButton.disabled = disabled;
    }
  }

  /**
   * Focus the message input
   */
  focusMessageInput(): void {
    const input = getElement('admin-message-text') as HTMLTextAreaElement;
    if (input) {
      input.focus();
    }
  }

  /**
   * Update unread count in sidebar badge
   */
  updateUnreadBadge(count: number): void {
    const badge = getElement('messages-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  /**
   * Render the client dropdown for new messages
   */
  renderClientDropdown(clients: Array<{ id: number; name: string }>): void {
    const dropdown = getElement('admin-client-select') as HTMLSelectElement;
    if (!dropdown) return;

    dropdown.innerHTML = `
      <option value="">Select a client...</option>
      ${clients.map(client => {
    const safeName = SanitizationUtils.escapeHtml(client.name);
    return `<option value="${client.id}">${safeName}</option>`;
  }).join('')}
    `;
  }

  /**
   * Reset the renderer state
   */
  reset(): void {
    this.selectedThreadId = null;
    this.selectedClientId = null;
    this.disableComposeArea();
  }
}

// Singleton instance
export const adminMessagingRenderer = new AdminMessagingRenderer();
export default adminMessagingRenderer;
