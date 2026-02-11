/**
 * ===============================================
 * PORTAL MESSAGES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-messages.ts
 *
 * Messaging functionality for client portal.
 * Dynamically imported for code splitting.
 */

import type { PortalMessage, ClientPortalContext } from '../portal-types';
import { createDOMCache } from '../../../utils/dom-cache';
import { showToast } from '../../../utils/toast-notifications';

const MESSAGES_API_BASE = '/api/messages';
const CLIENT_THREAD_TITLE = 'Conversation with Noelle';

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the messages module */
type MessagesDOMKeys = {
  threadList: string;
  threadHeader: string;
  messagesThread: string;
  messageInput: string;
  sendBtn: string;
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<MessagesDOMKeys>();

// Register all element selectors (called once when module loads)
domCache.register({
  threadList: '#thread-list',
  threadHeader: '#messages-thread-header',
  messagesThread: '#messages-thread',
  messageInput: '#message-input',
  sendBtn: '#btn-send-message'
});

interface MessageThread {
  id: number;
  subject: string;
  project_name?: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
}

let currentThreadId: number | null = null;

/**
 * Get the current thread ID
 */
export function getCurrentThreadId(): number | null {
  return currentThreadId;
}

/**
 * Set the current thread ID
 */
export function setCurrentThreadId(id: number | null): void {
  currentThreadId = id;
}

// Store threads for reference
let cachedThreads: MessageThread[] = [];

/**
 * Load messages from API
 */
export async function loadMessagesFromAPI(ctx: ClientPortalContext, bustCache: boolean = false): Promise<void> {
  const threadList = domCache.get('threadList');
  const messagesContainer = domCache.get('messagesThread');
  if (!messagesContainer) return;

  // Show loading state
  if (threadList) {
    threadList.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';
  }
  messagesContainer.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading messages...</p></div>';

  try {
    // Add cache-busting parameter when needed (e.g., after sending a message)
    const threadsUrl = bustCache
      ? `${MESSAGES_API_BASE}/threads?_=${Date.now()}`
      : `${MESSAGES_API_BASE}/threads`;
    const threadsResponse = await fetch(threadsUrl, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!threadsResponse.ok) {
      throw new Error('Failed to load message threads');
    }

    const threadsData = await threadsResponse.json();
    const threads: MessageThread[] = threadsData.threads || [];
    cachedThreads = threads;

    // Render thread list
    if (threadList) {
      renderThreadList(threadList, threads, ctx);
    }

    if (threads.length === 0) {
      messagesContainer.innerHTML = `
        <div class="no-messages">
          <p>No messages yet. Send a message to Noelle to get started.</p>
        </div>
      `;
      return;
    }

    // If no thread is selected, select the first one
    const thread = currentThreadId
      ? threads.find(t => t.id === currentThreadId) || threads[0]
      : threads[0];

    await loadThreadMessages(thread.id, ctx, bustCache);
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesContainer.innerHTML =
      '<div class="no-messages"><p>Unable to load messages. Please try again later.</p></div>';
  }
}

/**
 * Render thread list
 */
function renderThreadList(container: HTMLElement, threads: MessageThread[], ctx: ClientPortalContext): void {
  if (threads.length === 0) {
    container.innerHTML = '<div class="no-messages"><p>No conversations</p></div>';
    return;
  }

  container.innerHTML = threads.map(thread => {
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
  }).join('');

  // Set initial aria-activedescendant if there's an active thread
  const activeThread = container.querySelector('.thread-item.active') as HTMLElement;
  if (activeThread && activeThread.id) {
    container.setAttribute('aria-activedescendant', activeThread.id);
  }

  // Add click handlers to threads
  container.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
      if (threadId && threadId !== currentThreadId) {
        selectThread(threadId, ctx);
      }
    });

    // Keyboard navigation
    item.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
        if (threadId && threadId !== currentThreadId) {
          selectThread(threadId, ctx);
        }
      }
    });
  });
}

/**
 * Select a thread and load its messages
 */
async function selectThread(threadId: number, ctx: ClientPortalContext): Promise<void> {
  currentThreadId = threadId;

  // Update active state in thread list
  const threadList = domCache.get('threadList');
  if (threadList) {
    threadList.querySelectorAll('.thread-item').forEach(item => {
      const itemThreadId = parseInt(item.getAttribute('data-thread-id') || '0');
      const isSelected = itemThreadId === threadId;
      item.classList.toggle('active', isSelected);
      item.setAttribute('aria-selected', String(isSelected));

      // Update aria-activedescendant for screen readers
      if (isSelected && (item as HTMLElement).id) {
        threadList.setAttribute('aria-activedescendant', (item as HTMLElement).id);
      }
    });
  }

  await loadThreadMessages(threadId, ctx, false);
}

