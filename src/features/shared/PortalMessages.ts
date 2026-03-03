/**
 * ===============================================
 * PORTAL MESSAGES MODULE
 * ===============================================
 * @file src/features/shared/PortalMessages.ts
 *
 * Role-adaptive messages module for both admin and client portals.
 * Admin can see all client threads and manage conversations.
 * Client sees only their own threads.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, apiPost } from '../../utils/api-client';
import { formatTimeAgo } from '../../utils/time-utils';
import type { DataItem } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalMessages');

// ============================================
// TYPES
// ============================================

interface MessageThread extends DataItem {
  id: number;
  clientId: number;
  clientName: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'closed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface Message extends DataItem {
  id: number;
  threadId: number;
  senderId: number;
  senderType: 'admin' | 'client';
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================
// UNIFIED MESSAGING MODULE
// ============================================

/**
 * Portal Messaging Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: sees all threads, can manage, assign, close
 * - Client: sees own threads only, can send messages
 */
export default class PortalMessages extends PortalFeatureModule {
  /** Message threads */
  private threads: MessageThread[] = [];

  /** Currently selected thread */
  private selectedThreadId: number | null = null;

  /** Messages in selected thread */
  private messages: Message[] = [];

  constructor() {
    super('PortalMessages');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadThreads();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.threads = [];
    this.messages = [];
    this.selectedThreadId = null;
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    // Admin sees all threads, client sees only their own
    return this.capabilities.canViewAll
      ? '/api/admin/messages/threads'
      : '/api/messages/threads';
  }

  private getMessagesEndpoint(threadId: number): string {
    return this.capabilities.canViewAll
      ? `/api/admin/messages/threads/${threadId}/messages`
      : `/api/messages/threads/${threadId}/messages`;
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadThreads(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const data = await response.json();
      this.threads = data.data || data || [];
    } catch (error) {
      this.notify('Failed to load message threads', 'error');
      logger.error('Error loading threads:', error);
    }
  }

  private async loadMessages(threadId: number): Promise<void> {
    try {
      const response = await apiFetch(this.getMessagesEndpoint(threadId));
      const data = await response.json();
      this.messages = data.data || data || [];
      this.renderMessages();
    } catch (error) {
      this.notify('Failed to load messages', 'error');
      logger.error('Error loading messages:', error);
    }
  }

  // ============================================
  // VIEW RENDERING - Role-adaptive
  // ============================================

  protected renderView(): void {
    if (!this.container) return;

    // Admin gets thread list sidebar + message view
    // Client gets simplified view (possibly just their thread)
    const layout = this.isAdmin
      ? this.renderAdminLayout()
      : this.renderClientLayout();

    this.container.innerHTML = layout;
  }

