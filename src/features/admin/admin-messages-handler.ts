/**
 * ===============================================
 * ADMIN MESSAGES HANDLER
 * ===============================================
 * @file src/features/admin/admin-messages-handler.ts
 *
 * Handles message thread selection, loading, rendering,
 * and sending for the admin messaging system.
 */

import type { Message } from './admin-types';
import { apiFetch, apiPost, apiPut, unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { formatDateTime } from '../../utils/format-utils';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import { alertError } from '../../utils/confirm-dialog';
import type { createDOMCache } from '../../utils/dom-cache';

const logger = createLogger('AdminMessages');

type DOMCacheInstance = ReturnType<typeof createDOMCache>;

/**
 * Select a message thread and enable the compose area.
 */
export function selectThread(
  clientId: number,
  threadId: number,
  _clientName: string,
  domCache: DOMCacheInstance,
  state: { selectedClientId: number | null; selectedThreadId: number | null }
): void {
  state.selectedClientId = clientId;
  state.selectedThreadId = threadId;

  const textarea = domCache.getAs<HTMLTextAreaElement>('adminMessageText');
  const sendButton = domCache.getAs<HTMLButtonElement>('adminSendMessage');
  if (textarea) {
    textarea.disabled = false;
    textarea.placeholder = 'Type your message...';
  }
  if (sendButton) {
    sendButton.disabled = false;
  }

  loadThreadMessages(threadId, domCache);
}

/**
 * Load messages for a specific thread.
 */
export async function loadThreadMessages(
  threadId: number,
  domCache: DOMCacheInstance
): Promise<void> {
  const container =
    domCache.get('adminMessagesThread') || domCache.get('adminMessagesContainer');
  if (!container) return;

  container.innerHTML =
    '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>';

  try {
    const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);

    if (response.ok) {
      const raw = await response.json();
      const data = unwrapApiData<{ messages?: Message[] }>(raw);
      renderMessages(data.messages || [], domCache);

      await apiPut(`/api/messages/threads/${threadId}/read`);
    } else {
      container.innerHTML = '<div class="empty-state-message">Failed to load messages</div>';
    }
  } catch (error) {
    logger.error(' Failed to load messages:', error);
    container.innerHTML = '<div class="empty-state-message">Error loading messages</div>';
  }
}

/**
 * Render messages in the thread container.
 */
function renderMessages(messages: Message[], domCache: DOMCacheInstance): void {
  const container =
    domCache.get('adminMessagesThread') || domCache.get('adminMessagesContainer');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML =
      '<div class="empty-state-message">No messages yet. Start the conversation!</div>';
    return;
  }

  container.innerHTML = messages
    .map((msg: Message) => {
      const isAdmin = msg.sender_type === 'admin';
      const dateTime = formatDateTime(msg.created_at);
      const rawSenderName = isAdmin
        ? 'You'
        : SanitizationUtils.decodeHtmlEntities(msg.sender_name || 'Client');
      const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
      const safeContent = SanitizationUtils.escapeHtml(
        SanitizationUtils.decodeHtmlEntities(msg.message || msg.content || '')
      );
      const safeInitials = SanitizationUtils.escapeHtml(
        rawSenderName.substring(0, 2).toUpperCase()
      );

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
            <div class="message-avatar" data-name="Admin">
              <img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
            </div>
          </div>
        `;
      }
      return `
          <div class="message message-received">
            <div class="message-avatar" data-name="${safeSenderName}">
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
    })
    .join('');

  container.scrollTop = container.scrollHeight;
}

/**
 * Send a message in the current thread.
 */
export async function sendMessage(
  domCache: DOMCacheInstance,
  state: { selectedThreadId: number | null },
  loadTabData: (tab: string) => Promise<void>
): Promise<void> {
  const input = domCache.getAs<HTMLInputElement>('adminMessageText');
  if (!input || !input.value.trim() || !state.selectedThreadId) return;

  const message = input.value.trim();
  input.value = '';
  input.disabled = true;

  try {
    const response = await apiPost(`/api/messages/threads/${state.selectedThreadId}/messages`, {
      message
    });

    if (response.ok) {
      loadThreadMessages(state.selectedThreadId, domCache);
      loadTabData('messages');
    } else {
      const error = await response.json();
      logger.error(' Failed to send message:', error);
      alertError('Failed to send message. Please try again.');
    }
  } catch (error) {
    logger.error(' Error sending message:', error);
    alertError('Error sending message. Please try again.');
  } finally {
    input.disabled = false;
    input.focus();
  }
}
