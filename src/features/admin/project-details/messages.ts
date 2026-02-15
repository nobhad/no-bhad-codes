/**
 * Project Messages Module
 * @file src/features/admin/project-details/messages.ts
 *
 * Handles loading and sending messages for project detail view.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDateTime } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost } from '../../../utils/api-client';
import { alertError, alertWarning } from '../../../utils/confirm-dialog';
import { renderEmptyState } from '../../../components/empty-state';
import { domCache } from './dom-cache';
import type { ProjectResponse, MessageResponse, MessageThreadResponse } from '../../../types/api';

/** Current thread ID for the active project */
let currentThreadId: number | null = null;

/**
 * Load messages for the specified project using thread-based messaging system
 */
export async function loadProjectMessages(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const messagesThread = domCache.get('messagesThread');
  if (!messagesThread) return;

  if (!AdminAuth.isAuthenticated()) {
    renderEmptyState(messagesThread, 'Authentication required to view messages.');
    return;
  }

  try {
    // Get the client ID for this project
    const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
    if (!project || !project.client_id) {
      renderEmptyState(messagesThread, 'No client account linked. Invite the client first to enable messaging.');
      return;
    }

    // Get all threads and find one for this project/client
    const threadsResponse = await apiFetch('/api/messages/threads');

    if (!threadsResponse.ok) {
      renderEmptyState(messagesThread, 'Error loading messages.');
      return;
    }

    const threadsData = await threadsResponse.json() as { threads?: MessageThreadResponse[] };
    const threads: MessageThreadResponse[] = threadsData.threads || [];

    // Find thread for this project or client
    let thread = threads.find((t: MessageThreadResponse) => t.project_id === projectId);
    if (!thread && project.client_id) {
      thread = threads.find((t: MessageThreadResponse) => t.client_id === project.client_id);
    }

    if (!thread) {
      currentThreadId = null;
      renderEmptyState(messagesThread, 'No messages yet. Start the conversation with your client.');
      return;
    }

    currentThreadId = thread.id;

    // Get messages in this thread
    const messagesResponse = await apiFetch(`/api/messages/threads/${thread.id}/messages`);

    if (!messagesResponse.ok) {
      renderEmptyState(messagesThread, 'Error loading messages.');
      return;
    }

    const messagesData = await messagesResponse.json() as { messages?: MessageResponse[] };
    const messages: MessageResponse[] = messagesData.messages || [];

    if (messages.length === 0) {
      renderEmptyState(messagesThread, 'No messages yet. Start the conversation with your client.');
    } else {
      messagesThread.innerHTML = messages
        .map((msg: MessageResponse) => {
          // Sanitize user data to prevent XSS
          const safeSenderName = SanitizationUtils.escapeHtml(
            msg.sender_type === 'admin' ? 'You' : (msg.sender_name || project.contact_name || 'Client')
          );
          const safeContent = SanitizationUtils.escapeHtml(msg.message || '');
          return `
            <div class="message ${msg.sender_type === 'admin' ? 'message-sent' : 'message-received'}">
              <div class="message-content">
                <div class="message-header">
                  <span class="message-sender">${safeSenderName}</span>
                  <span class="message-time">${formatDateTime(msg.created_at)}</span>
                </div>
                <div class="message-body">${safeContent}</div>
              </div>
            </div>
          `;
        })
        .join('');
      // Scroll to bottom
      messagesThread.scrollTop = messagesThread.scrollHeight;
    }
  } catch (error) {
    console.error('[ProjectMessages] Error loading project messages:', error);
    renderEmptyState(messagesThread, 'Error loading messages.');
  }
}

/**
 * Send a message for the specified project using thread-based messaging
 */
export async function sendProjectMessage(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<boolean> {
  const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
  if (!messageInput || !messageInput.value.trim()) return false;

  if (!AdminAuth.isAuthenticated()) return false;

  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project || !project.client_id) {
    alertWarning('No client account linked. Invite the client first.');
    return false;
  }

  try {
    // If no existing thread, create one
    if (!currentThreadId) {
      const createResponse = await apiPost('/api/messages/threads', {
        client_id: project.client_id,
        project_id: projectId,
        subject: `Project: ${project.project_name || 'Untitled'}`,
        thread_type: 'project',
        message: messageInput.value.trim()
      });

      if (createResponse.ok) {
        const data = await createResponse.json();
        currentThreadId = data.thread?.id || data.threadId;
        messageInput.value = '';
        return true;
      }
      alertError('Failed to create message thread');
      return false;

    }

    // Send message to existing thread
    const response = await apiPost(`/api/messages/threads/${currentThreadId}/messages`, {
      message: messageInput.value.trim()
    });

    if (response.ok) {
      messageInput.value = '';
      return true;
    }
    alertError('Failed to send message');
    return false;

  } catch (error) {
    console.error('[ProjectMessages] Error sending message:', error);
    alertError('Error sending message');
    return false;
  }
}

/**
 * Get current thread ID
 */
export function getCurrentThreadId(): number | null {
  return currentThreadId;
}

/**
 * Reset current thread ID (when switching projects)
 */
export function resetThreadId(): void {
  currentThreadId = null;
}
