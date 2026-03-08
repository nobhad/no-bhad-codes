/**
 * useProjectMessages
 * Handles on-demand loading and sending of project messages.
 */

import { useState, useCallback } from 'react';
import type { Message } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '@/utils/api-client';
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
  projectId,
  getAuthToken
}: ProjectDetailHookOptions): UseProjectMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = useCallback(async (): Promise<Message[]> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/messages`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

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
  }, [projectId, getAuthToken]);

  const loadMessages = useCallback(async () => {
    const fetched = await fetchMessages();
    setMessages(fetched);
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/messages`, {
          method: 'POST',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify({ content })
        });

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
    [projectId, getAuthToken]
  );

  return {
    messages,
    setMessages,
    fetchMessages,
    loadMessages,
    sendMessage
  };
}
