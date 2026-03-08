import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Invoice, InvoiceStats } from '@react/features/admin/types';
import { API_ENDPOINTS } from '../../constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useInvoices');

interface UseInvoicesOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

interface UseInvoicesReturn {
  /** List of invoices */
  invoices: Invoice[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Invoice statistics */
  stats: InvoiceStats;
  /** Refetch invoices */
  refetch: () => Promise<void>;
  /** Update a single invoice */
  updateInvoice: (id: number, updates: Partial<Invoice>) => Promise<boolean>;
  /** Mark invoice as paid */
  markAsPaid: (id: number) => Promise<boolean>;
  /** Send invoice */
  sendInvoice: (id: number) => Promise<boolean>;
  /** Download invoice PDF */
  downloadPdf: (id: number) => Promise<void>;
  /** Delete multiple invoices */
  bulkDelete: (ids: number[]) => Promise<{ success: number; failed: number }>;
  /** Bulk mark as paid */
  bulkMarkPaid: (ids: number[]) => Promise<{ success: number; failed: number }>;
  /** Bulk send invoices */
  bulkSend: (ids: number[]) => Promise<{ success: number; failed: number }>;
}

/**
 * Check if an invoice is overdue
 */
function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
  if (!invoice.due_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(invoice.due_date);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

/**
 * useInvoices
 * Hook for fetching and managing invoices data
 */
export function useInvoices({
  getAuthToken,
  autoFetch = true
}: UseInvoicesOptions = {}): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate stats from invoices
  const stats: InvoiceStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: InvoiceStats = {
      total: invoices.length,
      pending: 0,
      paid: 0,
      overdue: 0
    };

    for (const invoice of invoices) {
      if (invoice.status === 'paid') {
        result.paid++;
      } else if (isOverdue(invoice)) {
        result.overdue++;
      } else if (['draft', 'sent', 'pending', 'viewed'].includes(invoice.status)) {
        result.pending++;
      }
    }

    return result;
  }, [invoices]);

  // Fetch invoices from API
  const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.INVOICES, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }

      const json = await response.json();
      const data = unwrapApiData<{ invoices: Invoice[] }>(json);
      setInvoices(data.invoices || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[useInvoices] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Update a single invoice
  const updateInvoice = useCallback(
    async (id: number, updates: Partial<Invoice>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ENDPOINTS.INVOICES}/${id}`, {
          method: 'PUT',
          headers: buildAuthHeaders(getAuthToken),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update invoice: ${response.statusText}`);
        }

        const json = await response.json();
        unwrapApiData<Invoice>(json);
        // Update local state optimistically
        setInvoices((prev) =>
          prev.map((invoice) => (invoice.id === id ? { ...invoice, ...updates } : invoice))
        );
        return true;
      } catch (err) {
        logger.error('[useInvoices] Update error:', err);
        return false;
      }
    },
    [getAuthToken]
  );

  // Mark invoice as paid
  const markAsPaid = useCallback(
    async (id: number): Promise<boolean> => {
      return updateInvoice(id, {
        status: 'paid',
        paid_date: new Date().toISOString()
      });
    },
    [updateInvoice]
  );

  // Send invoice
  const sendInvoice = useCallback(
    async (id: number): Promise<boolean> => {
      return updateInvoice(id, { status: 'sent' });
    },
    [updateInvoice]
  );

  // Download invoice PDF
  const downloadPdf = useCallback(
    async (id: number): Promise<void> => {
      try {
        const token = getAuthToken?.();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_ENDPOINTS.INVOICES}/${id}/pdf`, {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.statusText}`);
        }

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `invoice-${id}.pdf`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }

        // Create blob and trigger download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        logger.error('[useInvoices] Download PDF error:', err);
        throw err;
      }
    },
    [getAuthToken]
  );

  // Delete multiple invoices
  const bulkDelete = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          const response = await fetch(`${API_ENDPOINTS.INVOICES}/${id}`, {
            method: 'DELETE',
            headers: buildAuthHeaders(getAuthToken),
            credentials: 'include'
          });

          if (response.ok) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      // Remove deleted invoices from local state
      if (success > 0) {
        setInvoices((prev) => prev.filter((invoice) => !ids.includes(invoice.id)));
      }

      return { success, failed };
    },
    [getAuthToken]
  );

  // Bulk mark as paid
  const bulkMarkPaid = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        const result = await markAsPaid(id);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed };
    },
    [markAsPaid]
  );

  // Bulk send invoices
  const bulkSend = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        const result = await sendInvoice(id);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed };
    },
    [sendInvoice]
  );

  // Auto-fetch on mount with AbortController cleanup
  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    fetchInvoices(controller.signal);
    return () => controller.abort();
  }, [autoFetch, fetchInvoices]);

  return {
    invoices,
    isLoading,
    error,
    stats,
    refetch: fetchInvoices,
    updateInvoice,
    markAsPaid,
    sendInvoice,
    downloadPdf,
    bulkDelete,
    bulkMarkPaid,
    bulkSend
  };
}
