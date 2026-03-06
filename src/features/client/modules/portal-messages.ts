/**
 * ===============================================
 * PORTAL MESSAGES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-messages.ts
 *
 * Messaging functionality for client portal.
 * Dynamically imported for code splitting.
 *
 * Rendering logic: ./portal-messages-renderer.ts
 * Thread management: ./portal-messages-threads.ts
 * Attachment handling: ./portal-messages-attachments.ts
 */

import type { ClientPortalContext } from '../portal-types';
import { createDOMCache } from '../../../utils/dom-cache';
import { showToast } from '../../../utils/toast-notifications';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';
import { getReactComponent } from '../../../react/registry';
import { createReactCleanupHandler } from '../../../utils/react-cleanup';
import { apiFetch, unwrapApiData } from '../../../utils/api-client';
import { createLogger } from '../../../utils/logger';
import {
  renderThreadList,
  loadThreadMessages,
  type MessageThread
} from './portal-messages-threads';
import {
  getPendingAttachments,
  clearAttachments,
  resetAttachments,
  setupAttachmentListeners
} from './portal-messages-attachments';

const logger = createLogger('PortalMessages');

// React cleanup handler
const reactMessagesCleanup = createReactCleanupHandler();

/**
 * Check if React portal messages should be used
 */
function shouldUseReactPortalMessages(): boolean {
  return true;
}

/**
 * Cleanup React portal messages
 */
export function cleanupReactPortalMessages(): void {
  reactMessagesCleanup.cleanup();
}

const MESSAGES_API = API_ENDPOINTS.MESSAGES;

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
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<MessagesDOMKeys>();

domCache.register({
  threadList: '#thread-list',
  threadHeader: '#messages-thread-header',
  messagesThread: '#messages-thread',
  messageInput: '#message-input',
  sendBtn: '#btn-send-message'
});

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
export async function loadMessagesFromAPI(
  ctx: ClientPortalContext,
  bustCache: boolean = false
): Promise<void> {
  // Force refresh DOM references since views are dynamically rendered
  const threadList = domCache.get('threadList', true);
  const messagesContainer = domCache.get('messagesThread', true);
  if (!messagesContainer) return;

  // Check if React component should be used
  if (shouldUseReactPortalMessages()) {
    const component = getReactComponent('portalMessages');
    if (component) {
      // Hide vanilla thread list - React renders its own
      if (threadList) (threadList as HTMLElement).style.display = 'none';

      // Mount React component
      const unmountResult = component.mount(messagesContainer as HTMLElement, {
        getAuthToken: ctx.getAuthToken,
        showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
          showToast(message, type);
        }
      });

      if (typeof unmountResult === 'function') {
        reactMessagesCleanup.setUnmount(unmountResult);
      }

      return;
    }
    // React component not available - show error state instead of loading forever
    logger.error('React component not found');
    renderErrorState(messagesContainer as HTMLElement, 'Unable to load messages. Please refresh the page.', {
      onRetry: () => window.location.reload()
    });
    return;

  }

  // Vanilla implementation below

  // Show loading state
  if (threadList) {
    threadList.innerHTML =
      '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>';
  }
  messagesContainer.innerHTML =
    '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading messages...</span></div>';

  try {
    // Add cache-busting parameter when needed (e.g., after sending a message)
    const threadsUrl = bustCache
      ? `${MESSAGES_API}/threads?_=${Date.now()}`
      : `${MESSAGES_API}/threads`;
    const threadsResponse = await apiFetch(threadsUrl);

    if (!threadsResponse.ok) {
      throw new Error('Failed to load message threads');
    }

    const threadsRaw = await threadsResponse.json();
    const threadsData = unwrapApiData<Record<string, unknown>>(threadsRaw);
    const threads: MessageThread[] = (threadsData.threads as MessageThread[]) || [];
    cachedThreads = threads;

    // Render thread list
    if (threadList) {
      renderThreadList(
        threadList as HTMLElement,
        threads,
        ctx,
        currentThreadId,
        (threadId) => selectThread(threadId, ctx)
      );
    }

    if (threads.length === 0) {
      renderEmptyState(
        messagesContainer,
        'No messages yet. Send a message to Noelle to get started.',
        { className: 'no-messages' }
      );
      return;
    }

    // If no thread is selected, select the first one
    const thread = currentThreadId
      ? threads.find((t) => t.id === currentThreadId) || threads[0]
      : threads[0];

    currentThreadId = thread.id;
    await loadThreadMessages(thread.id, ctx, bustCache, cachedThreads, {
      messagesContainer: messagesContainer as HTMLElement,
      threadHeader: domCache.get('threadHeader') as HTMLElement | null,
      threadList: threadList as HTMLElement | null
    });

    // Check for pending email change message from settings page
    checkPendingEmailChangeMessage();
  } catch (error) {
    logger.error('Error loading messages:', error);
    renderErrorState(messagesContainer, 'Unable to load messages. Please try again later.', {
      className: 'no-messages',
      type: 'network'
    });
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
    sessionStorage.removeItem('pendingEmailChangeMessage');
  }
}

