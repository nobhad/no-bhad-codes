/**
 * usePortalInvoices Hook
 * Fetches and manages invoices for the client portal
 */

import { useState, useEffect, useCallback } from 'react';
import type { PortalInvoice, PortalInvoiceSummary } from '../features/portal/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData, apiFetch } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('usePortalInvoices');

interface UsePortalInvoicesOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
}

interface UsePortalInvoicesReturn {
  invoices: PortalInvoice[];
  summary: PortalInvoiceSummary;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ApiResponsePayload {
  invoices?: PortalInvoice[];
  summary?: PortalInvoiceSummary;
}

export function usePortalInvoices(_options: UsePortalInvoicesOptions = {}): UsePortalInvoicesReturn {
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [summary, setSummary] = useState<PortalInvoiceSummary>({
    totalOutstanding: 0,
    totalPaid: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_ENDPOINTS.INVOICES}/me`);

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const payload = unwrapApiData<ApiResponsePayload>(await response.json());

      if (payload?.invoices) {
        setInvoices(payload.invoices);
      }

      if (payload?.summary) {
        setSummary(payload.summary);
      }
    } catch (err) {
      logger.error('[usePortalInvoices] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    summary,
    isLoading,
    error,
    refetch: fetchInvoices
  };
}
