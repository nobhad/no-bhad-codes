/**
 * ===============================================
 * ADMIN MESSAGING MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-messaging.ts
 *
 * Client messaging functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

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
}

export async function loadClientThreads(ctx: AdminDashboardContext): Promise<void> {
  const dropdown = getElement('admin-client-dropdown');
  if (!dropdown) return;

  // Add ARIA label for accessibility
  dropdown.setAttribute('aria-label', 'Select a client conversation');

  try {
    // Fetch both clients and threads in parallel
    const [clientsResponse, threadsResponse] = await Promise.all([
      fetch('/api/clients', { credentials: 'include' }),
      fetch('/api/messages/threads', { credentials: 'include' })
    ]);

    const clientsData = clientsResponse.ok ? (await clientsResponse.json() as { clients?: ClientResponse[] }) : { clients: [] };
    const threadsData = threadsResponse.ok ? (await threadsResponse.json() as { threads?: (MessageThreadResponse & { message_count?: number })[] }) : { threads: [] };

    // Create a map of client_id -> thread info
    const threadMap = new Map<number, MessageThreadResponse & { message_count?: number }>();
    (threadsData.threads || []).forEach((thread: MessageThreadResponse & { message_count?: number }) => {
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
        unread_count: thread?.unread_count || 0
      };
    });

    // Sort: clients with unread messages first, then by message count, then alphabetically
    clientsWithThreads.sort((a, b) => {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
      if (a.message_count !== b.message_count) return b.message_count - a.message_count;
      const nameA = a.contact_name || a.company_name || '';
      const nameB = b.contact_name || b.company_name || '';
      return nameA.localeCompare(nameB);
    });

    populateClientDropdown(clientsWithThreads, ctx);
  } catch (error) {
    console.error('[AdminMessaging] Failed to load clients/threads:', error);
  }
}

function populateClientDropdown(clients: ClientWithThread[], ctx: AdminDashboardContext): void {
  const dropdown = getElement('admin-client-dropdown');
  const menu = getElement('admin-client-menu');
  const trigger = getElement('admin-client-trigger');
  const hiddenInput = getElement('admin-client-select') as HTMLInputElement;

  if (!dropdown || !menu || !trigger || !hiddenInput) return;

  // Clear existing items
  menu.innerHTML = '';

  if (clients.length === 0) {
    const item = document.createElement('li');
    item.className = 'custom-dropdown-item';
    item.dataset.value = '';
    item.textContent = 'No clients yet';
    item.style.opacity = '0.5';
    item.style.cursor = 'not-allowed';
    menu.appendChild(item);
    return;
  }

  clients.forEach((client: ClientWithThread) => {
    const item = document.createElement('li');
    item.className = 'custom-dropdown-item';
    // Use 'new' for thread_id if client doesn't have a thread yet
    const threadIdValue = client.thread_id !== null ? client.thread_id : 'new';
    item.dataset.value = `${client.client_id}:${threadIdValue}`;
    const clientName = client.contact_name || client.company_name || 'Unknown Client';

    // Create name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'dropdown-item-name';
    nameSpan.textContent = clientName;
    item.appendChild(nameSpan);

    // Create count span (right-aligned) - only show unread message count from clients
    if (client.unread_count > 0) {
      const countSpan = document.createElement('span');
      countSpan.className = 'dropdown-item-count has-unread';
      countSpan.textContent = String(client.unread_count);
      countSpan.title = `${client.unread_count} unread`;
      item.appendChild(countSpan);
    }

    menu.appendChild(item);
  });

  // Setup dropdown behavior
  setupCustomDropdown(dropdown, trigger, menu, hiddenInput, ctx);
}

function setupCustomDropdown(
  dropdown: HTMLElement,
  trigger: HTMLElement,
  menu: HTMLElement,
  hiddenInput: HTMLInputElement,
  ctx: AdminDashboardContext
): void {
  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Handle item selection
  menu.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.custom-dropdown-item') as HTMLElement;
    if (item) {
      const value = item.dataset.value || '';
      const textSpan = trigger.querySelector('.custom-dropdown-text');

      // Update display text - get just the name, not the count
      const nameSpan = item.querySelector('.dropdown-item-name');
      const clientName = nameSpan?.textContent || item.textContent || 'Client';
      if (textSpan) {
        textSpan.textContent = clientName;
      }
      // Store the client name for use in messages
      selectedClientName = clientName;

      // Update hidden input
      hiddenInput.value = value;

      // Update selected state
      menu.querySelectorAll('.custom-dropdown-item').forEach(i => {
        i.classList.remove('selected');
      });
      item.classList.add('selected');

      // Close dropdown
      dropdown.classList.remove('open');

      // Trigger selection if value is not empty
      if (value) {
        const [clientIdStr, threadIdStr] = value.split(':');
        const clientId = Number(clientIdStr);

        // Check if we need to create a new thread
        if (threadIdStr === 'new') {
          // Create a new thread for this client
          try {
            const response = await apiPost('/api/messages/threads', {
              client_id: clientId,
              subject: `Conversation with ${clientName}`,
              thread_type: 'general'
            });

            if (response.ok) {
              const data = await response.json();
              const newThreadId = data.thread.id;
              // Update the item's value with the real thread ID
              item.dataset.value = `${clientId}:${newThreadId}`;
              hiddenInput.value = `${clientId}:${newThreadId}`;
              selectThread(clientId, newThreadId, ctx);
            } else {
              ctx.showNotification('Failed to start conversation', 'error');
            }
          } catch (error) {
            console.error('[AdminMessaging] Failed to create thread:', error);
            ctx.showNotification('Error starting conversation', 'error');
          }
        } else {
          const threadId = Number(threadIdStr);
          selectThread(clientId, threadId, ctx);
        }
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.classList.remove('open');
    }
  });

  // Keyboard navigation
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropdown.classList.toggle('open');
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
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
      const rawSenderName = isAdmin ? 'You (Admin)' : SanitizationUtils.decodeHtmlEntities(selectedClientName || 'Client');
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

      // Action buttons (pin/unpin)
      const actionsHtml = `
        <div class="message-actions">
          <button class="pin-message-btn ${isPinned ? 'pinned' : ''}" data-message-id="${msg.id}" title="${isPinned ? 'Unpin' : 'Pin'} message">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M12 2L12 12M12 22L12 12M12 12L20 4M12 12L4 4"/>
            </svg>
          </button>
        </div>
      `;

      if (isAdmin) {
        return `
          <div class="message message-sent ${isPinned ? 'pinned' : ''}" data-message-id="${msg.id}">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">You (Admin)</span>
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
      <button class="add-reaction-btn" data-message-id="${messageId}" title="Add reaction">+</button>
      <div class="reaction-picker hidden" data-message-id="${messageId}">
        ${REACTIONS.map(r => `<button data-reaction="${r}">${r}</button>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Setup interactions for messages (reactions, pins)
 */
