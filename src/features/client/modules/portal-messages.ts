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

const MESSAGES_API_BASE = '/api/messages';

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the messages module */
type MessagesDOMKeys = {
  messagesThread: string;
  messageInput: string;
  sendBtn: string;
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<MessagesDOMKeys>();

// Register all element selectors (called once when module loads)
domCache.register({
  messagesThread: '#messages-thread',
  messageInput: '#message-input',
  sendBtn: '#btn-send-message'
});

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

/**
 * Load messages from API
 */
export async function loadMessagesFromAPI(ctx: ClientPortalContext, bustCache: boolean = false): Promise<void> {
  const messagesContainer = domCache.get('messagesThread');
  if (!messagesContainer) return;

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
    const threads = threadsData.threads || [];

    if (threads.length === 0) {
      messagesContainer.innerHTML = `
        <div class="no-messages">
          <p>No messages yet. Start a conversation!</p>
        </div>
      `;
      return;
    }

    const thread = threads[0];
    currentThreadId = thread.id;

    // Add cache-busting parameter when needed
    const messagesUrl = bustCache
      ? `${MESSAGES_API_BASE}/threads/${thread.id}/messages?_=${Date.now()}`
      : `${MESSAGES_API_BASE}/threads/${thread.id}/messages`;
    const messagesResponse = await fetch(messagesUrl, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesData = await messagesResponse.json();
    renderMessages(messagesContainer, messagesData.messages || [], ctx);

    await fetch(`${MESSAGES_API_BASE}/threads/${thread.id}/read`, {
      method: 'PUT',
      credentials: 'include' // Include HttpOnly cookies
    });
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesContainer.innerHTML =
      '<div class="no-messages"><p>Unable to load messages. Please try again later.</p></div>';
  }
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
    container.innerHTML = '<div class="no-messages"><p>No messages in this thread yet.</p></div>';
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isSent = msg.sender_type === 'client';
      const isAdmin = msg.sender_type === 'admin';
      const initials = (msg.sender_name || 'Unknown').substring(0, 3).toUpperCase();
      const avatarClass = isAdmin ? 'avatar-placeholder avatar-admin' : 'avatar-placeholder';
      return `
      <div class="message message-${isSent ? 'sent' : 'received'}">
        <div class="message-avatar">
          <div class="${avatarClass}">${initials}</div>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${ctx.escapeHtml(msg.sender_name || 'Unknown')}</span>
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
    alert(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
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
