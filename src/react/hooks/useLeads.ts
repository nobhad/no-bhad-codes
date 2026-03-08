import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Lead, LeadStatus, LeadStats } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '../../utils/api-client';
import { decodeArrayFields } from '../utils/decodeText';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useLeads');

/** Text fields in Lead that may contain HTML entities */
const LEAD_TEXT_FIELDS = ['contact_name', 'company_name', 'notes', 'source'] as const;

interface UseLeadsOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

interface UseLeadsReturn {
  /** List of leads */
  leads: Lead[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Lead statistics */
  stats: LeadStats;
  /** Refetch leads */
  refetch: () => Promise<void>;
  /** Update a single lead */
  updateLead: (id: number, updates: Partial<Lead>) => Promise<boolean>;
  /** Bulk update lead status */
  bulkUpdateStatus: (ids: number[], status: LeadStatus) => Promise<boolean>;
  /** Delete multiple leads */
  bulkDelete: (ids: number[]) => Promise<{ success: number; failed: number }>;
}

/**
 * useLeads
 * Hook for fetching and managing leads data
 */
export function useLeads({ getAuthToken, autoFetch = true }: UseLeadsOptions = {}): UseLeadsReturn {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate stats from leads
  const stats: LeadStats = useMemo(() => {
    const result: LeadStats = {
      total: leads.length,
      new: 0,
      contacted: 0,
      qualified: 0,
      inProgress: 0,
      converted: 0,
      lost: 0
    };

    for (const lead of leads) {
      switch (lead.status) {
      case 'new':
        result.new++;
        break;
      case 'contacted':
        result.contacted++;
        break;
      case 'qualified':
        result.qualified++;
        break;
      case 'in-progress':
        result.inProgress++;
        break;
      case 'converted':
        result.converted++;
        break;
      case 'lost':
      case 'cancelled':
        result.lost++;
        break;
      }
    }

    return result;
  }, [leads]);

  // Fetch leads from API
  const fetchLeads = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.LEADS, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.statusText}`);
      }

      const json = await response.json();
      const data = unwrapApiData<{ leads: Lead[] }>(json);
      const leadsArray = data.leads || [];

      // Decode HTML entities in text fields to prevent double-encoding
      setLeads(decodeArrayFields(leadsArray, LEAD_TEXT_FIELDS));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[useLeads] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Update a single lead
  const updateLead = useCallback(
    async (id: number, updates: Partial<Lead>): Promise<boolean> => {
      try {
        // Use status endpoint if only updating status
        const endpoint =
          Object.keys(updates).length === 1 && 'status' in updates
            ? `${API_ENDPOINTS.ADMIN.LEADS}/${id}/status`
            : `${API_ENDPOINTS.ADMIN.LEADS}/${id}`;

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update lead: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Lead>(json);
        // Update local state optimistically
        setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...updates } : lead)));
        return true;
      } catch (err) {
        logger.error('[useLeads] Update error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  // Bulk update lead status
  const bulkUpdateStatus = useCallback(
    async (ids: number[], status: LeadStatus): Promise<boolean> => {
      try {
        const response = await fetch(API_ENDPOINTS.ADMIN.LEADS_BULK_STATUS, {
          method: 'POST',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify({ projectIds: ids, status })
        });

        if (!response.ok) {
          throw new Error(`Failed to bulk update: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<unknown>(json);
        // Update local state
        setLeads((prev) =>
          prev.map((lead) => (ids.includes(lead.id) ? { ...lead, status } : lead))
        );
        return true;
      } catch (err) {
        logger.error('[useLeads] Bulk update error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  // Delete multiple leads
  const bulkDelete = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      try {
        const headers = buildAuthHeaders(getAuthToken);

        // Try bulk endpoint first
        const response = await fetch(API_ENDPOINTS.ADMIN.LEADS_BULK_DELETE, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ leadIds: ids })
        });

        if (response.ok) {
          const json = await response.json();
          const data = unwrapApiData<{ deleted: number }>(json);
          success = data.deleted || ids.length;
          // Remove from local state
          setLeads((prev) => prev.filter((lead) => !ids.includes(lead.id)));
        } else {
          // Fallback to individual deletes
          for (const id of ids) {
            const deleteResponse = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/${id}`, {
              method: 'DELETE',
              headers,
              credentials: 'include'
            });
            if (deleteResponse.ok) {
              success++;
            } else {
              failed++;
            }
          }
          // Remove successful deletes from local state
          if (success > 0) {
            setLeads((prev) => prev.filter((lead) => !ids.includes(lead.id)));
          }
        }
      } catch (err) {
        logger.error('[useLeads] Bulk delete error:', err);
        failed = ids.length;
      }

      return { success, failed };
    },
    [getAuthToken]
  );

  // Auto-fetch on mount with AbortController cleanup
  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    fetchLeads(controller.signal);
    return () => controller.abort();
  }, [autoFetch, fetchLeads]);

  return {
    leads,
    isLoading,
    error,
    stats,
    refetch: fetchLeads,
    updateLead,
    bulkUpdateStatus,
    bulkDelete
  };
}
