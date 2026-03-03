/**
 * usePortalMessages Hook
 * Data fetching and state management for portal messages
 */
/* eslint-disable no-undef */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MessageThread,
  Message,
  ThreadsResponse,
  MessagesResponse,
  SendMessageResponse,
  UpdateMessageResponse
} from './types';

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

  // Refs for cleanup and stable callbacks
  const abortControllerRef = useRef<AbortController | null>(null);
  const getAuthTokenRef = useRef(getAuthToken);

  // Keep ref in sync with prop
  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);

  /**
   * Build request headers with auth token
   */
  const getHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    const token = getAuthTokenRef.current?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  /**
   * Fetch all threads
   */
  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);
    setThreadsError(null);

    try {
      const response = await fetch('/api/messages/threads', {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch threads');
      }

      const data: ThreadsResponse = await response.json();
      setThreads(data.threads);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load threads';
      setThreadsError(message);
    } finally {
      setThreadsLoading(false);
    }
  }, [getHeaders]);

  /**
   * Fetch messages for selected thread
   */
  const fetchMessages = useCallback(
    async (threadId: number) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setMessagesLoading(true);
      setMessagesError(null);

      try {
        const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include',
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const data: MessagesResponse = await response.json();
        setMessages(data.messages);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load messages';
        setMessagesError(message);
      } finally {
        setMessagesLoading(false);
      }
    },
    [getHeaders]
  );

  /**
   * Select a thread and load its messages
   */
  const selectThread = useCallback(
    (thread: MessageThread) => {
      setSelectedThread(thread);
      setMessages([]);
      fetchMessages(thread.id);
    },
    [fetchMessages]
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
   * Send a new message
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: File[]): Promise<boolean> => {
      if (!selectedThread) return false;

      try {
        let body: FormData | string;
        let headers: HeadersInit;

        if (attachments && attachments.length > 0) {
          const formData = new FormData();
          formData.append('content', content);
          attachments.forEach((file) => {
            formData.append('attachments', file);
          });
          body = formData;
          // Let browser set Content-Type for FormData
          const token = getAuthToken?.();
          headers = token ? { Authorization: `Bearer ${token}` } : {};
        } else {
          body = JSON.stringify({ content });
          headers = getHeaders();
        }

        const response = await fetch(`/api/messages/threads/${selectedThread.id}/messages`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data: SendMessageResponse = await response.json();

        // Optimistically add the message
        setMessages((prev) => [...prev, data.message]);

        // Update thread's last message
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThread.id
              ? {
                ...t,
                last_message_at: data.message.created_at,
                last_message_preview: data.message.content.slice(0, 100),
                unread_count: 0
              }
              : t
          )
        );

        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    },
    [selectedThread, getAuthToken, getHeaders]
  );

  /**
   * Edit an existing message
   */
  const editMessage = useCallback(
    async (messageId: number, content: string): Promise<boolean> => {
      if (!selectedThread) return false;

      try {
        const response = await fetch(
          `/api/messages/threads/${selectedThread.id}/messages/${messageId}`,
          {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ content })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to edit message');
        }

        const data: UpdateMessageResponse = await response.json();

        // Update message in state
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));

        return true;
      } catch (error) {
        console.error('Error editing message:', error);
        return false;
      }
    },
    [selectedThread, getHeaders]
  );

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(
    async (messageId: number): Promise<boolean> => {
      if (!selectedThread) return false;

      try {
        const response = await fetch(
          `/api/messages/threads/${selectedThread.id}/messages/${messageId}`,
          {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete message');
        }

        // Remove message from state
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        return true;
      } catch (error) {
        console.error('Error deleting message:', error);
        return false;
      }
    },
    [selectedThread, getHeaders]
  );

  // Fetch threads on mount
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

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
    deleteMessage
  };
}
