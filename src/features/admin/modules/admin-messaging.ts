/**
 * ===============================================
 * ADMIN MESSAGING MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-messaging.ts
 *
 * Client messaging functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

/* global NodeFilter, Text */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDateTime } from '../../../utils/format-utils';
import type { Message, AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import type {
  ClientResponse,
  MessageThreadResponse,
  MessageResponse
} from '../../../types/api';

let selectedClientId: number | null = null;
let selectedThreadId: number | null = null;
let selectedClientName: string = 'Client';

// Available reactions
const REACTIONS = ['👍', '❤️', '😊', '😮', '👏'];

interface MessageReaction {
  id: number;
  reaction: string;
  user_email: string;
  created_at: string;
}

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

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

export function getSelectedThreadId(): number | null {
  return selectedThreadId;
}

export function getSelectedClientId(): number | null {
  return selectedClientId;
}

interface ClientWithThread {
  client_id: number;
  thread_id: number | null;
  contact_name: string;
  company_name: string | null;
  email: string;
  message_count: number;
  unread_count: number;
  last_message_at: string | null;
}

// Cache clients with threads for reference
let _cachedClientsWithThreads: ClientWithThread[] = [];

export async function loadClientThreads(ctx: AdminDashboardContext): Promise<void> {
  const threadList = getElement('admin-thread-list');
  if (!threadList) return;

  // Show loading state
  threadList.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';

  try {
    // Fetch both clients and threads in parallel
    const [clientsResponse, threadsResponse] = await Promise.all([
      fetch('/api/clients', { credentials: 'include' }),
      fetch('/api/messages/threads', { credentials: 'include' })
    ]);

    const clientsData = clientsResponse.ok ? (await clientsResponse.json() as { clients?: ClientResponse[] }) : { clients: [] };
    const threadsData = threadsResponse.ok ? (await threadsResponse.json() as { threads?: (MessageThreadResponse & { message_count?: number; last_message_at?: string })[] }) : { threads: [] };

    // Create a map of client_id -> thread info
    const threadMap = new Map<number, MessageThreadResponse & { message_count?: number; last_message_at?: string }>();
    (threadsData.threads || []).forEach((thread: MessageThreadResponse & { message_count?: number; last_message_at?: string }) => {
      // Keep the thread with the most messages if client has multiple threads
      const existing = threadMap.get(thread.client_id);
      if (!existing || (thread.message_count || 0) > (existing.message_count || 0)) {
        threadMap.set(thread.client_id, thread);
      }
    });

    // Merge clients with their thread data
    const clientsWithThreads: ClientWithThread[] = (clientsData.clients || []).map((client: ClientResponse) => {
      const thread = threadMap.get(client.id);
      return {
        client_id: client.id,
        thread_id: thread?.id || null,
        contact_name: client.contact_name || '',
        company_name: client.company_name || null,
        email: client.email,
        message_count: thread?.message_count || 0,
        unread_count: thread?.unread_count || 0,
        last_message_at: thread?.last_message_at || null
      };
    });

    // Sort: clients with unread messages first, then by last message time, then alphabetically
    clientsWithThreads.sort((a, b) => {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
      // Sort by last message time if both have messages
      if (a.last_message_at && b.last_message_at) {
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      }
      if (a.last_message_at && !b.last_message_at) return -1;
      if (!a.last_message_at && b.last_message_at) return 1;
      const nameA = a.contact_name || a.company_name || '';
      const nameB = b.contact_name || b.company_name || '';
      return nameA.localeCompare(nameB);
    });

    _cachedClientsWithThreads = clientsWithThreads;
    renderThreadList(threadList, clientsWithThreads, ctx);
  } catch (error) {
    console.error('[AdminMessaging] Failed to load clients/threads:', error);
    threadList.innerHTML = '<div class="empty-state">Failed to load conversations</div>';
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
 * Render thread list in sidebar
 */
function renderThreadList(container: HTMLElement, clients: ClientWithThread[], ctx: AdminDashboardContext): void {
  if (clients.length === 0) {
    container.innerHTML = '<div class="empty-state">No clients yet</div>';
    return;
  }

  container.innerHTML = clients.map(client => {
    const isActive = client.client_id === selectedClientId;
    const hasUnread = client.unread_count > 0;
    const safeCompany = client.company_name ? SanitizationUtils.escapeHtml(client.company_name) : '';
    const safeContact = client.contact_name ? SanitizationUtils.escapeHtml(client.contact_name) : '';
    const primaryName = safeCompany || safeContact || 'Unknown Client';
    const secondaryName = safeCompany && safeContact ? safeContact : '';
    const timeStr = client.last_message_at ? formatRelativeTime(new Date(client.last_message_at)) : '';

    const itemId = `thread-item-${client.client_id}`;
    return `
      <div class="thread-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}"
           id="${itemId}"
           data-client-id="${client.client_id}"
           data-thread-id="${client.thread_id || 'new'}"
           role="option"
           aria-selected="${isActive}"
           tabindex="0">
        <div class="thread-item-header">
          <span class="thread-item-title">${primaryName}</span>
          <span class="thread-item-time">${timeStr}</span>
        </div>
        ${secondaryName ? `<div class="thread-item-contact">${secondaryName}</div>` : ''}
        <div class="thread-item-meta">
          ${hasUnread ? `<span class="thread-unread-badge">${client.unread_count}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  setupThreadListHandlers(container, ctx);
}

/**
 * Setup click and keyboard handlers for thread list
 */
function setupThreadListHandlers(container: HTMLElement, ctx: AdminDashboardContext): void {
  container.querySelectorAll('.thread-item').forEach(item => {
    const handleSelect = async () => {
      const clientId = parseInt((item as HTMLElement).dataset.clientId || '0');
      const threadIdStr = (item as HTMLElement).dataset.threadId || 'new';

      if (!clientId) return;

      // Get client name from the item
      const titleEl = item.querySelector('.thread-item-title');
      const clientName = titleEl?.textContent || 'Client';
      selectedClientName = clientName;

      // Update active state visually
      container.querySelectorAll('.thread-item').forEach(i => {
        i.classList.remove('active');
        i.setAttribute('aria-selected', 'false');
      });
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');

      // Update aria-activedescendant on listbox for screen readers
      const itemId = (item as HTMLElement).id;
      if (itemId) {
        container.setAttribute('aria-activedescendant', itemId);
      }

      // Update header title
      const threadHeader = getElement('admin-thread-header');
      if (threadHeader) {
        const titleSpan = threadHeader.querySelector('.thread-title');
        if (titleSpan) {
          titleSpan.textContent = clientName;
        }
      }

      // Check if we need to create a new thread
      if (threadIdStr === 'new') {
        try {
          const response = await apiPost('/api/messages/threads', {
            client_id: clientId,
            subject: `Conversation with ${clientName}`,
            thread_type: 'general'
          });

          if (response.ok) {
            const data = await response.json();
            const newThreadId = data.thread.id;
            // Update the item's data attribute
            (item as HTMLElement).dataset.threadId = String(newThreadId);
            selectThread(clientId, newThreadId, ctx);
          } else {
            ctx.showNotification('Failed to start conversation', 'error');
          }
        } catch (error) {
          console.error('[AdminMessaging] Failed to create thread:', error);
          ctx.showNotification('Error starting conversation', 'error');
        }
      } else {
        const threadId = parseInt(threadIdStr);
        selectThread(clientId, threadId, ctx);
      }
    };

    // Click handler
    item.addEventListener('click', handleSelect);

    // Keyboard handler
    item.addEventListener('keydown', (e) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        e.preventDefault();
        handleSelect();
      } else if (keyEvent.key === 'ArrowDown') {
        e.preventDefault();
        const next = item.nextElementSibling as HTMLElement;
        if (next) next.focus();
      } else if (keyEvent.key === 'ArrowUp') {
        e.preventDefault();
        const prev = item.previousElementSibling as HTMLElement;
        if (prev) prev.focus();
      }
    });
  });
}

export function selectThread(
  clientId: number,
  threadId: number,
  ctx: AdminDashboardContext
): void {
  selectedClientId = clientId;
  selectedThreadId = threadId;

  // Enable compose area inputs
  const textarea = getElement('admin-message-text') as HTMLTextAreaElement;
  const sendButton = getElement('admin-send-message') as HTMLButtonElement;
  if (textarea) {
    textarea.disabled = false;
    textarea.placeholder = 'Type your message...';
  }
  if (sendButton) {
    sendButton.disabled = false;
  }

  loadThreadMessages(threadId, ctx);
}

export async function loadThreadMessages(
  threadId: number,
  _ctx: AdminDashboardContext,
  bustCache: boolean = false
): Promise<void> {
  const container = getMessagesContainer();
  if (!container) return;

  // Add ARIA attributes for accessibility - live region for screen readers
  container.setAttribute('role', 'log');
  container.setAttribute('aria-label', 'Message conversation');
  container.setAttribute('aria-live', 'polite');

  container.innerHTML =
    '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

  try {
    // Add cache-busting parameter when needed (e.g., after sending a message)
    const url = bustCache
      ? `/api/messages/threads/${threadId}/messages?_=${Date.now()}`
      : `/api/messages/threads/${threadId}/messages`;
    const response = await apiFetch(url);

    if (response.ok) {
      const data = await response.json();
      renderMessages(data.messages || [], container);

      // Mark messages as read
      await apiPut(`/api/messages/threads/${threadId}/read`);
    } else {
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: var(--portal-text-muted);">Failed to load messages</div>';
    }
  } catch (error) {
    console.error('[AdminMessaging] Failed to load messages:', error);
    container.innerHTML =
      '<div style="text-align: center; padding: 2rem; color: var(--portal-text-muted);">Error loading messages</div>';
  }
}

function renderMessages(messages: Message[], container: HTMLElement): void {
  if (messages.length === 0) {
    container.innerHTML =
      '<div style="text-align: center; padding: 2rem; color: var(--portal-text-muted);">No messages yet. Start the conversation!</div>';
    return;
  }

  container.innerHTML = messages
    .map((msg: MessageResponse & { is_pinned?: boolean; is_read?: boolean; reactions?: MessageReaction[] }) => {
      const isAdmin = msg.sender_type === 'admin';
      const dateTime = formatDateTime(msg.created_at);
      const rawSenderName = isAdmin ? 'You' : SanitizationUtils.decodeHtmlEntities(selectedClientName || 'Client');
      const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
      const safeContent = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(msg.message || ''));
      const initials = rawSenderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const safeInitials = SanitizationUtils.escapeHtml(initials);
      const isPinned = msg.is_pinned || false;

      // Build reactions HTML
      const reactionsHtml = renderReactionsHtml(msg.id, msg.reactions || []);

      // Read receipt for admin messages
      const readReceiptHtml = isAdmin ? `
        <div class="message-status ${msg.is_read ? 'read' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${msg.is_read
    ? '<polyline points="20 6 9 17 4 12"></polyline><polyline points="20 12 9 23 4 18"></polyline>'
    : '<polyline points="20 6 9 17 4 12"></polyline>'}
          </svg>
          ${msg.is_read ? 'Read' : 'Sent'}
        </div>
      ` : '';

      // Action buttons (pin, reaction picker)
      // Use pin icon when NOT pinned (to pin), pin-off icon when IS pinned (to unpin)
      const pinIcon = isPinned
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
          </svg>`;
      const actionsHtml = `
        <div class="message-actions">
          <button class="pin-message-btn ${isPinned ? 'pinned' : ''}" data-message-id="${msg.id}" title="${isPinned ? 'Unpin' : 'Pin'} message">
            ${pinIcon}
          </button>
          <button class="add-reaction-btn" data-message-id="${msg.id}" title="Add reaction">+</button>
          <div class="reaction-picker hidden" data-message-id="${msg.id}">
            ${REACTIONS.map(r => `<button data-reaction="${r}">${r}</button>`).join('')}
            <span class="picker-plus">+</span>
          </div>
        </div>
      `;

      if (isAdmin) {
        return `
          <div class="message message-sent ${isPinned ? 'pinned' : ''}" data-message-id="${msg.id}">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">You</span>
                <span class="message-time">${dateTime}</span>
                ${actionsHtml}
              </div>
              <div class="message-body">${safeContent}</div>
              ${reactionsHtml}
              ${readReceiptHtml}
            </div>
            <div class="message-avatar">
              <img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
            </div>
          </div>
        `;
      }

      return `
        <div class="message message-received ${isPinned ? 'pinned' : ''}" data-message-id="${msg.id}">
          <div class="message-avatar">
            <div class="avatar-placeholder">${safeInitials}</div>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-sender">${safeSenderName}</span>
              <span class="message-time">${dateTime}</span>
              ${actionsHtml}
            </div>
            <div class="message-body">${safeContent}</div>
            ${reactionsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  // Add event listeners for reactions and pins
  setupMessageInteractions(container);

  container.scrollTop = container.scrollHeight;
}

/**
 * Render reactions HTML for a message
 */
function renderReactionsHtml(messageId: number, reactions: MessageReaction[]): string {
  // Group reactions by emoji
  const grouped = new Map<string, number>();
  reactions.forEach(r => {
    grouped.set(r.reaction, (grouped.get(r.reaction) || 0) + 1);
  });

  const reactionBadges = Array.from(grouped.entries())
    .map(([emoji, count]) => `
      <span class="reaction-badge" data-message-id="${messageId}" data-reaction="${emoji}">
        ${emoji} <span class="reaction-count">${count}</span>
      </span>
    `)
    .join('');

  return `
    <div class="message-reactions">
      ${reactionBadges}
    </div>
  `;
}

/**
 * Setup interactions for messages (reactions, pins)
 */
function setupMessageInteractions(container: HTMLElement): void {
  const LONG_PRESS_DURATION = 500;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Helper to toggle reaction picker for a message
  const toggleReactionPicker = (messageId: string) => {
    const picker = container.querySelector(`.reaction-picker[data-message-id="${messageId}"]`);
    const actions = picker?.closest('.message-actions');
    const isOpen = !picker?.classList.contains('hidden');

    // Close all other pickers first
    container.querySelectorAll('.reaction-picker').forEach(p => {
      p.classList.add('hidden');
      p.closest('.message-actions')?.classList.remove('picker-open');
    });

    // Toggle this picker
    if (!isOpen && picker) {
      picker.classList.remove('hidden');
      actions?.classList.add('picker-open');
    }
  };

  // Long press on message content (iMessage style)
  container.querySelectorAll('.message-content').forEach(content => {
    const message = content.closest('.message') as HTMLElement;
    const messageId = message?.dataset.messageId;
    if (!messageId) return;

    const startLongPress = () => {
      longPressTimer = setTimeout(() => {
        toggleReactionPicker(messageId);
      }, LONG_PRESS_DURATION);
    };

    const cancelLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    // Touch events for mobile
    content.addEventListener('touchstart', startLongPress, { passive: true });
    content.addEventListener('touchend', cancelLongPress);
    content.addEventListener('touchmove', cancelLongPress);

    // Mouse events for desktop
    content.addEventListener('mousedown', startLongPress);
    content.addEventListener('mouseup', cancelLongPress);
    content.addEventListener('mouseleave', cancelLongPress);
  });

  // Add reaction button clicks (toggles picker)
  container.querySelectorAll('.add-reaction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = (btn as HTMLElement).dataset.messageId;
      if (messageId) {
        toggleReactionPicker(messageId);
      }
    });
  });

  // X button inside picker closes it
  container.querySelectorAll('.picker-plus').forEach(plus => {
    plus.addEventListener('click', (e) => {
      e.stopPropagation();
      const picker = (plus as HTMLElement).closest('.reaction-picker');
      const actions = picker?.closest('.message-actions');
      picker?.classList.add('hidden');
      actions?.classList.remove('picker-open');
    });
  });

  // Reaction picker button clicks
  container.querySelectorAll('.reaction-picker button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const picker = (btn as HTMLElement).closest('.reaction-picker') as HTMLElement;
      const actions = picker?.closest('.message-actions');
      const messageId = picker?.dataset.messageId;
      const reaction = (btn as HTMLElement).dataset.reaction;
      if (messageId && reaction) {
        await addReaction(parseInt(messageId, 10), reaction);
        picker?.classList.add('hidden');
        actions?.classList.remove('picker-open');
      }
    });
  });

  // Existing reaction badge clicks (toggle)
  container.querySelectorAll('.reaction-badge').forEach(badge => {
    badge.addEventListener('click', async () => {
      const messageId = (badge as HTMLElement).dataset.messageId;
      const reaction = (badge as HTMLElement).dataset.reaction;
      if (messageId && reaction) {
        await toggleReaction(parseInt(messageId, 10), reaction);
      }
    });
  });

  // Pin button clicks
  container.querySelectorAll('.pin-message-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = (btn as HTMLElement).dataset.messageId;
      const isPinned = btn.classList.contains('pinned');
      if (messageId && selectedThreadId) {
        await togglePin(parseInt(messageId, 10), isPinned);
      }
    });
  });

  // Close reaction pickers when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.reaction-picker') && !target.closest('.add-reaction-btn')) {
      container.querySelectorAll('.reaction-picker').forEach(picker => {
        picker.classList.add('hidden');
        picker.closest('.message-actions')?.classList.remove('picker-open');
      });
    }
  });
}

