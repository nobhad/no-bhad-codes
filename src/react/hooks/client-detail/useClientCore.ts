/**
 * useClientCore
 * Handles core client data: client profile, health, activities, stats, projects.
 * Also provides client-level mutations: updateClient, sendInvitation.
 */

import { useState, useCallback } from 'react';
import type {
  Client,
  ClientHealth,
  ClientActivity,
  ClientDetailStats,
  ClientProject
} from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPut, apiPost } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ClientDetailHookOptions } from './types';

const logger = createLogger('useClientCore');

interface ClientCoreState {
  client: Client | null;
  health: ClientHealth | null;
  activities: ClientActivity[];
  stats: ClientDetailStats | null;
  projects: ClientProject[];
}

const INITIAL_STATE: ClientCoreState = {
  client: null,
  health: null,
  activities: [],
  stats: null,
  projects: []
};

export function useClientCore({ clientId }: ClientDetailHookOptions) {
  const [state, setState] = useState<ClientCoreState>(INITIAL_STATE);

  const fetchClient = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}`);

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
      logger.error('[useClientCore] Error fetching client:', err);
      throw err;
    }
  }, [clientId]);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/health`);

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ health: ClientHealth }>(json);
      return parsed.health ?? null;
    } catch (err) {
      logger.error('[useClientCore] Error fetching health:', err);
      return null;
    }
  }, [clientId]);

  const fetchActivities = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/activities`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ activities: ClientActivity[] }>(json);
      return parsed.activities || [];
    } catch (err) {
      logger.error('[useClientCore] Error fetching activities:', err);
      return [];
    }
  }, [clientId]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/stats`);

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ stats: ClientDetailStats }>(json);
      return parsed.stats ?? null;
    } catch (err) {
      logger.error('[useClientCore] Error fetching stats:', err);
      return null;
    }
  }, [clientId]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.CLIENTS}/${clientId}/projects`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ projects: ClientProject[] }>(json);
      return parsed.projects || [];
    } catch (err) {
      logger.error('[useClientCore] Error fetching projects:', err);
      return [];
    }
  }, [clientId]);

  const fetchAll = useCallback(async () => {
    const [client, health, activities, stats, projects] = await Promise.all([
      fetchClient(),
      fetchHealth(),
      fetchActivities(),
      fetchStats(),
      fetchProjects()
    ]);

    setState({ client, health, activities, stats, projects });
  }, [fetchClient, fetchHealth, fetchActivities, fetchStats, fetchProjects]);

  const updateClient = useCallback(
    async (updates: Partial<Client>): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.CLIENTS}/${clientId}`, updates);

        if (!response.ok) {
          throw new Error(`Failed to update client: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Client>(json);
        setState((prev) => ({
          ...prev,
          client: prev.client ? { ...prev.client, ...updates } : null
        }));
        return true;
      } catch (err) {
        logger.error('[useClientCore] Update error:', err);
        return false;
      }
    },
    [clientId]
  );

  const sendInvitation = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiPost(`${API_ENDPOINTS.CLIENTS}/${clientId}/invite`);

      if (!response.ok) {
        throw new Error(`Failed to send invitation: ${response.statusText}`);
      }

      const json = await response.json();
      const inviteData = unwrapApiData<{ invitation_sent_at: string }>(json);
      setState((prev) => ({
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
      logger.error('[useClientCore] Send invitation error:', err);
      return false;
    }
  }, [clientId]);

  return {
    client: state.client,
    health: state.health,
    activities: state.activities,
    stats: state.stats,
    projects: state.projects,
    fetchAll,
    updateClient,
    sendInvitation
  };
}
