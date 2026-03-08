/**
 * useClientDetail
 * Thin orchestrator that composes domain-specific sub-hooks.
 * Consumers get the same interface as before -- no breaking changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useClientCore } from './client-detail/useClientCore';
import { useClientContacts } from './client-detail/useClientContacts';
import { useClientNotes } from './client-detail/useClientNotes';
import { useClientTags } from './client-detail/useClientTags';
import type { UseClientDetailOptions, UseClientDetailReturn } from './client-detail/types';

export type { UseClientDetailReturn, UseClientDetailOptions };

/**
 * useClientDetail
 * Hook for fetching and managing client detail data.
 * Delegates to focused sub-hooks for contacts, notes, tags, and core data.
 */
export function useClientDetail({
  clientId,
  getAuthToken,
  autoFetch = true
}: UseClientDetailOptions): UseClientDetailReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hookOptions = { clientId, getAuthToken };

  const core = useClientCore(hookOptions);
  const contactsHook = useClientContacts(hookOptions);
  const notesHook = useClientNotes(hookOptions);
  const tagsHook = useClientTags(hookOptions);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        core.fetchAll(),
        contactsHook.fetchAll(),
        notesHook.fetchAll(),
        tagsHook.fetchAll()
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [core.fetchAll, contactsHook.fetchAll, notesHook.fetchAll, tagsHook.fetchAll]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && clientId) {
      fetchAll();
    }
  }, [autoFetch, clientId, fetchAll]);

  return {
    // Core data
    client: core.client,
    health: core.health,
    activities: core.activities,
    stats: core.stats,
    projects: core.projects,

    // Contacts
    contacts: contactsHook.contacts,
    addContact: contactsHook.addContact,
    updateContact: contactsHook.updateContact,
    deleteContact: contactsHook.deleteContact,

    // Notes
    notes: notesHook.notes,
    addNote: notesHook.addNote,
    updateNote: notesHook.updateNote,
    deleteNote: notesHook.deleteNote,
    toggleNotePin: notesHook.toggleNotePin,

    // Tags
    tags: tagsHook.tags,
    availableTags: tagsHook.availableTags,
    addTag: tagsHook.addTag,
    removeTag: tagsHook.removeTag,

    // Client-level actions
    updateClient: core.updateClient,
    sendInvitation: core.sendInvitation,

    // Loading / error / refetch
    isLoading,
    error,
    refetch: fetchAll
  };
}