/**
 * Add a reaction to a message
 */
async function addReaction(messageId: number, reaction: string): Promise<void> {
  try {
    console.log('[AdminMessaging] Adding reaction:', { messageId, reaction });
    const response = await apiPost(`/api/messages/${messageId}/reactions`, { reaction });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AdminMessaging] Failed to add reaction:', response.status, errorData);
      return;
    }

    console.log('[AdminMessaging] Reaction added successfully');

    // Reload messages to show updated reactions
    if (selectedThreadId) {
      const container = getMessagesContainer();
      if (container) {
        await loadThreadMessagesWithReactions(selectedThreadId, container);
      }
    }
  } catch (error) {
    console.error('[AdminMessaging] Error adding reaction:', error);
  }
}

/**
 * Toggle a reaction (add if not present, remove if present)
 */
async function toggleReaction(messageId: number, reaction: string): Promise<void> {
  try {
    // Try to remove first, if fails then add
    const response = await apiDelete(`/api/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`);
    if (!response.ok) {
      await apiPost(`/api/messages/${messageId}/reactions`, { reaction });
    }
    // Reload messages
    if (selectedThreadId) {
      const container = getMessagesContainer();
      if (container) {
        await loadThreadMessagesWithReactions(selectedThreadId, container);
      }
    }
  } catch (error) {
    console.error('[AdminMessaging] Error toggling reaction:', error);
  }
}

