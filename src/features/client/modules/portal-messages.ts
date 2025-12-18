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

const MESSAGES_API_BASE = '/api/messages';

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
export async function loadMessagesFromAPI(ctx: ClientPortalContext): Promise<void> {
  const messagesContainer = document.getElementById('messages-list');
  if (!messagesContainer) return;

  if (ctx.isDemo()) {
    renderDemoMessages(messagesContainer, ctx);
    return;
  }

  try {
    const threadsResponse = await fetch(`${MESSAGES_API_BASE}/threads`, {
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

    const messagesResponse = await fetch(`${MESSAGES_API_BASE}/threads/${thread.id}/messages`, {
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
    renderDemoMessages(messagesContainer, ctx);
  }
}

/**
 * Render demo messages
 */
function renderDemoMessages(container: HTMLElement, ctx: ClientPortalContext): void {
  const demoMessages: PortalMessage[] = [
    {
      id: 1,
      sender_type: 'admin',
      sender_name: 'Support',
      message: 'Welcome to your client portal! Feel free to send us any questions.',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 2,
      sender_type: 'client',
      sender_name: 'You',
      message: 'Thanks! Looking forward to working together.',
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ];
  renderMessages(container, demoMessages, ctx);
}

/**
 * Render messages list
 */
function renderMessages(
  container: HTMLElement,
  messages: PortalMessage[],
  ctx: ClientPortalContext
): void {
  if (messages.length === 0) {
    container.innerHTML = '<div class="no-messages"><p>No messages in this thread yet.</p></div>';
    return;
  }

  container.innerHTML = messages
    .map(
      (msg) => `
      <div class="message message-${msg.sender_type === 'client' ? 'sent' : 'received'}">
        <div class="message-header">
          <span class="message-sender">${ctx.escapeHtml(msg.sender_name || 'Unknown')}</span>
          <span class="message-time">${ctx.formatDate(msg.created_at)}</span>
        </div>
        <div class="message-content">${ctx.escapeHtml(msg.message)}</div>
      </div>
    `
    )
    .join('');

  container.scrollTop = container.scrollHeight;
}

/**
 * Send a message
 */
export async function sendMessage(ctx: ClientPortalContext): Promise<void> {
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  if (ctx.isDemo()) {
    addDemoMessage(message, ctx);
    messageInput.value = '';
    return;
  }

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
    await loadMessagesFromAPI(ctx);
  } catch (error) {
    console.error('Error sending message:', error);
    alert(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
  }
}

/**
 * Add a demo message locally (for demo mode only, resets on refresh)
 */
function addDemoMessage(message: string, ctx: ClientPortalContext): void {
  const messagesThread = document.getElementById('messages-thread');
  if (!messagesThread) return;

  const now = new Date();
  const timeString = `${now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })} at ${now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`;

  const messageHTML = `
    <div class="message message-sent">
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">You</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-body">${ctx.escapeHtml(message)}</div>
      </div>
      <div class="message-avatar" data-name="You">
        <div class="avatar-placeholder">YOU</div>
      </div>
    </div>
  `;

  messagesThread.insertAdjacentHTML('beforeend', messageHTML);
  messagesThread.scrollTop = messagesThread.scrollHeight;
}

/**
 * Setup messaging event listeners
 */
export function setupMessagingListeners(ctx: ClientPortalContext): void {
  const sendBtn = document.getElementById('btn-send-message');
  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage(ctx);
    });
  }

  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(ctx);
      }
    });
  }

  const emojiPicker = document.querySelector('emoji-picker');
  if (emojiPicker && messageInput) {
    emojiPicker.addEventListener('emoji-click', ((e: CustomEvent) => {
      const emoji = e.detail?.unicode;
      if (emoji) {
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        messageInput.focus();
      }
    }) as EventListener);
  }
}
