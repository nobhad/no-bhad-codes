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
import type { MessageThread, Message, AdminDashboardContext } from '../admin-types';

let selectedClientId: number | null = null;
let selectedThreadId: number | null = null;
let selectedClientName: string = 'Client';

export function getSelectedThreadId(): number | null {
  return selectedThreadId;
}

export function getSelectedClientId(): number | null {
  return selectedClientId;
}

export async function loadClientThreads(ctx: AdminDashboardContext): Promise<void> {
  if (ctx.isDemo()) return;

  const dropdown = document.getElementById('admin-client-dropdown');
  if (!dropdown) return;

  // Add ARIA label for accessibility
  dropdown.setAttribute('aria-label', 'Select a client conversation');

  try {
    const response = await fetch('/api/messages/threads', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      populateClientDropdown(data.threads || [], ctx);
    }
  } catch (error) {
    console.error('[AdminMessaging] Failed to load threads:', error);
  }
}

function populateClientDropdown(threads: MessageThread[], ctx: AdminDashboardContext): void {
  const dropdown = document.getElementById('admin-client-dropdown');
  const menu = document.getElementById('admin-client-menu');
  const trigger = document.getElementById('admin-client-trigger');
  const hiddenInput = document.getElementById('admin-client-select') as HTMLInputElement;

  if (!dropdown || !menu || !trigger || !hiddenInput) return;

  // Clear existing items
  menu.innerHTML = '';

  if (threads.length === 0) {
    const item = document.createElement('li');
    item.className = 'custom-dropdown-item';
    item.dataset.value = '';
    item.textContent = 'No conversations yet';
    item.style.opacity = '0.5';
    item.style.cursor = 'not-allowed';
    menu.appendChild(item);
    return;
  }

  threads.forEach((thread: any) => {
    const item = document.createElement('li');
    item.className = 'custom-dropdown-item';
    item.dataset.value = `${thread.client_id}:${thread.id}`;
    const clientName =
      thread.contact_name || thread.company_name || thread.client_name || 'Unknown Client';
    const messageCount = thread.message_count || thread.total_messages || 0;

    // Create name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'dropdown-item-name';
    nameSpan.textContent = clientName;
    item.appendChild(nameSpan);

    // Create count span (right-aligned)
    if (messageCount > 0) {
      const countSpan = document.createElement('span');
      countSpan.className = 'dropdown-item-count';
      countSpan.textContent = String(messageCount);
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
  menu.addEventListener('click', (e) => {
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
        const [clientId, threadId] = value.split(':').map(Number);
        selectThread(clientId, threadId, ctx);
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
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

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
    const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      renderMessages(data.messages || [], container);

      // Mark messages as read
      await fetch(`/api/messages/threads/${threadId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });
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

  if (ctx.isDemo()) return;

  const message = input.value.trim();
  input.value = '';
  input.disabled = true;

  try {
    const response = await fetch(`/api/messages/threads/${selectedThreadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message })
    });

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
