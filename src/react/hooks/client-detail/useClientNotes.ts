/**
 * useClientNotes
 * Handles fetching and mutating client notes, including pin toggling.
 */

import { useState, useCallback } from 'react';
import type { ClientNote } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ClientDetailHookOptions } from './types';

const logger = createLogger('useClientNotes');

export function useClientNotes({ clientId, getAuthToken }: ClientDetailHookOptions) {
  const [notes, setNotes] = useState<ClientNote[]>([]);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/notes`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ notes: ClientNote[] }>(json);
      return parsed.notes || [];
    } catch (err) {
      logger.error('[useClientNotes] Error fetching notes:', err);
      return [];
    }
  }, [clientId, getAuthToken]);

  const fetchAll = useCallback(async () => {
    const result = await fetchNotes();
    setNotes(result);
  }, [fetchNotes]);

  const addNote = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/notes`, {
          method: 'POST',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify({ content })
        });

        if (!response.ok) {
          throw new Error(`Failed to add note: ${response.statusText}`);
        }

        const json = await response.json();
        const newNote = unwrapApiData<ClientNote>(json);
        setNotes((prev) => [newNote, ...prev]);
        return true;
      } catch (err) {
        logger.error('[useClientNotes] Add note error:', err);
        return false;
      }
    },
    [clientId, getAuthToken]
  );

  const updateNote = useCallback(
    async (id: number, updates: Partial<ClientNote>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENT_NOTES}/${id}`, {
          method: 'PUT',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update note: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<ClientNote>(json);
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
        return true;
      } catch (err) {
        logger.error('[useClientNotes] Update note error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  const deleteNote = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENT_NOTES}/${id}`, {
          method: 'DELETE',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete note: ${response.statusText}`);
        }

        setNotes((prev) => prev.filter((n) => n.id !== id));
        return true;
      } catch (err) {
        logger.error('[useClientNotes] Delete note error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  const toggleNotePin = useCallback(
    async (id: number): Promise<boolean> => {
      const note = notes.find((n) => n.id === id);
      if (!note) return false;
      return updateNote(id, { is_pinned: !note.is_pinned });
    },
    [notes, updateNote]
  );

  return {
    notes,
    fetchAll,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin
  };
}