/**
 * Load messages for a specific thread
 */
async function loadThreadMessages(threadId: number, ctx: ClientPortalContext, bustCache: boolean): Promise<void> {
  const messagesContainer = domCache.get('messagesThread');
  const threadHeader = domCache.get('threadHeader');
  if (!messagesContainer) return;

  currentThreadId = threadId;

  // Update header
  const thread = cachedThreads.find(t => t.id === threadId);
  if (threadHeader && thread) {
    const titleEl = threadHeader.querySelector('.thread-title');
    if (titleEl) {
      titleEl.textContent = CLIENT_THREAD_TITLE;
    }
  }

  // Show loading
  messagesContainer.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading messages...</p></div>';

  try {
    const messagesUrl = bustCache
      ? `${MESSAGES_API_BASE}/threads/${threadId}/messages?_=${Date.now()}`
      : `${MESSAGES_API_BASE}/threads/${threadId}/messages`;
    const messagesResponse = await fetch(messagesUrl, {
      credentials: 'include'
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesData = await messagesResponse.json();
    renderMessages(messagesContainer, messagesData.messages || [], ctx);

    // Mark as read
    await fetch(`${MESSAGES_API_BASE}/threads/${threadId}/read`, {
      method: 'PUT',
      credentials: 'include'
    });

    // Update unread count in thread list
    const threadList = domCache.get('threadList');
    if (threadList) {
      const threadItem = threadList.querySelector(`[data-thread-id="${threadId}"]`);
      if (threadItem) {
        threadItem.classList.remove('unread');
        const badge = threadItem.querySelector('.thread-unread-badge');
        if (badge) badge.remove();
      }
    }
  } catch (error) {
    console.error('Error loading thread messages:', error);
    messagesContainer.innerHTML = '<div class="no-messages"><p>Unable to load messages.</p></div>';
  }
}

/**
 * Format relative time (e.g., "2h ago", "Yesterday", "Dec 15")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Render messages list
 */
function renderMessages(
  container: HTMLElement,
  messages: PortalMessage[],
  ctx: ClientPortalContext
): void {
  // Add accessibility attributes to the message container
  container.setAttribute('role', 'log');
  container.setAttribute('aria-label', 'Message conversation');
  container.setAttribute('aria-live', 'polite');

  if (messages.length === 0) {
    container.innerHTML = '<div class="no-messages"><p>No messages yet. Send a message to Noelle to get started.</p></div>';
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isSent = msg.sender_type === 'client';
      const isAdmin = msg.sender_type === 'admin';
      const initials = (msg.sender_name || 'Unknown').substring(0, 3).toUpperCase();
      const displayName = isAdmin ? 'Noelle' : (msg.sender_name || 'Unknown');

      // Admin uses avatar image, clients use initials placeholder
      const avatarHtml = isAdmin
        ? '<img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />'
        : `<div class="avatar-placeholder">${initials}</div>`;

      const senderClass = isAdmin ? 'message-admin' : 'message-client';

      return `
      <div class="message message-${isSent ? 'sent' : 'received'} ${senderClass}">
        <div class="message-avatar">
          ${avatarHtml}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${ctx.escapeHtml(displayName)}</span>
            <span class="message-time">${ctx.formatDate(msg.created_at)}</span>
          </div>
          <div class="message-body">${ctx.escapeHtml(msg.message)}</div>
        </div>
      </div>
    `;
    })
    .join('');

  container.scrollTop = container.scrollHeight;
}

/**
 * Send a message
 */
export async function sendMessage(ctx: ClientPortalContext): Promise<void> {
  const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  try {
    let url: string;
    let body: { message: string; subject?: string };

    if (currentThreadId) {
      url = `${MESSAGES_API_BASE}/threads/${currentThreadId}/messages`;
      body = { message };
    } else {
      url = `${MESSAGES_API_BASE}/inquiry`;
      body = { subject: 'General Inquiry', message };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include HttpOnly cookies
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();

    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    messageInput.value = '';
    // Use cache busting to ensure we get the latest messages after sending
    await loadMessagesFromAPI(ctx, true);
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message. Please try again.', 'error');
  }
}

/**
 * Setup messaging event listeners
 */
export function setupMessagingListeners(ctx: ClientPortalContext): void {
  const sendBtn = domCache.get('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage(ctx);
    });
  }

  const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(ctx);
      }
    });
  }
}
