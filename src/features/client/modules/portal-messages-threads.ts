/**
 * ===============================================
 * PORTAL MESSAGES - THREAD MANAGEMENT
 * ===============================================
 * @file src/features/client/modules/portal-messages-threads.ts
 *
 * Thread list rendering, selection, and message action handlers.
 * Extracted from portal-messages.ts for maintainability.
 */

import type { PortalMessage, ClientPortalContext } from '../portal-types';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';
import { confirmDanger, promptDialog } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { formatTimeAgo } from '../../../utils/time-utils';
import { apiFetch, unwrapApiData } from '../../../utils/api-client';
import { createLogger } from '../../../utils/logger';
import { renderMessages } from './portal-messages-renderer';

const logger = createLogger('PortalMessagesThreads');

const MESSAGES_API = API_ENDPOINTS.MESSAGES;
const CLIENT_THREAD_TITLE = 'Conversation with Noelle';

export interface MessageThread {
  id: number;
  subject: string;
  project_name?: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
}

/**
 * Format relative time using shared utility
 */
function formatRelativeTime(date: Date): string {
  return formatTimeAgo(date);
}

/**
 * Render thread list
 */
export function renderThreadList(
  container: HTMLElement,
  threads: MessageThread[],
  ctx: ClientPortalContext,
  currentThreadId: number | null,
  onSelectThread: (threadId: number) => void
): void {
  if (threads.length === 0) {
    renderEmptyState(container, 'No conversations', { className: 'no-messages' });
    return;
  }

  container.innerHTML = threads
    .map((thread) => {
      const isActive = thread.id === currentThreadId;
      const hasUnread = thread.unread_count > 0;
      const lastMessageDate = new Date(thread.last_message_at);
      const timeStr = formatRelativeTime(lastMessageDate);
      const itemId = `portal-thread-item-${thread.id}`;

      return `
      <div class="thread-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}"
           id="${itemId}"
           data-thread-id="${thread.id}"
           role="option"
           aria-selected="${isActive}"
           tabindex="0">
        <div class="thread-item-header">
          <span class="thread-item-title">${ctx.escapeHtml(thread.subject || 'General')}</span>
          <span class="thread-item-time">${timeStr}</span>
        </div>
        <div class="thread-item-meta">
          <span class="thread-item-project">${thread.project_name ? ctx.escapeHtml(thread.project_name) : 'General'}</span>
          ${hasUnread ? `<span class="thread-unread-badge">${thread.unread_count}</span>` : ''}
        </div>
      </div>
    `;
    })
    .join('');

  // Set initial aria-activedescendant if there's an active thread
  const activeThread = container.querySelector('.thread-item.active') as HTMLElement;
  if (activeThread && activeThread.id) {
    container.setAttribute('aria-activedescendant', activeThread.id);
  }

  // Add click handlers to threads
  container.querySelectorAll('.thread-item').forEach((item) => {
    item.addEventListener('click', () => {
      const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
      if (threadId && threadId !== currentThreadId) {
        onSelectThread(threadId);
      }
    });

    // Keyboard navigation
    item.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
        if (threadId && threadId !== currentThreadId) {
          onSelectThread(threadId);
        }
      }
    });
  });
}

/**
 * Load messages for a specific thread
 */