  private renderAdminLayout(): string {
    return `
      <div class="messages-layout admin-messages">
        <div class="messages-sidebar">
          <div class="messages-sidebar-header">
            <h3>Conversations</h3>
            ${this.capabilities.canCreate ? `
              <button class="btn btn-sm btn-primary" data-action="new-thread">
                New
              </button>
            ` : ''}
          </div>
          <div class="thread-list" id="thread-list">
            ${this.renderThreadList()}
          </div>
        </div>
        <div class="messages-main">
          <div class="messages-thread-header" id="thread-header">
            <span class="thread-title">Select a conversation</span>
          </div>
          <div class="messages-thread" id="messages-thread">
            <div class="empty-state">
              <p>Select a conversation to view messages</p>
            </div>
          </div>
          <div class="messages-compose" id="messages-compose" style="display: none;">
            ${this.renderComposeArea()}
          </div>
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    // Client sees a simpler view
    // If they have threads, show the most recent or let them pick
    // If no threads, show a "Start a conversation" prompt
    return `
      <div class="messages-layout client-messages">
        ${this.threads.length > 0 ? `
          <div class="messages-sidebar">
            <div class="messages-sidebar-header">
              <h3>Your Messages</h3>
            </div>
            <div class="thread-list" id="thread-list">
              ${this.renderThreadList()}
            </div>
          </div>
        ` : ''}
        <div class="messages-main">
          <div class="messages-thread-header" id="thread-header">
            ${this.threads.length > 0
    ? '<span class="thread-title">Select a conversation</span>'
    : '<span class="thread-title">Start a Conversation</span>'
}
          </div>
          <div class="messages-thread" id="messages-thread">
            ${this.threads.length > 0 ? `
              <div class="empty-state">
                <p>Select a conversation to view messages</p>
              </div>
            ` : `
              <div class="empty-state">
                <p>Need help with your project? Start a conversation with us.</p>
                <button class="btn btn-primary" data-action="new-thread">
                  Start Conversation
                </button>
              </div>
            `}
          </div>
          <div class="messages-compose" id="messages-compose" style="display: none;">
            ${this.renderComposeArea()}
          </div>
        </div>
      </div>
    `;
  }

  private renderThreadList(): string {
    if (this.threads.length === 0) {
      return '<div class="empty-state"><p>No conversations yet</p></div>';
    }

    return this.threads
      .map((thread) => `
        <div
          class="thread-item ${thread.id === this.selectedThreadId ? 'active' : ''}"
          data-thread-id="${thread.id}"
        >
          <div class="thread-item-header">
            <span class="thread-client">${this.escapeHtml(thread.clientName)}</span>
            ${thread.unreadCount > 0 ? `
              <span class="badge badge-primary">${thread.unreadCount}</span>
            ` : ''}
          </div>
          <div class="thread-preview">${this.escapeHtml(thread.lastMessage)}</div>
          <div class="thread-meta">
            <span class="thread-time">${this.formatRelativeTime(thread.lastMessageAt)}</span>
            ${thread.status !== 'open' ? `
              <span class="thread-status status-${thread.status}">${thread.status}</span>
            ` : ''}
          </div>
        </div>
      `)
      .join('');
  }

  private renderMessages(): void {
    const container = document.getElementById('messages-thread');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No messages in this thread yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.messages
      .map((msg) => `
        <div class="message ${msg.senderType === 'admin' ? 'message-admin' : 'message-client'}">
          <div class="message-header">
            <span class="message-sender">${this.escapeHtml(msg.senderName)}</span>
            <span class="message-time">${this.formatRelativeTime(msg.createdAt)}</span>
          </div>
          <div class="message-content">${this.escapeHtml(msg.content)}</div>
        </div>
      `)
      .join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  private renderComposeArea(): string {
    return `
      <div class="compose-wrapper">
        <textarea
          id="message-input"
          class="form-input"
          placeholder="Type your message..."
          rows="3"
        ></textarea>
        <button class="btn btn-primary" id="send-message">
          Send
        </button>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    // Thread selection
    this.container.addEventListener('click', (e) => {
      const threadItem = (e.target as HTMLElement).closest('.thread-item');
      if (threadItem) {
        const threadId = Number((threadItem as HTMLElement).dataset.threadId);
        this.selectThread(threadId);
        return;
      }

      // New thread button
      const newThreadBtn = (e.target as HTMLElement).closest('[data-action="new-thread"]');
      if (newThreadBtn) {
        this.handleNewThread();
        return;
      }

      // Send message button
      const sendBtn = (e.target as HTMLElement).closest('#send-message');
      if (sendBtn) {
        this.handleSendMessage();

      }
    });

    // Enter key in compose area
    const textarea = this.container.querySelector('#message-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
          keyEvent.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  }

  private async selectThread(threadId: number): Promise<void> {
    this.selectedThreadId = threadId;

    // Update thread list UI
    const threadList = document.getElementById('thread-list');
    if (threadList) {
      threadList.querySelectorAll('.thread-item').forEach((item) => {
        item.classList.toggle(
          'active',
          Number((item as HTMLElement).dataset.threadId) === threadId
        );
      });
    }

    // Update header
    const thread = this.threads.find((t) => t.id === threadId);
    const header = document.getElementById('thread-header');
    if (header && thread) {
      header.innerHTML = `
        <span class="thread-title">${this.escapeHtml(thread.clientName)}</span>
        ${this.isAdmin ? `
          <div class="thread-actions">
            <button class="btn btn-sm btn-secondary" data-action="close-thread">
              Close
            </button>
          </div>
        ` : ''}
      `;
    }

    // Show compose area
    const compose = document.getElementById('messages-compose');
    if (compose) {
      compose.style.display = 'flex';
    }

    // Load messages
    await this.loadMessages(threadId);
  }

  private handleNewThread(): void {
    // Feature deferred: Requires backend thread creation endpoint
    // See docs/current_work.md for tracking
    this.notify('New thread creation coming soon', 'info');
  }

  private async handleSendMessage(): Promise<void> {
    if (!this.selectedThreadId) return;

    const textarea = document.getElementById('message-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) return;

    try {
      await apiPost(
        `${this.getMessagesEndpoint(this.selectedThreadId)}`,
        { content }
      );

      // Clear input
      textarea.value = '';

      // Reload messages
      await this.loadMessages(this.selectedThreadId);

      this.notify('Message sent', 'success');
    } catch (error) {
      this.notify('Failed to send message', 'error');
      logger.error('Error sending message:', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatRelativeTime(dateString: string): string {
    return formatTimeAgo(dateString);
  }
}
