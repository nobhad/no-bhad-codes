/**
 * useProjectMessages
 * Handles on-demand loading and sending of project messages.
 */

import { useState, useCallback } from 'react';
import type { Message } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectMessages');

interface UseProjectMessagesReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  fetchMessages: () => Promise<Message[]>;
  loadMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
}

export function useProjectMessages({
  projectId
}: ProjectDetailHookOptions): UseProjectMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);

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

  return {
    messages,
    setMessages,
    fetchMessages,
    loadMessages,
    sendMessage
  };
}
