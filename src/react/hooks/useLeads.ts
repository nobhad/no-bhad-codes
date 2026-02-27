import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Lead, LeadStatus, LeadStats, ApiResponse } from '@react/features/admin/types';

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
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/leads', {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      if (data.success && data.data) {
        // Could be { leads: [...] } or direct array
        const leadsArray = Array.isArray(data.data) ? data.data : data.data.leads || [];
        setLeads(leadsArray);
      } else if (Array.isArray(data)) {
        setLeads(data);
      } else if (data.leads && Array.isArray(data.leads)) {
        setLeads(data.leads);
      } else {
        throw new Error(data.error || 'Failed to load leads');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useLeads] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Update a single lead
  const updateLead = useCallback(
    async (id: number, updates: Partial<Lead>): Promise<boolean> => {
      try {
        const token = getAuthToken?.();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Use status endpoint if only updating status
        const endpoint =
          Object.keys(updates).length === 1 && 'status' in updates
            ? `/api/admin/leads/${id}/status`
            : `/api/admin/leads/${id}`;

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update lead: ${response.statusText}`);
        }

        const data: ApiResponse<Lead> = await response.json();

        if (data.success) {
          // Update local state optimistically
          setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...updates } : lead)));
          return true;
        }

        return false;
      } catch (err) {
        console.error('[useLeads] Update error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  // Bulk update lead status
  const bulkUpdateStatus = useCallback(
    async (ids: number[], status: LeadStatus): Promise<boolean> => {
      try {
        const token = getAuthToken?.();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/admin/leads/bulk/status', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ projectIds: ids, status })
        });

        if (!response.ok) {
          throw new Error(`Failed to bulk update: ${response.statusText}`);
        }

        const data: ApiResponse<unknown> = await response.json();

        if (data.success) {
          // Update local state
          setLeads((prev) =>
            prev.map((lead) => (ids.includes(lead.id) ? { ...lead, status } : lead))
          );
          return true;
        }

        return false;
      } catch (err) {
        console.error('[useLeads] Bulk update error:', err);
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
        const token = getAuthToken?.();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Try bulk endpoint first
        const response = await fetch('/api/admin/leads/bulk/delete', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ leadIds: ids })
        });

        if (response.ok) {
          const data: ApiResponse<{ deleted: number }> = await response.json();
          if (data.success) {
            success = data.data?.deleted || ids.length;
            // Remove from local state
            setLeads((prev) => prev.filter((lead) => !ids.includes(lead.id)));
          }
        } else {
          // Fallback to individual deletes
          for (const id of ids) {
            const deleteResponse = await fetch(`/api/admin/leads/${id}`, {
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
        console.error('[useLeads] Bulk delete error:', err);
        failed = ids.length;
      }

      return { success, failed };
    },
    [getAuthToken]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchLeads();
    }
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
