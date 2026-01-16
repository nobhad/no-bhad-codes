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
import type { Message, AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';

let selectedClientId: number | null = null;
let selectedThreadId: number | null = null;
let selectedClientName: string = 'Client';

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
  const dropdown = document.getElementById('admin-client-dropdown');
  if (!dropdown) return;

  // Add ARIA label for accessibility
  dropdown.setAttribute('aria-label', 'Select a client conversation');

  try {
    // Fetch both clients and threads in parallel
    const [clientsResponse, threadsResponse] = await Promise.all([
      fetch('/api/clients', { credentials: 'include' }),
      fetch('/api/messages/threads', { credentials: 'include' })
    ]);

    const clientsData = clientsResponse.ok ? await clientsResponse.json() : { clients: [] };
    const threadsData = threadsResponse.ok ? await threadsResponse.json() : { threads: [] };

    // Create a map of client_id -> thread info
    const threadMap = new Map<number, any>();
    (threadsData.threads || []).forEach((thread: any) => {
      // Keep the thread with the most messages if client has multiple threads
      const existing = threadMap.get(thread.client_id);
      if (!existing || (thread.message_count || 0) > (existing.message_count || 0)) {
        threadMap.set(thread.client_id, thread);
      }
    });

    // Merge clients with their thread data
    const clientsWithThreads: ClientWithThread[] = (clientsData.clients || []).map((client: any) => {
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
  const dropdown = document.getElementById('admin-client-dropdown');
  const menu = document.getElementById('admin-client-menu');
  const trigger = document.getElementById('admin-client-trigger');
  const hiddenInput = document.getElementById('admin-client-select') as HTMLInputElement;

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

    // Create count span (right-aligned) - show message count if any
    if (client.message_count > 0) {
      const countSpan = document.createElement('span');
      countSpan.className = 'dropdown-item-count';
      countSpan.textContent = String(client.message_count);
      // Add unread indicator if there are unread messages
      if (client.unread_count > 0) {
        countSpan.classList.add('has-unread');
        countSpan.title = `${client.unread_count} unread`;
      }
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
  const textarea = document.getElementById('admin-message-text') as HTMLTextAreaElement;
  const sendButton = document.getElementById('admin-send-message') as HTMLButtonElement;
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
  _ctx: AdminDashboardContext
): Promise<void> {
  const container =
    document.getElementById('admin-messages-thread') ||
    document.getElementById('admin-messages-container');
  if (!container) return;

  // Add ARIA attributes for accessibility - live region for screen readers
  container.setAttribute('role', 'log');
  container.setAttribute('aria-label', 'Message conversation');
  container.setAttribute('aria-live', 'polite');

  container.innerHTML =
    '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

  try {
    const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);

    if (response.ok) {
      const data = await response.json();
      renderMessages(data.messages || [], container);

      // Mark messages as read
      await apiPut(`/api/messages/threads/${threadId}/read`);
    } else {
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: #666;">Failed to load messages</div>';
    }
  } catch (error) {
    console.error('[AdminMessaging] Failed to load messages:', error);
    container.innerHTML =
      '<div style="text-align: center; padding: 2rem; color: #666;">Error loading messages</div>';
  }
}

function renderMessages(messages: Message[], container: HTMLElement): void {
  if (messages.length === 0) {
    container.innerHTML =
      '<div style="text-align: center; padding: 2rem; color: #666;">No messages yet. Start the conversation!</div>';
    return;
  }

  container.innerHTML = messages
    .map((msg: any) => {
      const isAdmin = msg.sender_type === 'admin';
      const time = new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const date = new Date(msg.created_at).toLocaleDateString();
      const rawSenderName = isAdmin ? 'You (Admin)' : selectedClientName || 'Client';
      const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
      const safeContent = SanitizationUtils.escapeHtml(msg.message || msg.content || '');
      const initials = rawSenderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const safeInitials = SanitizationUtils.escapeHtml(initials);

      if (isAdmin) {
        return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-time">${date} at ${time}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
            <div class="message-avatar" data-name="Admin">
              <div class="avatar-placeholder">ADM</div>
              <span class="message-sender">${safeSenderName}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="message message-received">
          <div class="message-avatar" data-name="${safeSenderName}">
            <div class="avatar-placeholder">${safeInitials}</div>
            <span class="message-sender">${safeSenderName}</span>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-time">${date} at ${time}</span>
            </div>
            <div class="message-body">${safeContent}</div>
          </div>
        </div>
      `;
    })
    .join('');

  container.scrollTop = container.scrollHeight;
}

export async function sendMessage(ctx: AdminDashboardContext): Promise<void> {
  const input = document.getElementById('admin-message-text') as HTMLInputElement;
  if (!input || !input.value.trim() || !selectedThreadId) return;

  const message = input.value.trim();
  input.value = '';
  input.disabled = true;

  try {
    const response = await apiPost(`/api/messages/threads/${selectedThreadId}/messages`, { message });

    if (response.ok) {
      loadThreadMessages(selectedThreadId, ctx);
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
  const sendBtn = document.getElementById('admin-send-message');
  if (sendBtn) {
    // Add ARIA label for accessibility
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.addEventListener('click', () => sendMessage(ctx));
  }

  // Enter key to send
  const input = document.getElementById('admin-message-text') as HTMLInputElement;
  if (input) {
    // Add ARIA attributes for accessibility
    input.setAttribute('aria-label', 'Type your message');
    input.setAttribute('aria-describedby', 'message-hint');

    // Add hidden hint for screen readers
    if (!document.getElementById('message-hint')) {
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
