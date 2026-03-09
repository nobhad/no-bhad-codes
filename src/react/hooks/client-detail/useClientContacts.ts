/**
 * useClientContacts
 * Handles fetching and mutating client contacts.
 */

import { useState, useCallback } from 'react';
import type { ClientContact } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ClientDetailHookOptions } from './types';

const logger = createLogger('useClientContacts');

export function useClientContacts({ clientId }: ClientDetailHookOptions) {
  const [contacts, setContacts] = useState<ClientContact[]>([]);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/contacts`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ contacts: ClientContact[] }>(json);
      return parsed.contacts || [];
    } catch (err) {
      logger.error('[useClientContacts] Error fetching contacts:', err);
      return [];
    }
  }, [clientId]);

  const fetchAll = useCallback(async () => {
    const result = await fetchContacts();
    setContacts(result);
  }, [fetchContacts]);

  const addContact = useCallback(
    async (
      contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>
    ): Promise<boolean> => {
      try {
        const response = await apiPost(`${API_ENDPOINTS.CLIENTS}/${clientId}/contacts`, contact);

        if (!response.ok) {
          throw new Error(`Failed to add contact: ${response.statusText}`);
        }

        const json = await response.json();
        const newContact = unwrapApiData<ClientContact>(json);
        setContacts((prev) => [...prev, newContact]);
        return true;
      } catch (err) {
        logger.error('[useClientContacts] Add contact error:', err);
        return false;
      }
    },
    [clientId]
  );

  const updateContact = useCallback(
    async (id: number, updates: Partial<ClientContact>): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.CLIENT_CONTACTS}/${id}`, updates);

        if (!response.ok) {
          throw new Error(`Failed to update contact: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<ClientContact>(json);
        setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
        return true;
      } catch (err) {
        logger.error('[useClientContacts] Update contact error:', err);
        return false;
      }
    },
    []
  );

  const deleteContact = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await apiDelete(`${API_ENDPOINTS.CLIENT_CONTACTS}/${id}`);

        if (!response.ok) {
          throw new Error(`Failed to delete contact: ${response.statusText}`);
        }

        setContacts((prev) => prev.filter((c) => c.id !== id));
        return true;
      } catch (err) {
        logger.error('[useClientContacts] Delete contact error:', err);
        return false;
      }
    },
    []
  );

  return {
    contacts,
    fetchAll,
    addContact,
    updateContact,
    deleteContact
  };
}
