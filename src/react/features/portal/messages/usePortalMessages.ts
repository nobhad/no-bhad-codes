/**
 * usePortalMessages Hook
 * Data fetching and state management for portal messages
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MessageThread,
  Message,
  ThreadsResponse,
  MessagesResponse,
  SendMessageResponse,
  UpdateMessageResponse
} from './types';
import { createLogger } from '@/utils/logger';
import {
  apiFetch,
  unwrapApiData,
  getCsrfToken,
  CSRF_HEADER_NAME,
  apiPost,
  toFriendlyError
} from '@/utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { usePortalFetch } from '@react/hooks/usePortalFetch';
import { TIMING } from '@/constants/timing';
import { formatErrorMessage } from '@/utils/error-utils';

const logger = createLogger('usePortalMessages');

interface UsePortalMessagesOptions {
  getAuthToken?: () => string | null;
}

interface UsePortalMessagesReturn {
  // Thread state
  threads: MessageThread[];
  selectedThread: MessageThread | null;
  threadsLoading: boolean;
  threadsError: string | null;

  // Messages state
  messages: Message[];
  messagesLoading: boolean;
  messagesError: string | null;

  // Actions
  selectThread: (thread: MessageThread) => void;
  refreshThreads: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  sendMessage: (content: string, attachments?: File[]) => Promise<boolean>;
  editMessage: (messageId: number, content: string) => Promise<boolean>;
  deleteMessage: (messageId: number) => Promise<boolean>;
  reactToMessage: (messageId: number, emoji: string) => Promise<boolean>;
  markThreadRead: (threadId: number) => Promise<void>;
}

/**
 * Hook for managing portal messages state and API calls
 */