/**
 * Toggle pin status for a message
 */
async function togglePin(messageId: number, isPinned: boolean): Promise<void> {
  if (!selectedThreadId) return;
  try {
    if (isPinned) {
      // Unpin: DELETE with thread_id as query param
      await apiDelete(`/api/messages/${messageId}/pin?thread_id=${selectedThreadId}`);
    } else {
      // Pin: POST with thread_id in body
      await apiPost(`/api/messages/${messageId}/pin`, { thread_id: selectedThreadId });
    }
    // Reload messages
    const container = getMessagesContainer();
    if (container) {
      await loadThreadMessagesWithReactions(selectedThreadId, container);
    }
  } catch (error) {
    console.error('[AdminMessaging] Error toggling pin:', error);
  }
}

/**
 * Load thread messages with reactions
 */
async function loadThreadMessagesWithReactions(threadId: number, container: HTMLElement): Promise<void> {
  try {
    const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);
    if (response.ok) {
      const data = await response.json();
      renderMessages(data.messages || [], container);
    }
  } catch (error) {
    console.error('[AdminMessaging] Error loading messages:', error);
  }
}

export async function sendMessage(ctx: AdminDashboardContext): Promise<void> {
  const input = getElement('admin-message-text') as HTMLInputElement;
  if (!input || !input.value.trim() || !selectedThreadId) return;

  const message = input.value.trim();
  input.value = '';
  input.disabled = true;

  try {
    const response = await apiPost(`/api/messages/threads/${selectedThreadId}/messages`, { message });

    if (response.ok) {
      // Use cache busting to ensure we get the latest messages after sending
      loadThreadMessages(selectedThreadId, ctx, true);
      loadClientThreads(ctx);
    } else {
      ctx.showNotification('Failed to send message', 'error');
    }
  } catch (error) {
    console.error('[AdminMessaging] Error sending message:', error);
    ctx.showNotification('Error sending message', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

export function setupMessagingListeners(ctx: AdminDashboardContext): void {
  // Send button
  const sendBtn = getElement('admin-send-message');
  if (sendBtn) {
    // Add ARIA label for accessibility
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.addEventListener('click', () => sendMessage(ctx));
  }

  // Enter key to send
  const input = getElement('admin-message-text') as HTMLInputElement;
  if (input) {
    // Add ARIA attributes for accessibility
    input.setAttribute('aria-label', 'Type your message');
    input.setAttribute('aria-describedby', 'message-hint');

    // Add hidden hint for screen readers
    if (!getElement('message-hint')) {
      const hint = document.createElement('span');
      hint.id = 'message-hint';
      hint.className = 'sr-only';
      hint.textContent = 'Press Enter to send, Shift+Enter for new line';
      hint.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;';
      input.parentElement?.appendChild(hint);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(ctx);
      }
    });
  }

  // Global search input (searches both clients and messages)
  const searchInput = getElement('messages-search-input') as HTMLInputElement;
  if (searchInput) {
    let searchDebounce: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        handleGlobalSearch(searchInput.value.trim(), ctx);
      }, 300);
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        handleGlobalSearch('', ctx);
      }
    });
  }
}