function setupMessageInteractions(container: HTMLElement): void {
  // Add reaction button clicks
  container.querySelectorAll('.add-reaction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = (btn as HTMLElement).dataset.messageId;
      const picker = container.querySelector(`.reaction-picker[data-message-id="${messageId}"]`);
      if (picker) {
        picker.classList.toggle('hidden');
      }
    });
  });

  // Reaction picker button clicks
  container.querySelectorAll('.reaction-picker button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const picker = (btn as HTMLElement).closest('.reaction-picker') as HTMLElement;
      const messageId = picker?.dataset.messageId;
      const reaction = (btn as HTMLElement).dataset.reaction;
      if (messageId && reaction) {
        await addReaction(parseInt(messageId, 10), reaction);
        picker?.classList.add('hidden');
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
  document.addEventListener('click', () => {
    container.querySelectorAll('.reaction-picker').forEach(picker => {
      picker.classList.add('hidden');
    });
  });
}

/**
 * Add a reaction to a message
 */
async function addReaction(messageId: number, reaction: string): Promise<void> {
  try {
    await apiPost(`/api/messages/${messageId}/reactions`, { reaction });
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
      await apiDelete(`/api/messages/threads/${selectedThreadId}/messages/${messageId}/pin`);
    } else {
      await apiPost(`/api/messages/threads/${selectedThreadId}/messages/${messageId}/pin`, {});
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
}
