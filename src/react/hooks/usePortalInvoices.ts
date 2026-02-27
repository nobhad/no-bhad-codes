/**
 * usePortalInvoices Hook
 * Fetches and manages invoices for the client portal
 */

import { useState, useEffect, useCallback } from 'react';
import type { PortalInvoice, PortalInvoiceSummary } from '../features/portal/types';

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

interface ApiResponse {
  success?: boolean;
  invoices?: PortalInvoice[];
  summary?: PortalInvoiceSummary;
  error?: string;
}

export function usePortalInvoices(options: UsePortalInvoicesOptions = {}): UsePortalInvoicesReturn {
  const { getAuthToken } = options;

  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [summary, setSummary] = useState<PortalInvoiceSummary>({ totalOutstanding: 0, totalPaid: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/invoices/me', {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data: ApiResponse = await response.json();

      if (data.invoices) {
        setInvoices(data.invoices);
      }

      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('[usePortalInvoices] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

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
