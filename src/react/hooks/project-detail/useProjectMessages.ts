/**
 * useProjectMessages
 * Handles on-demand loading and sending of project messages,
 * plus editing and emoji reactions.
 */

import { useState, useCallback } from 'react';
import type { Message, MessageReaction } from '@react/features/admin/types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectMessages');

interface UseProjectMessagesReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  fetchMessages: () => Promise<Message[]>;
  loadMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
  editMessage: (messageId: number, content: string) => Promise<boolean>;
  reactions: Record<number, MessageReaction[]>;
  toggleReaction: (messageId: number, emoji: string) => Promise<boolean>;
}

export function useProjectMessages({
  projectId
}: ProjectDetailHookOptions): UseProjectMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<number, MessageReaction[]>>({});

  const fetchMessages = useCallback(async (): Promise<Message[]> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/messages`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ messages: Message[] }>(json);
      return parsed.messages || [];
    } catch (err) {
      logger.error('Error fetching messages:', err);
      return [];
    }
  }, [projectId]);

  const loadMessages = useCallback(async () => {
    const fetched = await fetchMessages();
    setMessages(fetched);
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await apiPost(`${API_ENDPOINTS.PROJECTS}/${projectId}/messages`, { content });

        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        const json = await response.json();
        const newMessage = unwrapApiData<Message>(json);
        setMessages((prev) => [...prev, newMessage]);
        return true;
      } catch (err) {
        logger.error('Send message error:', err);
        return false;
      }
    },
    [projectId]
  );

  const editMessage = useCallback(
    async (messageId: number, content: string): Promise<boolean> => {
      try {
        const response = await apiPut(buildEndpoint.messageItem(messageId), { message: content });

        if (!response.ok) {
          throw new Error(`Failed to edit message: ${response.statusText}`);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content, edited_at: new Date().toISOString() }
              : m
          )
        );
        return true;
      } catch (err) {
        logger.error('Edit message error:', err);
        return false;
      }
    },
    []
  );

  const toggleReaction = useCallback(
    async (messageId: number, emoji: string): Promise<boolean> => {
      const current = reactions[messageId] || [];
      const existing = current.find((r) => r.emoji === emoji);
      const hasReacted = existing?.reacted ?? false;

      // Optimistic update
      setReactions((prev) => {
        const prevList = prev[messageId] || [];
        if (hasReacted) {
          return {
            ...prev,
            [messageId]: prevList
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r)
              .filter((r) => r.count > 0)
          };
        }
        const found = prevList.find((r) => r.emoji === emoji);
        return {
          ...prev,
          [messageId]: found
            ? prevList.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r)
            : [...prevList, { emoji, count: 1, reacted: true }]
        };
      });

      try {
        if (hasReacted) {
          const res = await apiDelete(buildEndpoint.messageReaction(messageId, emoji));
          if (!res.ok) throw new Error('Failed to remove reaction');
        } else {
          const res = await apiPost(buildEndpoint.messageReactions(messageId), { reaction: emoji });
          if (!res.ok) throw new Error('Failed to add reaction');
        }
        return true;
      } catch (err) {
        logger.error('Toggle reaction error:', err);
        // Revert optimistic update
        setReactions((prev) => {
          const prevList = prev[messageId] || [];
          if (hasReacted) {
            const found = prevList.find((r) => r.emoji === emoji);
            return {
              ...prev,
              [messageId]: found
                ? prevList.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r)
                : [...prevList, { emoji, count: 1, reacted: true }]
            };
          }
          return {
            ...prev,
            [messageId]: prevList
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r)
              .filter((r) => r.count > 0)
          };
        });
        return false;
      }
    },
    [reactions]
  );

  return {
    messages,
    setMessages,
    fetchMessages,
    loadMessages,
    sendMessage,
    editMessage,
    reactions,
    toggleReaction
  };
}
