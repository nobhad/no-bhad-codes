/**
 * useClientTags
 * Handles fetching and mutating client tags and available tag options.
 */

import { useState, useCallback } from 'react';
import type { ClientTag } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ClientDetailHookOptions } from './types';

const logger = createLogger('useClientTags');

export function useClientTags({ clientId, getAuthToken }: ClientDetailHookOptions) {
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([]);

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ tags: ClientTag[] }>(json);
      return parsed.tags || [];
    } catch (err) {
      logger.error('[useClientTags] Error fetching tags:', err);
      return [];
    }
  }, [clientId, getAuthToken]);

  const fetchAvailableTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/tags`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ tags: ClientTag[] }>(json);
      return parsed.tags || [];
    } catch (err) {
      logger.error('[useClientTags] Error fetching available tags:', err);
      return [];
    }
  }, [getAuthToken]);

  const fetchAll = useCallback(async () => {
    const [tagResult, availableResult] = await Promise.all([fetchTags(), fetchAvailableTags()]);
    setTags(tagResult);
    setAvailableTags(availableResult);
  }, [fetchTags, fetchAvailableTags]);

  const addTag = useCallback(
    async (tagId: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags`, {
          method: 'POST',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify({ tag_id: tagId })
        });

        if (!response.ok) {
          throw new Error(`Failed to add tag: ${response.statusText}`);
        }

        const json = await response.json();
        const newTag = unwrapApiData<ClientTag>(json);
        setTags((prev) => [...prev, newTag]);
        return true;
      } catch (err) {
        logger.error('[useClientTags] Add tag error:', err);
        return false;
      }
    },
    [clientId, getAuthToken]
  );

  const removeTag = useCallback(
    async (tagId: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags/${tagId}`, {
          method: 'DELETE',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to remove tag: ${response.statusText}`);
        }

        setTags((prev) => prev.filter((t) => t.id !== tagId));
        return true;
      } catch (err) {
        logger.error('[useClientTags] Remove tag error:', err);
        return false;
      }
    },
    [clientId, getAuthToken]
  );

  return {
    tags,
    availableTags,
    fetchAll,
    addTag,
    removeTag
  };
}
