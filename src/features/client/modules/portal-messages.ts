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
import { showToast } from '../../../utils/toast-notifications';
import { ICONS } from '../../../constants/icons';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';

const MESSAGES_API_BASE = '/api/messages';
const CLIENT_THREAD_TITLE = 'Conversation with Noelle';

// Attachment configuration
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'zip'];

// Pending attachments for current message
let pendingAttachments: File[] = [];

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the messages module */
type MessagesDOMKeys = {
  threadList: string;
  threadHeader: string;
  messagesThread: string;
  messageInput: string;
  sendBtn: string;
  attachBtn: string;
  attachInput: string;
  attachPreview: string;
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<MessagesDOMKeys>();

// Register all element selectors (called once when module loads)
domCache.register({
  threadList: '#thread-list',
  threadHeader: '#messages-thread-header',
  messagesThread: '#messages-thread',
  messageInput: '#message-input',
  sendBtn: '#btn-send-message',
  attachBtn: '#btn-attach-file',
  attachInput: '#attachment-input',
  attachPreview: '#attachment-preview'
});

interface MessageThread {
  id: number;
  subject: string;
  project_name?: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
}

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

// Store threads for reference
let cachedThreads: MessageThread[] = [];

/**
 * Load messages from API
 */
export async function loadMessagesFromAPI(ctx: ClientPortalContext, bustCache: boolean = false): Promise<void> {
  // Force refresh DOM references since views are dynamically rendered
  const threadList = domCache.get('threadList', true);
  const messagesContainer = domCache.get('messagesThread', true);
  if (!messagesContainer) return;

  // Show loading state
  if (threadList) {
    threadList.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';
  }
  messagesContainer.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading messages...</p></div>';

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
    const threads: MessageThread[] = threadsData.threads || [];
    cachedThreads = threads;

    // Render thread list
    if (threadList) {
      renderThreadList(threadList, threads, ctx);
    }

    if (threads.length === 0) {
      renderEmptyState(messagesContainer, 'No messages yet. Send a message to Noelle to get started.', { className: 'no-messages' });
      return;
    }

    // If no thread is selected, select the first one
    const thread = currentThreadId
      ? threads.find(t => t.id === currentThreadId) || threads[0]
      : threads[0];

    await loadThreadMessages(thread.id, ctx, bustCache);

    // Check for pending email change message from settings page
    checkPendingEmailChangeMessage();
  } catch (error) {
    console.error('Error loading messages:', error);
    renderErrorState(messagesContainer, 'Unable to load messages. Please try again later.', { className: 'no-messages', type: 'network' });
  }
}

/**
 * Check for pending email change message and pre-fill input
 */
function checkPendingEmailChangeMessage(): void {
  const pendingMessage = sessionStorage.getItem('pendingEmailChangeMessage');
  if (pendingMessage) {
    try {
      const { template } = JSON.parse(pendingMessage);
      const messageInput = domCache.get('messageInput', true) as HTMLTextAreaElement | null;
      if (messageInput && template) {
        messageInput.value = template;
        messageInput.focus();
      }
    } catch {
      // Ignore parse errors
    }
    // Clear the pending message after using it
    sessionStorage.removeItem('pendingEmailChangeMessage');
  }
}

/**
 * Render thread list
 */
function renderThreadList(container: HTMLElement, threads: MessageThread[], ctx: ClientPortalContext): void {
  if (threads.length === 0) {
    renderEmptyState(container, 'No conversations', { className: 'no-messages' });
    return;
  }

  container.innerHTML = threads.map(thread => {
    const isActive = thread.id === currentThreadId;
    const hasUnread = thread.unread_count > 0;
    const lastMessageDate = new Date(thread.last_message_at);
    const timeStr = formatRelativeTime(lastMessageDate);
    const itemId = `portal-thread-item-${thread.id}`;

    return `
      <div class="thread-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}"
           id="${itemId}"
           data-thread-id="${thread.id}"
           role="option"
           aria-selected="${isActive}"
           tabindex="0">
        <div class="thread-item-header">
          <span class="thread-item-title">${ctx.escapeHtml(thread.subject || 'General')}</span>
          <span class="thread-item-time">${timeStr}</span>
        </div>
        <div class="thread-item-meta">
          <span class="thread-item-project">${thread.project_name ? ctx.escapeHtml(thread.project_name) : 'General'}</span>
          ${hasUnread ? `<span class="thread-unread-badge">${thread.unread_count}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Set initial aria-activedescendant if there's an active thread
  const activeThread = container.querySelector('.thread-item.active') as HTMLElement;
  if (activeThread && activeThread.id) {
    container.setAttribute('aria-activedescendant', activeThread.id);
  }

  // Add click handlers to threads
  container.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
      if (threadId && threadId !== currentThreadId) {
        selectThread(threadId, ctx);
      }
    });

    // Keyboard navigation
    item.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        const threadId = parseInt(item.getAttribute('data-thread-id') || '0');
        if (threadId && threadId !== currentThreadId) {
          selectThread(threadId, ctx);
        }
      }
    });
  });
}

