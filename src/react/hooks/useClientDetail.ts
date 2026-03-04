import { useState, useEffect, useCallback } from 'react';
import type {
  Client,
  ClientHealth,
  ClientContact,
  ClientActivity,
  ClientNote,
  ClientDetailStats,
  ClientProject,
  ClientTag
} from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useClientDetail');

interface UseClientDetailOptions {
  /** Client ID to fetch */
  clientId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

interface ClientDetailData {
  client: Client | null;
  health: ClientHealth | null;
  contacts: ClientContact[];
  activities: ClientActivity[];
  notes: ClientNote[];
  stats: ClientDetailStats | null;
  projects: ClientProject[];
  tags: ClientTag[];
  availableTags: ClientTag[];
}

interface UseClientDetailReturn {
  /** Client data */
  client: Client | null;
  /** Client health score */
  health: ClientHealth | null;
  /** Client contacts */
  contacts: ClientContact[];
  /** Client activities */
  activities: ClientActivity[];
  /** Client notes */
  notes: ClientNote[];
  /** Client statistics */
  stats: ClientDetailStats | null;
  /** Client projects */
  projects: ClientProject[];
  /** Client tags */
  tags: ClientTag[];
  /** Available tags for selection */
  availableTags: ClientTag[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refetch all data */
  refetch: () => Promise<void>;
  /** Update client */
  updateClient: (updates: Partial<Client>) => Promise<boolean>;
  /** Add contact */
  addContact: (contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  /** Update contact */
  updateContact: (id: number, updates: Partial<ClientContact>) => Promise<boolean>;
  /** Delete contact */
  deleteContact: (id: number) => Promise<boolean>;
  /** Add note */
  addNote: (content: string) => Promise<boolean>;
  /** Update note */
  updateNote: (id: number, updates: Partial<ClientNote>) => Promise<boolean>;
  /** Delete note */
  deleteNote: (id: number) => Promise<boolean>;
  /** Toggle note pinned status */
  toggleNotePin: (id: number) => Promise<boolean>;
  /** Add tag to client */
  addTag: (tagId: number) => Promise<boolean>;
  /** Remove tag from client */
  removeTag: (tagId: number) => Promise<boolean>;
  /** Send client invitation */
  sendInvitation: () => Promise<boolean>;
}

/**
 * useClientDetail
 * Hook for fetching and managing client detail data
 */
export function useClientDetail({
  clientId,
  getAuthToken,
  autoFetch = true
}: UseClientDetailOptions): UseClientDetailReturn {
  const [data, setData] = useState<ClientDetailData>({
    client: null,
    health: null,
    contacts: [],
    activities: [],
    notes: [],
    stats: null,
    projects: [],
    tags: [],
    availableTags: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  // Fetch client details
  const fetchClient = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch client: ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ client: Client; projects: unknown[] }>(json);
      if (parsed.client) {
        return parsed.client;
      }
      throw new Error('Failed to load client');
    } catch (err) {
      logger.error('[useClientDetail] Error fetching client:', err);
      throw err;
    }
  }, [clientId, getHeaders]);