export async function loadThreadMessages(
  threadId: number,
  ctx: ClientPortalContext,
  bustCache: boolean,
  cachedThreads: MessageThread[],
  domElements: {
    messagesContainer: HTMLElement | null;
    threadHeader: HTMLElement | null;
    threadList: HTMLElement | null;
  }
): Promise<void> {
  const { messagesContainer, threadHeader, threadList } = domElements;
  if (!messagesContainer) return;

  // Update header
  const thread = cachedThreads.find((t) => t.id === threadId);
  if (threadHeader && thread) {
    const titleEl = threadHeader.querySelector('.thread-title');
    if (titleEl) {
      titleEl.textContent = CLIENT_THREAD_TITLE;
    }
  }

  // Show loading
  messagesContainer.innerHTML =
    '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading messages...</span></div>';

  try {
    const messagesUrl = bustCache
      ? `${MESSAGES_API}/threads/${threadId}/messages?_=${Date.now()}`
      : `${MESSAGES_API}/threads/${threadId}/messages`;
    const messagesResponse = await apiFetch(messagesUrl);

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesRaw = await messagesResponse.json();
    const messagesData = unwrapApiData<Record<string, unknown>>(messagesRaw);
    renderMessages(messagesContainer, (messagesData.messages as PortalMessage[]) || [], ctx);

    // Mark as read
    await apiFetch(`${MESSAGES_API}/threads/${threadId}/read`, {
      method: 'PUT'
    });

    // Update unread count in thread list
    if (threadList) {
      const threadItem = threadList.querySelector(`[data-thread-id="${threadId}"]`);
      if (threadItem) {
        threadItem.classList.remove('unread');
        const badge = threadItem.querySelector('.thread-unread-badge');
        if (badge) badge.remove();
      }
    }
  } catch (error) {
    logger.error('Error loading thread messages:', error);
    renderErrorState(messagesContainer, 'Unable to load messages.', {
      className: 'no-messages',
      type: 'network'
    });
  }
}

/**
 * Set up click handlers for edit/delete message buttons
 */
export function setupMessageActionHandlers(
  container: HTMLElement,
  ctx: ClientPortalContext
): void {
  // Edit button handlers
  container.querySelectorAll('.message-edit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const messageId = (btn as HTMLElement).dataset.messageId;
      if (messageId) {
        await handleEditMessage(parseInt(messageId), container, ctx);
      }
    });
  });

  // Delete button handlers
  container.querySelectorAll('.message-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const messageId = (btn as HTMLElement).dataset.messageId;
      if (messageId) {
        await handleDeleteMessage(parseInt(messageId), ctx);
      }
    });
  });
}

/**
 * Handle editing a message
 */
async function handleEditMessage(
  messageId: number,
  container: HTMLElement,
  ctx: ClientPortalContext
): Promise<void> {
  // Find the message element to get current text
  const messageEl = container.querySelector(`[data-message-id="${messageId}"]`);
  const currentText = messageEl?.querySelector('.message-body')?.textContent || '';

  const newText = await promptDialog({
    title: 'Edit Message',
    label: 'Message',
    defaultValue: currentText,
    required: true,
    confirmText: 'Save',
    cancelText: 'Cancel'
  });

  if (newText === null || newText.trim() === currentText.trim()) {
    return; // Cancelled or no change
  }

  try {
    const response = await apiFetch(`${MESSAGES_API}/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newText.trim() })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to edit message');
    }

    showToast('Message updated', 'success');
    // Reload is triggered by the caller via loadMessagesFromAPI
    const { loadMessagesFromAPI } = await import('./portal-messages');
    await loadMessagesFromAPI(ctx, true);
  } catch (error) {
    logger.error('Error editing message:', error);
    showToast('Failed to edit message. Please try again.', 'error');
  }
}

/**
 * Handle deleting a message
 */
async function handleDeleteMessage(
  messageId: number,
  ctx: ClientPortalContext
): Promise<void> {
  const confirmed = await confirmDanger(
    'This message will be permanently deleted.',
    'Delete',
    'Delete Message'
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await apiFetch(`${MESSAGES_API}/messages/${messageId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete message');
    }

    showToast('Message deleted', 'success');
    // Reload is triggered by the caller via loadMessagesFromAPI
    const { loadMessagesFromAPI } = await import('./portal-messages');
    await loadMessagesFromAPI(ctx, true);
  } catch (error) {
    logger.error('Error deleting message:', error);
    showToast('Failed to delete message. Please try again.', 'error');
  }
}
