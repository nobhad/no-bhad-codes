/**
 * ===============================================
 * MESSAGING MODULE
 * ===============================================
 * @file src/modules/messaging.ts
 *
 * Handles client messaging functionality including thread management,
 * message sending, real-time notifications, and message history.
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { SanitizationUtils } from '../utils/sanitization-utils';

export interface MessageThread {
  id: number;
  subject: string;
  thread_type: 'general' | 'project' | 'support' | 'quote';
  status: 'active' | 'closed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  last_message_at: string;
  last_message_by: string;
  message_count: number;
  unread_count: number;
  project_name?: string;
}

export interface Message {
  id: number;
  sender_type: 'client' | 'admin' | 'system';
  sender_name: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reply_to?: number;
  attachments: Array<{
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
  }>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export class MessagingModule extends BaseModule {
  private currentThreadId: number | null = null;
  private currentMessages: Message[] = [];
  private messageThreads: MessageThread[] = [];
  private unreadCount = 0;
  private isTyping = false;
  private typingTimeout: NodeJS.Timeout | null = null;

  // Configuration
  private config = {
    threadsContainerId: 'message-threads',
    messagesContainerId: 'messages-container',
    messageFormId: 'message-form',
    threadFormId: 'new-thread-form',
    unreadBadgeId: 'unread-badge'
  };

  // DOM elements
  private threadsContainer: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private messageForm: HTMLFormElement | null = null;
  private threadForm: HTMLFormElement | null = null;
  private unreadBadge: HTMLElement | null = null;
  private typingIndicator: HTMLElement | null = null;

  constructor() {
    super('messaging');
  }

  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupEventListeners();
    await this.loadMessageThreads();
    this.setupRealTimeUpdates();
  }

  protected override async onDestroy(): Promise<void> {
    this.clearTimers();
    this.removeEventListeners();
  }

  private cacheElements(): void {
    this.threadsContainer = this.getElement(
      'Threads container',
      `#${this.config.threadsContainerId}`,
      false
    ) as HTMLElement | null;
    this.messagesContainer = this.getElement(
      'Messages container',
      `#${this.config.messagesContainerId}`,
      false
    ) as HTMLElement | null;
    this.messageForm = this.getElement(
      'Message form',
      `#${this.config.messageFormId}`,
      false
    ) as HTMLFormElement | null;
    this.threadForm = this.getElement(
      'Thread form',
      `#${this.config.threadFormId}`,
      false
    ) as HTMLFormElement | null;
    this.unreadBadge = this.getElement(
      'Unread badge',
      `#${this.config.unreadBadgeId}`,
      false
    ) as HTMLElement | null;
    this.typingIndicator = this.getElement(
      'Typing indicator',
      '#typing-indicator',
      false
    ) as HTMLElement | null;
  }

  private setupEventListeners(): void {
    // Message form submission
    if (this.messageForm) {
      this.messageForm.addEventListener('submit', this.handleSendMessage.bind(this));

      // Typing indicator
      const messageInput = this.messageForm.querySelector(
        'textarea[name="message"]'
      ) as HTMLTextAreaElement;
      if (messageInput) {
        messageInput.addEventListener('input', this.handleTyping.bind(this));
        messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));
      }
    }

    // New thread form
    if (this.threadForm) {
      this.threadForm.addEventListener('submit', this.handleNewThread.bind(this));
    }

    // Mark messages as read on scroll
    if (this.messagesContainer) {
      this.messagesContainer.addEventListener('scroll', this.markVisibleMessagesRead.bind(this));
    }
  }

  private removeEventListeners(): void {
    if (this.messageForm) {
      this.messageForm.removeEventListener('submit', this.handleSendMessage);
    }
    if (this.threadForm) {
      this.threadForm.removeEventListener('submit', this.handleNewThread);
    }
    if (this.messagesContainer) {
      this.messagesContainer.removeEventListener('scroll', this.markVisibleMessagesRead);
    }
  }

  private clearTimers(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  /**
   * Load message threads from API
   */
  private async loadMessageThreads(): Promise<void> {
    try {
      const response = await fetch('/api/messages/threads', {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load threads: ${response.statusText}`);
      }

      const data = await response.json();
      this.messageThreads = data.threads || [];
      this.updateUnreadCount();
      this.renderThreadsList();
    } catch (error) {
      console.error('Failed to load message threads:', error);
      this.showError('Failed to load messages. Please refresh the page.');
    }
  }

  /**
   * Load messages for a specific thread
   */
  private async loadMessages(threadId: number): Promise<void> {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const data = await response.json();
      this.currentMessages = data.messages || [];
      this.currentThreadId = threadId;
      this.renderMessagesList();
      this.scrollToBottom();

      // Mark messages as read
      await this.markThreadRead(threadId);
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Failed to load messages for this conversation.');
    }
  }

  /**
   * Send new message
   */
  private async handleSendMessage(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.messageForm || !this.currentThreadId) return;

    const formData = new FormData(this.messageForm);
    const message = formData.get('message') as string;
    const files = Array.from(formData.getAll('attachments')) as globalThis.File[];

    if (!message.trim() && files.length === 0) {
      this.showError('Please enter a message or attach files.');
      return;
    }

    this.setMessageSending(true);

    try {
      const sendFormData = new FormData();
      sendFormData.append('message', message.trim());
      sendFormData.append('priority', 'normal');

      files.forEach((file) => {
        sendFormData.append('attachments', file);
      });

      const response = await fetch(`/api/messages/threads/${this.currentThreadId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`
        },
        body: sendFormData
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();

      // Add new message to current messages
      this.currentMessages.push(data.messageData);
      this.renderMessagesList();
      this.scrollToBottom();

      // Clear form
      this.messageForm.reset();

      // Update threads list
      await this.loadMessageThreads();

      this.showSuccess('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Failed to send message. Please try again.');
    } finally {
      this.setMessageSending(false);
    }
  }

  /**
   * Create new thread
   */
  private async handleNewThread(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.threadForm) return;

    const formData = new FormData(this.threadForm);
    const subject = formData.get('subject') as string;
    const threadType = (formData.get('thread_type') as string) || 'general';
    const priority = (formData.get('priority') as string) || 'normal';

    if (!subject.trim()) {
      this.showError('Subject is required.');
      return;
    }

    try {
      const response = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject.trim(),
          thread_type: threadType,
          priority
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.statusText}`);
      }

      const data = await response.json();

      // Reload threads and select new thread
      await this.loadMessageThreads();
      await this.selectThread(data.thread.id);

      // Clear form
      this.threadForm.reset();

      // Hide new thread modal if it exists
      const modal = document.getElementById('new-thread-modal');
      if (modal) {
        modal.classList.remove('active');
      }

      this.showSuccess('New conversation started!');
    } catch (error) {
      console.error('Failed to create thread:', error);
      this.showError('Failed to start new conversation. Please try again.');
    }
  }

  /**
   * Handle typing indicator
   */
  private handleTyping(): void {
    if (!this.isTyping) {
      this.isTyping = true;
      // Could send typing indicator to server here
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      // Stop typing indicator
    }, 2000);
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageForm) {
        this.messageForm.dispatchEvent(new Event('submit'));
      }
    }
  }

  /**
   * Select thread and load messages
   */
  public async selectThread(threadId: number): Promise<void> {
    // Update active thread UI
    document.querySelectorAll('.thread-item').forEach((item) => {
      item.classList.remove('active');
    });

    const threadElement = document.querySelector(`[data-thread-id="${threadId}"]`);
    if (threadElement) {
      threadElement.classList.add('active');
    }

    // Load messages for thread
    await this.loadMessages(threadId);
  }

  /**
   * Render threads list
   */
  private renderThreadsList(): void {
    if (!this.threadsContainer) return;

    if (this.messageThreads.length === 0) {
      this.threadsContainer.innerHTML = `
        <div class="no-threads">
          <p>No conversations yet.</p>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('new-thread-modal')?.classList.add('active')">
            Start New Conversation
          </button>
        </div>
      `;
      return;
    }

    this.threadsContainer.innerHTML = '';

    this.messageThreads.forEach((thread) => {
      const threadElement = document.createElement('div');
      threadElement.className = `thread-item ${thread.unread_count > 0 ? 'has-unread' : ''}`;
      threadElement.dataset.threadId = thread.id.toString();

      const priorityIcon = this.getPriorityIcon(thread.priority);
      const statusIcon = this.getThreadTypeIcon(thread.thread_type);

      // Sanitize user data to prevent XSS
      const safeSubject = SanitizationUtils.escapeHtml(thread.subject);
      const safeLastMessageBy = SanitizationUtils.escapeHtml(thread.last_message_by);
      const safeProjectName = thread.project_name ? SanitizationUtils.escapeHtml(thread.project_name) : '';

      threadElement.innerHTML = `
        <div class="thread-header">
          <div class="thread-title">
            <span class="thread-icon">${statusIcon}</span>
            <span class="thread-subject">${safeSubject}</span>
            ${thread.priority !== 'normal' ? `<span class="priority-icon">${priorityIcon}</span>` : ''}
          </div>
          ${thread.unread_count > 0 ? `<span class="unread-count">${thread.unread_count}</span>` : ''}
        </div>
        <div class="thread-meta">
          <span class="thread-last-message">Last message by ${safeLastMessageBy}</span>
          <span class="thread-time">${this.formatRelativeTime(thread.last_message_at)}</span>
        </div>
        ${safeProjectName ? `<div class="thread-project">Project: ${safeProjectName}</div>` : ''}
      `;

      threadElement.addEventListener('click', () => {
        this.selectThread(thread.id);
      });

      this.threadsContainer?.appendChild(threadElement);
    });
  }

  /**
   * Render messages list
   */
  private renderMessagesList(): void {
    if (!this.messagesContainer) return;

    if (this.currentMessages.length === 0) {
      this.messagesContainer.innerHTML = `
        <div class="no-messages">
          <p>No messages in this conversation yet.</p>
          <p>Send a message below to get started!</p>
        </div>
      `;
      return;
    }

    this.messagesContainer.innerHTML = '';

    this.currentMessages.forEach((message, _index) => {
      const messageElement = document.createElement('div');
      messageElement.className = `message message-${message.sender_type} ${!message.is_read ? 'unread' : ''}`;
      messageElement.dataset.messageId = message.id.toString();

      const isReply =
        message.reply_to && this.currentMessages.find((m) => m.id === message.reply_to);
      const attachmentsHtml =
        message.attachments.length > 0 ? this.renderAttachments(message.attachments) : '';

      // Sanitize user data to prevent XSS
      const safeSenderName = SanitizationUtils.escapeHtml(message.sender_name);
      const safePriority = SanitizationUtils.escapeHtml(message.priority);

      messageElement.innerHTML = `
        ${isReply ? '<div class="reply-indicator">Reply</div>' : ''}
        <div class="message-header">
          <span class="message-sender">${safeSenderName}</span>
          <span class="message-time">${this.formatTime(message.created_at)}</span>
          ${message.priority !== 'normal' ? `<span class="priority-badge priority-${safePriority}">${safePriority}</span>` : ''}
        </div>
        <div class="message-content">${this.formatMessageContent(message.message)}</div>
        ${attachmentsHtml}
      `;

      this.messagesContainer?.appendChild(messageElement);
    });
  }

  /**
   * Render message attachments
   */
  private renderAttachments(attachments: Message['attachments']): string {
    if (attachments.length === 0) return '';

    const attachmentsHtml = attachments
      .map((attachment) => {
        // Sanitize user data to prevent XSS
        const safeOriginalName = SanitizationUtils.escapeHtml(attachment.originalName);
        // URL-encode the filename to prevent injection in onclick handler
        const safeFilename = encodeURIComponent(attachment.filename);

        return `
      <div class="message-attachment">
        <span class="attachment-icon">${this.getFileIcon(attachment.mimeType)}</span>
        <div class="attachment-info">
          <div class="attachment-name">${safeOriginalName}</div>
          <div class="attachment-size">${this.formatFileSize(attachment.size)}</div>
        </div>
        <button type="button" class="attachment-download" onclick="window.open('/api/messages/attachments/${safeFilename}', '_blank')">
          Download
        </button>
      </div>
    `;
      })
      .join('');

    return `<div class="message-attachments">${attachmentsHtml}</div>`;
  }

  /**
   * Mark thread as read
   */
  private async markThreadRead(threadId: number): Promise<void> {
    try {
      await fetch(`/api/messages/threads/${threadId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      // Update local state
      const thread = this.messageThreads.find((t) => t.id === threadId);
      if (thread) {
        thread.unread_count = 0;
        this.updateUnreadCount();
        this.renderThreadsList();
      }
    } catch (error) {
      console.error('Failed to mark thread as read:', error);
    }
  }

  /**
   * Mark visible messages as read
   */
  private markVisibleMessagesRead(): void {
    // Implementation for marking visible messages as read
    // This would typically check which messages are in viewport
  }

  /**
   * Update unread count badge
   */
  private updateUnreadCount(): void {
    this.unreadCount = this.messageThreads.reduce((sum, thread) => sum + thread.unread_count, 0);

    if (this.unreadBadge) {
      if (this.unreadCount > 0) {
        this.unreadBadge.textContent = this.unreadCount.toString();
        this.unreadBadge.style.display = 'block';
      } else {
        this.unreadBadge.style.display = 'none';
      }
    }
  }

  /**
   * Setup real-time updates (if WebSocket available)
   */
  private setupRealTimeUpdates(): void {
    // Implementation for WebSocket connection
    // This would listen for new messages and update UI in real-time
  }

  /**
   * Utility methods
   */
  private getPriorityIcon(priority: string): string {
    const icons = {
      low: '⬇️',
      normal: '',
      high: '⬆️',
      urgent: '🔥'
    };
    return icons[priority as keyof typeof icons] || '';
  }

  private getThreadTypeIcon(type: string): string {
    const icons = {
      general: '💬',
      project: '📋',
      support: '🎧',
      quote: '💰'
    };
    return icons[type as keyof typeof icons] || '💬';
  }

  private getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('zip')) return '📦';
    return '📎';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  private formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatMessageContent(content: string): string {
    // Basic text formatting (links, line breaks)
    return content
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  private setMessageSending(sending: boolean): void {
    const submitBtn = this.messageForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
    const textarea = this.messageForm?.querySelector('textarea') as HTMLTextAreaElement;

    if (submitBtn) {
      submitBtn.disabled = sending;
      submitBtn.textContent = sending ? 'Sending...' : 'Send Message';
    }

    if (textarea) {
      textarea.disabled = sending;
    }
  }

  private showError(message: string): void {
    // Show error notification
    this.showNotification(message, 'error');
  }

  private showSuccess(message: string): void {
    // Show success notification
    this.showNotification(message, 'success');
  }

  private showNotification(message: string, type: 'error' | 'success' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      z-index: 10000;
      max-width: 400px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    `;

    document.body.appendChild(notification);

    gsap.fromTo(
      notification,
      {
        x: 100,
        opacity: 0
      },
      {
        x: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      }
    );

    setTimeout(() => {
      gsap.to(notification, {
        x: 100,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => notification.remove()
      });
    }, 5000);
  }
}

export default MessagingModule;
