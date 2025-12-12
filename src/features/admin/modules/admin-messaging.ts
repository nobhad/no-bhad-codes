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

export function getSelectedThreadId(): number | null {
  return selectedThreadId;
}

export async function loadClientThreads(ctx: AdminDashboardContext): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token) return;

  const clientSelect = document.getElementById('admin-client-select') as HTMLSelectElement;
  if (!clientSelect) return;

  try {
    const response = await fetch('/api/messages/threads', {
      headers: { Authorization: `Bearer ${token}` }
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
  const clientSelect = document.getElementById('admin-client-select') as HTMLSelectElement;
  if (!clientSelect) return;

  clientSelect.innerHTML = '<option value="">-- Select a client --</option>';

  if (threads.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No conversations yet';
    option.disabled = true;
    clientSelect.appendChild(option);
    return;
  }

  threads.forEach((thread: any) => {
    const option = document.createElement('option');
    option.value = `${thread.client_id}:${thread.id}`;
    const clientName =
      thread.contact_name || thread.company_name || thread.client_name || 'Unknown Client';
    const unreadText = thread.unread_count > 0 ? ` (${thread.unread_count} unread)` : '';
    option.textContent = `${clientName} - ${thread.subject || 'No subject'}${unreadText}`;
    clientSelect.appendChild(option);
  });

  // Add change handler
  clientSelect.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value) {
      const [clientId, threadId] = value.split(':').map(Number);
      selectThread(clientId, threadId, ctx);
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

  const composeArea = document.getElementById('admin-compose-area');
  if (composeArea) {
    composeArea.style.display = 'block';
  }

  const messageInput = document.getElementById('admin-message-input');
  if (messageInput) {
    messageInput.style.display = 'block';
  }

  loadThreadMessages(threadId, ctx);
}

export async function loadThreadMessages(
  threadId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token) return;

  const container =
    document.getElementById('admin-messages-thread') ||
    document.getElementById('admin-messages-container');
  if (!container) return;

  container.innerHTML =
    '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';

  try {
    const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      renderMessages(data.messages || [], container);

      // Mark messages as read
      await fetch(`/api/messages/threads/${threadId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
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
      const rawSenderName = isAdmin ? 'You (Admin)' : msg.sender_name || 'Client';
      const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
      const safeContent = SanitizationUtils.escapeHtml(msg.message || msg.content || '');
      const safeInitials = SanitizationUtils.escapeHtml(
        rawSenderName.substring(0, 2).toUpperCase()
      );

      if (isAdmin) {
        return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${date} at ${time}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
            <div class="message-avatar" data-name="Admin">
              <div class="avatar-placeholder">ADM</div>
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

  const token = ctx.getAuthToken();
  if (!token) return;

  const message = input.value.trim();
  input.value = '';
  input.disabled = true;

  try {
    const response = await fetch(`/api/messages/threads/${selectedThreadId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
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
    sendBtn.addEventListener('click', () => sendMessage(ctx));
  }

  // Enter key to send
  const input = document.getElementById('admin-message-text') as HTMLInputElement;
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(ctx);
      }
    });
  }
}