export function usePortalMessages({
  getAuthToken
}: UsePortalMessagesOptions = {}): UsePortalMessagesReturn {
  // Thread state
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Shared authenticated fetch
  const { portalFetch } = usePortalFetch({ getAuthToken });

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all threads
   */
  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);
    setThreadsError(null);

    try {
      const data = await portalFetch<ThreadsResponse>(`${API_ENDPOINTS.MESSAGES}/threads`);
      setThreads(data.threads ?? []);
    } catch (error) {
      const message = formatErrorMessage(error, 'Failed to load threads');
      setThreadsError(message);
    } finally {
      setThreadsLoading(false);
    }
  }, [portalFetch]);

  /**
   * Fetch messages for selected thread.
   * Pass `silent: true` for background polls to avoid loading flicker.
   */
  const fetchMessages = useCallback(
    async (threadId: number, options?: { silent?: boolean }) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (!options?.silent) {
        setMessagesLoading(true);
        setMessagesError(null);
      }

      try {
        const response = await apiFetch(buildEndpoint.messageThreadMessages(threadId), {
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const data: MessagesResponse = unwrapApiData<MessagesResponse>(await response.json());
        setMessages(data.messages ?? []);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        if (!options?.silent) {
          const message = formatErrorMessage(error, 'Failed to load messages');
          setMessagesError(message);
        }
      } finally {
        if (!options?.silent) {
          setMessagesLoading(false);
        }
      }
    },
    []
  );

  /**
   * Mark a thread's messages as read
   */
  const markThreadRead = useCallback(
    async (threadId: number) => {
      try {
        await portalFetch(buildEndpoint.messageThreadRead(threadId), {
          method: 'PUT'
        });
        // Update local unread count
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, unread_count: 0 } : t
          )
        );
      } catch {
        // Non-critical — silently ignore
      }
    },
    [portalFetch]
  );

  /**
   * Select a thread and load its messages
   */
  const selectThread = useCallback(
    (thread: MessageThread) => {
      setSelectedThread(thread);
      setMessages([]);
      fetchMessages(thread.id);
      // Mark as read when opening
      if (thread.unread_count > 0) {
        markThreadRead(thread.id);
      }
    },
    [fetchMessages, markThreadRead]
  );

  /**
   * Refresh threads list
   */
  const refreshThreads = useCallback(async () => {
    await fetchThreads();
  }, [fetchThreads]);

  /**
   * Refresh messages for current thread
   */
  const refreshMessages = useCallback(async () => {
    if (selectedThread) {
      await fetchMessages(selectedThread.id);
    }
  }, [selectedThread, fetchMessages]);

  /**
   * Send a new message.
   * Uses portalFetch for JSON payloads; falls back to raw fetch for FormData
   * (portalFetch JSON-serializes the body, which is incompatible with FormData).
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: File[]): Promise<boolean> => {
      if (!selectedThread) return false;

      const url = buildEndpoint.messageThreadMessages(selectedThread.id);

      try {
        let data: SendMessageResponse;

        if (attachments && attachments.length > 0) {
          // FormData path — raw fetch required (portalFetch JSON-serializes body)
          const formData = new FormData();
          formData.append('content', content);
          attachments.forEach((file) => {
            formData.append('attachments', file);
          });

          // Raw fetch for FormData — add CSRF protection manually
          const csrfToken = getCsrfToken();
          const headers: Record<string, string> = {};
          if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;

          const response = await fetch(url, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: formData
          });

          if (!response.ok) {
            throw new Error(
              await toFriendlyError(response, {
                rateLimited: "You're sending messages a bit fast — please wait a moment.",
                unavailable: 'Messaging is temporarily unavailable. Please try again shortly.',
                fallback: 'Failed to send message'
              })
            );
          }

          data = unwrapApiData<SendMessageResponse>(await response.json());
        } else {
          // JSON path — use portalFetch
          data = await portalFetch<SendMessageResponse>(url, {
            method: 'POST',
            body: { content }
          });
        }

        // Optimistically add the message
        setMessages((prev) => [...prev, data.message]);

        // Update thread's last message (use 'message' field from API response)
        const messageContent = data.message.message || data.message.content || '';
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThread.id
              ? {
                ...t,
                last_message_at: data.message.created_at,
                last_message_preview: messageContent.slice(0, 100),
                unread_count: 0
              }
              : t
          )
        );

        return true;
      } catch (error) {
        logger.error('Error sending message:', error);
        return false;
      }
    },
    [selectedThread, portalFetch]
  );

  /**
   * Edit an existing message
   */
  const editMessage = useCallback(
    async (messageId: number, content: string): Promise<boolean> => {
      if (!selectedThread) return false;

      try {
        const data = await portalFetch<UpdateMessageResponse>(
          `${buildEndpoint.messageThreadMessages(selectedThread.id)}/${messageId}`,
          { method: 'PUT', body: { content } }
        );

        // Update message in state
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));

        return true;
      } catch (error) {
        logger.error('Error editing message:', error);
        return false;
      }
    },
    [selectedThread, portalFetch]
  );

  /**
   * React to a message with an emoji
   */
  const reactToMessage = useCallback(
    async (messageId: number, emoji: string): Promise<boolean> => {
      try {
        const response = await apiPost(buildEndpoint.messageReactions(messageId), { emoji });
        if (response.ok) {
          // Refresh messages to get updated reaction counts
          if (selectedThread) {
            await fetchMessages(selectedThread.id, { silent: true });
          }
          return true;
        }
        return false;
      } catch (error) {
        logger.error('Error reacting to message:', error);
        return false;
      }
    },
    [selectedThread, fetchMessages]
  );

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(
    async (messageId: number): Promise<boolean> => {
      if (!selectedThread) return false;

      try {
        await portalFetch(
          `${buildEndpoint.messageThreadMessages(selectedThread.id)}/${messageId}`,
          { method: 'DELETE' }
        );

        // Remove message from state
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        return true;
      } catch (error) {
        logger.error('Error deleting message:', error);
        return false;
      }
    },
    [selectedThread, portalFetch]
  );

  // Fetch threads on mount
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Poll for new messages while a thread is active
  useEffect(() => {
    if (!selectedThread) return;

    const interval = setInterval(() => {
      fetchMessages(selectedThread.id, { silent: true });
    }, TIMING.MESSAGE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [selectedThread, fetchMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    threads,
    selectedThread,
    threadsLoading,
    threadsError,
    messages,
    messagesLoading,
    messagesError,
    selectThread,
    refreshThreads,
    refreshMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    markThreadRead
  };
}