/**
 * Handle global search across clients and messages
 */
function handleGlobalSearch(query: string, ctx: AdminDashboardContext): void {
  const threadList = getElement('admin-thread-list');
  const messagesThread = getMessagesContainer();

  if (!query) {
    // No search query - restore original state
    if (threadList) {
      renderThreadList(threadList, _cachedClientsWithThreads, ctx);
    }
    // Clear message highlights
    if (messagesThread) {
      messagesThread.querySelectorAll('mark').forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
    }
    return;
  }

  const lowerQuery = query.toLowerCase();

  // Filter clients by name, company, or email
  const filteredClients = _cachedClientsWithThreads.filter((client) => {
    const name = (client.contact_name || '').toLowerCase();
    const company = (client.company_name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    return name.includes(lowerQuery) || company.includes(lowerQuery) || email.includes(lowerQuery);
  });

  // Re-render filtered client list
  if (threadList) {
    renderThreadList(threadList, filteredClients, ctx);
  }

  // Highlight matching text in messages
  if (messagesThread) {
    highlightMessagesSearch(messagesThread, query);
  }
}

/**
 * Highlight search matches in messages thread
 */
function highlightMessagesSearch(container: HTMLElement, query: string): void {
  // First remove existing highlights
  container.querySelectorAll('mark').forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });

  if (!query) return;

  // Find and highlight matches in message bodies
  container.querySelectorAll('.message-body').forEach((body) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    const lowerQuery = query.toLowerCase();
    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(lowerQuery);

      if (index !== -1) {
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const mark = document.createElement('mark');
        mark.textContent = match;
        fragment.appendChild(mark);

        if (after) fragment.appendChild(document.createTextNode(after));

        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });
  });
}