  // Fetch health score
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/health`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ health: ClientHealth }>(json);
      return parsed.health ?? null;
    } catch (err) {
      logger.error('[useClientDetail] Error fetching health:', err);
      return null;
    }
  }, [clientId, getHeaders]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/contacts`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ contacts: ClientContact[] }>(json);
      return parsed.contacts || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching contacts:', err);
      return [];
    }
  }, [clientId, getHeaders]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/activities`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ activities: ClientActivity[] }>(json);
      return parsed.activities || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching activities:', err);
      return [];
    }
  }, [clientId, getHeaders]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/notes`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ notes: ClientNote[] }>(json);
      return parsed.notes || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching notes:', err);
      return [];
    }
  }, [clientId, getHeaders]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/stats`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ stats: ClientDetailStats }>(json);
      return parsed.stats ?? null;
    } catch (err) {
      logger.error('[useClientDetail] Error fetching stats:', err);
      return null;
    }
  }, [clientId, getHeaders]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/projects`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ projects: ClientProject[] }>(json);
      return parsed.projects || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching projects:', err);
      return [];
    }
  }, [clientId, getHeaders]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ tags: ClientTag[] }>(json);
      return parsed.tags || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching tags:', err);
      return [];
    }
  }, [clientId, getHeaders]);

  // Fetch available tags
  const fetchAvailableTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/tags`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ tags: ClientTag[] }>(json);
      return parsed.tags || [];
    } catch (err) {
      logger.error('[useClientDetail] Error fetching available tags:', err);
      return [];
    }
  }, [getHeaders]);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [client, health, contacts, activities, notes, stats, projects, tags, availableTags] =
        await Promise.all([
          fetchClient(),
          fetchHealth(),
          fetchContacts(),
          fetchActivities(),
          fetchNotes(),
          fetchStats(),
          fetchProjects(),
          fetchTags(),
          fetchAvailableTags()
        ]);

      setData({
        client,
        health,
        contacts,
        activities,
        notes,
        stats,
        projects,
        tags,
        availableTags
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchClient,
    fetchHealth,
    fetchContacts,
    fetchActivities,
    fetchNotes,
    fetchStats,
    fetchProjects,
    fetchTags,
    fetchAvailableTags
  ]);

  // Update client
  const updateClient = useCallback(
    async (updates: Partial<Client>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update client: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Client>(json);
        setData((prev) => ({
          ...prev,
          client: prev.client ? { ...prev.client, ...updates } : null
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Update error:', err);
        return false;
      }
    },
    [clientId, getHeaders]
  );

  // Add contact
  const addContact = useCallback(
    async (contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/contacts`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(contact)
        });

        if (!response.ok) {
          throw new Error(`Failed to add contact: ${response.statusText}`);
        }

        const json = await response.json();
        const newContact = unwrapApiData<ClientContact>(json);
        setData((prev) => ({
          ...prev,
          contacts: [...prev.contacts, newContact]
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Add contact error:', err);
        return false;
      }
    },
    [clientId, getHeaders]
  );

  // Update contact
  const updateContact = useCallback(
    async (id: number, updates: Partial<ClientContact>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENT_CONTACTS}/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update contact: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<ClientContact>(json);
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c))
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Update contact error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Delete contact
  const deleteContact = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENT_CONTACTS}/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete contact: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.filter((c) => c.id !== id)
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Delete contact error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Add note
  const addNote = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/notes`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ content })
        });

        if (!response.ok) {
          throw new Error(`Failed to add note: ${response.statusText}`);
        }

        const json = await response.json();
        const newNote = unwrapApiData<ClientNote>(json);
        setData((prev) => ({
          ...prev,
          notes: [newNote, ...prev.notes]
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Add note error:', err);
        return false;
      }
    },
    [clientId, getHeaders]
  );

  // Update note
  const updateNote = useCallback(
    async (id: number, updates: Partial<ClientNote>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.NOTES}/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update note: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<ClientNote>(json);
        setData((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Update note error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Delete note
  const deleteNote = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.NOTES}/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete note: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== id)
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Delete note error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Toggle note pinned
  const toggleNotePin = useCallback(
    async (id: number): Promise<boolean> => {
      const note = data.notes.find((n) => n.id === id);
      if (!note) return false;
      return updateNote(id, { is_pinned: !note.is_pinned });
    },
    [data.notes, updateNote]
  );

  // Add tag to client
  const addTag = useCallback(
    async (tagId: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ tag_id: tagId })
        });

        if (!response.ok) {
          throw new Error(`Failed to add tag: ${response.statusText}`);
        }

        const json = await response.json();
        const newTag = unwrapApiData<ClientTag>(json);
        setData((prev) => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Add tag error:', err);
        return false;
      }
    },
    [clientId, getHeaders]
  );

  // Remove tag from client
  const removeTag = useCallback(
    async (tagId: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/tags/${tagId}`, {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to remove tag: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          tags: prev.tags.filter((t) => t.id !== tagId)
        }));
        return true;
      } catch (err) {
        logger.error('[useClientDetail] Remove tag error:', err);
        return false;
      }
    },
    [clientId, getHeaders]
  );

  // Send invitation
  const sendInvitation = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/invite`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to send invitation: ${response.statusText}`);
      }

      const json = await response.json();
      const inviteData = unwrapApiData<{ invitation_sent_at: string }>(json);
      setData((prev) => ({
        ...prev,
        client: prev.client
          ? {
            ...prev.client,
            invitation_sent_at: inviteData.invitation_sent_at || new Date().toISOString()
          }
          : null
      }));
      return true;
    } catch (err) {
      logger.error('[useClientDetail] Send invitation error:', err);
      return false;
    }
  }, [clientId, getHeaders]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && clientId) {
      fetchAll();
    }
  }, [autoFetch, clientId, fetchAll]);

  return {
    client: data.client,
    health: data.health,
    contacts: data.contacts,
    activities: data.activities,
    notes: data.notes,
    stats: data.stats,
    projects: data.projects,
    tags: data.tags,
    availableTags: data.availableTags,
    isLoading,
    error,
    refetch: fetchAll,
    updateClient,
    addContact,
    updateContact,
    deleteContact,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin,
    addTag,
    removeTag,
    sendInvitation
  };
}