/**
 * Select a thread and load its messages
 */
async function selectThread(threadId: number, ctx: ClientPortalContext): Promise<void> {
  currentThreadId = threadId;

  // Update active state in thread list
  const threadList = domCache.get('threadList');
  if (threadList) {
    threadList.querySelectorAll('.thread-item').forEach(item => {
      const itemThreadId = parseInt(item.getAttribute('data-thread-id') || '0');
      const isSelected = itemThreadId === threadId;
      item.classList.toggle('active', isSelected);
      item.setAttribute('aria-selected', String(isSelected));

      // Update aria-activedescendant for screen readers
      if (isSelected && (item as HTMLElement).id) {
        threadList.setAttribute('aria-activedescendant', (item as HTMLElement).id);
      }
    });
  }

  await loadThreadMessages(threadId, ctx, false);
}

/**
 * Load messages for a specific thread
 */
async function loadThreadMessages(threadId: number, ctx: ClientPortalContext, bustCache: boolean): Promise<void> {
  const messagesContainer = domCache.get('messagesThread');
  const threadHeader = domCache.get('threadHeader');
  if (!messagesContainer) return;

  currentThreadId = threadId;

  // Update header
  const thread = cachedThreads.find(t => t.id === threadId);
  if (threadHeader && thread) {
    const titleEl = threadHeader.querySelector('.thread-title');
    if (titleEl) {
      titleEl.textContent = CLIENT_THREAD_TITLE;
    }
  }

  // Show loading
  messagesContainer.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading messages...</p></div>';

  try {
    const messagesUrl = bustCache
      ? `${MESSAGES_API_BASE}/threads/${threadId}/messages?_=${Date.now()}`
      : `${MESSAGES_API_BASE}/threads/${threadId}/messages`;
    const messagesResponse = await fetch(messagesUrl, {
      credentials: 'include'
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesData = await messagesResponse.json();
    renderMessages(messagesContainer, messagesData.messages || [], ctx);

    // Mark as read
    await fetch(`${MESSAGES_API_BASE}/threads/${threadId}/read`, {
      method: 'PUT',
      credentials: 'include'
    });

    // Update unread count in thread list
    const threadList = domCache.get('threadList');
    if (threadList) {
      const threadItem = threadList.querySelector(`[data-thread-id="${threadId}"]`);
      if (threadItem) {
        threadItem.classList.remove('unread');
        const badge = threadItem.querySelector('.thread-unread-badge');
        if (badge) badge.remove();
      }
    }
  } catch (error) {
    console.error('Error loading thread messages:', error);
    renderErrorState(messagesContainer, 'Unable to load messages.', { className: 'no-messages', type: 'network' });
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
 * Render attachment list for a message
 */
function renderMessageAttachments(attachments: { filename: string; originalName: string; size: number; mimeType: string }[] | null): string {
  if (!attachments || attachments.length === 0) return '';

  const attachmentItems = attachments.map(att => {
    const size = formatFileSize(att.size);
    const name = att.originalName || att.filename;
    const displayName = name.length > 25 ? `${name.substring(0, 22)  }...` : name;

    return `
      <a href="${MESSAGES_API_BASE}/attachments/${att.filename}/download"
         class="message-attachment"
         target="_blank"
         rel="noopener noreferrer"
         title="Download ${name}">
        <span class="message-attachment-icon">${ICONS.FILE}</span>
        <span class="message-attachment-name">${displayName}</span>
        <span class="message-attachment-size">(${size})</span>
        <span class="message-attachment-download">${ICONS.DOWNLOAD}</span>
      </a>
    `;
  }).join('');

  return `<div class="message-attachments">${attachmentItems}</div>`;
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
    renderEmptyState(container, 'No messages yet. Send a message to Noelle to get started.', { className: 'no-messages' });
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isSent = msg.sender_type === 'client';
      const isAdmin = msg.sender_type === 'admin';
      const initials = (msg.sender_name || 'Unknown').substring(0, 3).toUpperCase();
      const displayName = isAdmin ? 'Noelle' : (msg.sender_name || 'Unknown');

      // Admin uses avatar image, clients use initials placeholder
      const avatarHtml = isAdmin
        ? '<img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />'
        : `<div class="avatar-placeholder">${initials}</div>`;

      const senderClass = isAdmin ? 'message-admin' : 'message-client';

      // Parse attachments if present
      const attachments = msg.attachments;
      const attachmentsHtml = renderMessageAttachments(attachments as { filename: string; originalName: string; size: number; mimeType: string }[] | null);

      return `
      <div class="message message-${isSent ? 'sent' : 'received'} ${senderClass}">
        <div class="message-avatar">
          ${avatarHtml}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${ctx.escapeHtml(displayName)}</span>
            <span class="message-time">${ctx.formatDate(msg.created_at)}</span>
          </div>
          <div class="message-body">${ctx.escapeHtml(msg.message)}</div>
          ${attachmentsHtml}
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
  if (!message && pendingAttachments.length === 0) return;

  try {
    let url: string;
    let requestInit: RequestInit;

    // Use FormData if we have attachments, otherwise use JSON
    if (pendingAttachments.length > 0) {
      const formData = new FormData();
      formData.append('message', message || '(Attachment)');

      if (!currentThreadId) {
        formData.append('subject', 'General Inquiry');
      }

      pendingAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      url = currentThreadId
        ? `${MESSAGES_API_BASE}/threads/${currentThreadId}/messages`
        : `${MESSAGES_API_BASE}/inquiry`;

      requestInit = {
        method: 'POST',
        credentials: 'include',
        body: formData
      };
    } else {
      const body = currentThreadId
        ? { message }
        : { subject: 'General Inquiry', message };

      url = currentThreadId
        ? `${MESSAGES_API_BASE}/threads/${currentThreadId}/messages`
        : `${MESSAGES_API_BASE}/inquiry`;

      requestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      };
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();

    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    // Clear input and attachments
    messageInput.value = '';
    clearAttachments();

    // Use cache busting to ensure we get the latest messages after sending
    await loadMessagesFromAPI(ctx, true);
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message. Please try again.', 'error');
  }
}

/**
 * Clear pending attachments
 */
function clearAttachments(): void {
  pendingAttachments = [];
  const preview = domCache.get('attachPreview', true);
  if (preview) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
  }
  const input = domCache.get('attachInput', true) as HTMLInputElement;
  if (input) {
    input.value = '';
  }
}

/**
 * Remove a single attachment by index
 */
function removeAttachment(index: number): void {
  pendingAttachments.splice(index, 1);
  renderAttachmentPreview();
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Validate a file for attachment
 */
function validateFile(file: File): string | null {
  const ext = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type .${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File ${file.name} is too large. Maximum size is 10MB.`;
  }

  return null;
}

/**
 * Handle file selection
 */
function handleFileSelection(files: FileList | null): void {
  if (!files || files.length === 0) return;

  const remainingSlots = MAX_ATTACHMENTS - pendingAttachments.length;
  if (remainingSlots <= 0) {
    showToast(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'error');
    return;
  }

  const filesToAdd = Array.from(files).slice(0, remainingSlots);

  for (const file of filesToAdd) {
    const error = validateFile(file);
    if (error) {
      showToast(error, 'error');
      continue;
    }
    pendingAttachments.push(file);
  }

  if (files.length > remainingSlots) {
    showToast(`Only ${remainingSlots} more files can be added`, 'warning');
  }

  renderAttachmentPreview();
}

/**
 * Render attachment preview chips
 */
function renderAttachmentPreview(): void {
  const preview = domCache.get('attachPreview', true);
  if (!preview) return;

  if (pendingAttachments.length === 0) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');
  preview.innerHTML = pendingAttachments.map((file, index) => {
    const size = formatFileSize(file.size);
    const name = file.name.length > 20 ? `${file.name.substring(0, 17)  }...` : file.name;

    return `
      <div class="attachment-chip" data-index="${index}">
        <span class="attachment-chip-icon">${ICONS.FILE}</span>
        <span class="attachment-chip-name" title="${file.name}">${name}</span>
        <span class="attachment-chip-size">(${size})</span>
        <button type="button" class="attachment-chip-remove" data-index="${index}" aria-label="Remove attachment">
          ${ICONS.X_SMALL}
        </button>
      </div>
    `;
  }).join('');

  // Add remove button handlers
  preview.querySelectorAll('.attachment-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt((btn as HTMLElement).dataset.index || '0');
      removeAttachment(index);
    });
  });
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

  // Setup attachment button and input
  setupAttachmentListeners();
}

/**
 * Setup attachment-related listeners
 */
function setupAttachmentListeners(): void {
  const attachBtn = domCache.get('attachBtn', true);
  const attachInput = domCache.get('attachInput', true) as HTMLInputElement;

  if (attachBtn && attachInput) {
    // Click on attach button opens file picker
    attachBtn.addEventListener('click', (e) => {
      e.preventDefault();
      attachInput.click();
    });

    // Handle file selection
    attachInput.addEventListener('change', () => {
      handleFileSelection(attachInput.files);
      attachInput.value = ''; // Reset so same file can be selected again
    });
  }

  // Drag and drop support on message input
  const messageInput = domCache.get('messageInput', true);
  if (messageInput) {
    messageInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.add('drag-over');
    });

    messageInput.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.remove('drag-over');
    });

    messageInput.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.remove('drag-over');
      // Access dataTransfer from the event
      const dragEvent = e as Event & { dataTransfer?: DataTransfer };
      if (dragEvent.dataTransfer?.files) {
        handleFileSelection(dragEvent.dataTransfer.files);
      }
    });
  }
}