/**
 * Select a thread and load its messages
 */
async function selectThread(threadId: number, ctx: ClientPortalContext): Promise<void> {
  currentThreadId = threadId;

  const threadList = domCache.get('threadList');
  if (threadList) {
    threadList.querySelectorAll('.thread-item').forEach((item) => {
      const itemThreadId = parseInt(item.getAttribute('data-thread-id') || '0');
      const isSelected = itemThreadId === threadId;
      item.classList.toggle('active', isSelected);
      item.setAttribute('aria-selected', String(isSelected));

      if (isSelected && (item as HTMLElement).id) {
        threadList.setAttribute('aria-activedescendant', (item as HTMLElement).id);
      }
    });
  }

  await loadThreadMessages(threadId, ctx, false, cachedThreads, {
    messagesContainer: domCache.get('messagesThread') as HTMLElement | null,
    threadHeader: domCache.get('threadHeader') as HTMLElement | null,
    threadList: threadList as HTMLElement | null
  });
}

/**
 * Send a message
 */
export async function sendMessage(ctx: ClientPortalContext): Promise<void> {
  const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
  if (!messageInput) return;

  const message = messageInput.value.trim();
  const pendingAttachments = getPendingAttachments();
  if (!message && pendingAttachments.length === 0) return;

  try {
    let url: string;
    let requestInit: RequestInit;

    if (pendingAttachments.length > 0) {
      const formData = new FormData();
      formData.append('message', message || '(Attachment)');

      if (!currentThreadId) {
        formData.append('subject', 'General Inquiry');
      }

      pendingAttachments.forEach((file) => {
        formData.append('attachments', file);
      });

      url = currentThreadId
        ? `${MESSAGES_API}/threads/${currentThreadId}/messages`
        : `${MESSAGES_API}/inquiry`;

      requestInit = {
        method: 'POST',
        body: formData
      };
    } else {
      const body = currentThreadId ? { message } : { subject: 'General Inquiry', message };

      url = currentThreadId
        ? `${MESSAGES_API}/threads/${currentThreadId}/messages`
        : `${MESSAGES_API}/inquiry`;

      requestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };
    }

    const response = await apiFetch(url, requestInit);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const raw = await response.json();
    const data = unwrapApiData<Record<string, unknown>>(raw);

    if (data.threadId) {
      currentThreadId = data.threadId as number;
    }

    messageInput.value = '';
    clearAttachments();

    await loadMessagesFromAPI(ctx, true);
  } catch (error) {
    logger.error('Error sending message:', error);
    showToast('Failed to send message. Please try again.', 'error');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Setup message event listeners
 */
export function setupMessageListeners(ctx: ClientPortalContext): void {
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

  setupAttachmentListeners();
}

/**
 * Cleanup function to be called when leaving the messages view
 */
export function cleanupMessages(): void {
  resetAttachments();
  cachedThreads = [];
  currentThreadId = null;
}
