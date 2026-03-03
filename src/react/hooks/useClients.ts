import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Client, ClientStats, ApiResponse } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { decodeArrayFields } from '../utils/decodeText';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useClients');

/** Text fields in Client that may contain HTML entities */
const CLIENT_TEXT_FIELDS = ['company_name', 'contact_name'] as const;

interface UseClientsOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

interface UseClientsReturn {
  /** List of clients */
  clients: Client[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Client statistics */
  stats: ClientStats;
  /** Refetch clients */
  refetch: () => Promise<void>;
  /** Update a single client */
  updateClient: (id: number, updates: Partial<Client>) => Promise<boolean>;
  /** Archive multiple clients (set status to inactive) */
  bulkArchive: (ids: number[]) => Promise<{ success: number; failed: number }>;
  /** Delete multiple clients */
  bulkDelete: (ids: number[]) => Promise<{ success: number; failed: number }>;
  /** Send invitation to client */
  sendInvite: (id: number) => Promise<boolean>;
}

/**
 * useClients
 * Hook for fetching and managing clients data
 */
export function useClients({
  getAuthToken,
  autoFetch = true
}: UseClientsOptions = {}): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate stats from clients
  const stats: ClientStats = useMemo(() => {
    const result: ClientStats = {
      total: clients.length,
      active: 0,
      inactive: 0,
      pending: 0
    };

    for (const client of clients) {
      switch (client.status) {
      case 'active':
        result.active++;
        break;
      case 'inactive':
        result.inactive++;
        break;
      case 'pending':
        result.pending++;
        break;
      }
    }

    return result;
  }, [clients]);

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

  // Fetch clients from API
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.CLIENTS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch clients: ${response.statusText}`);
      }

      const data: ApiResponse<{ clients: Client[] }> = await response.json();

      if (data.success && data.data) {
        // Decode HTML entities in text fields to prevent double-encoding
        const fetchedClients = data.data.clients || [];
        setClients(decodeArrayFields(fetchedClients, CLIENT_TEXT_FIELDS));
      } else {
        throw new Error(data.error || 'Failed to load clients');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[useClients] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  // Update a single client
  const updateClient = useCallback(
    async (id: number, updates: Partial<Client>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update client: ${response.statusText}`);
        }

        const data: ApiResponse<Client> = await response.json();

        if (data.success) {
          // Update local state optimistically
          setClients((prev) =>
            prev.map((client) => (client.id === id ? { ...client, ...updates } : client))
          );
          return true;
        }

        return false;
      } catch (err) {
        logger.error('[useClients] Update error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Archive multiple clients (set status to inactive)
  const bulkArchive = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        const result = await updateClient(id, { status: 'inactive' });
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed };
    },
    [updateClient]
  );

  // Delete multiple clients
  const bulkDelete = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      try {
        for (const id of ids) {
          const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
          });

          if (response.ok) {
            success++;
          } else {
            failed++;
          }
        }

        // Remove deleted clients from local state
        if (success > 0) {
          setClients((prev) => prev.filter((client) => !ids.includes(client.id)));
        }
      } catch (err) {
        logger.error('[useClients] Bulk delete error:', err);
        failed = ids.length - success;
      }

      return { success, failed };
    },
    [getHeaders]
  );

  // Send invitation to client
  const sendInvite = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.CLIENTS}/${id}/send-invite`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to send invite: ${response.statusText}`);
        }

        const data: ApiResponse<unknown> = await response.json();

        if (data.success) {
          // Update local state with invitation timestamp
          setClients((prev) =>
            prev.map((client) =>
              client.id === id
                ? { ...client, invitation_sent_at: new Date().toISOString() }
                : client
            )
          );
          return true;
        }

        return false;
      } catch (err) {
        logger.error('[useClients] Send invite error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchClients();
    }
  }, [autoFetch, fetchClients]);

  return {
    clients,
    isLoading,
    error,
    stats,
    refetch: fetchClients,
    updateClient,
    bulkArchive,
    bulkDelete,
    sendInvite
  };
}
