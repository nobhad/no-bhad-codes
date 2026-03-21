/**
 * useProjectInvoices
 * Handles fetching invoices, computing financial summaries,
 * and invoice mutations (send, mark paid, delete, download) for a project.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Invoice } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiFetch, apiPut, apiDelete, unwrapApiData } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectInvoices');

/** Invoice statuses excluded from outstanding balance calculation */
const EXCLUDED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'draft']);
const PAID_STATUS = 'paid';

interface UseProjectInvoicesReturn {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  outstandingBalance: number;
  totalPaid: number;
  fetchInvoices: () => Promise<Invoice[]>;
  sendInvoice: (id: number) => Promise<boolean>;
  markAsPaid: (id: number) => Promise<boolean>;
  deleteInvoice: (id: number) => Promise<boolean>;
  downloadPdf: (id: number) => Promise<void>;
}

/** Safely parse a numeric value that may arrive as a string from the API */
function parseAmount(value: string | number | undefined | null): number {
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value || 0;
}

export function useProjectInvoices({
  projectId
}: ProjectDetailHookOptions): UseProjectInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const { outstandingBalance, totalPaid } = useMemo(() => {
    let outstanding = 0;
    let paid = 0;

    for (const invoice of invoices) {
      const total = parseAmount(invoice.amount_total);
      const amountPaid = parseAmount(invoice.amount_paid);

      if (invoice.status === PAID_STATUS) {
        paid += total;
      } else if (!EXCLUDED_STATUSES.has(invoice.status || '')) {
        outstanding += total - amountPaid;
        paid += amountPaid;
      }
    }

    return { outstandingBalance: outstanding, totalPaid: paid };
  }, [invoices]);

  const fetchInvoices = useCallback(async (): Promise<Invoice[]> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.INVOICES}/project/${projectId}`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ invoices: Invoice[] }>(json);
      return parsed.invoices || [];
    } catch (err) {
      logger.error('Error fetching invoices:', err);
      return [];
    }
  }, [projectId]);

  const sendInvoice = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await apiPut(`${API_ENDPOINTS.INVOICES}/${id}`, { status: 'sent' });
      if (!response.ok) return false;
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: 'sent' } : inv)));
      return true;
    } catch (err) {
      logger.error('Send invoice error:', err);
      return false;
    }
  }, []);

  const markAsPaid = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await apiPut(`${API_ENDPOINTS.INVOICES}/${id}`, {
        status: 'paid',
        paid_date: new Date().toISOString()
      });
      if (!response.ok) return false;
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'paid', paid_date: new Date().toISOString() } : inv))
      );
      return true;
    } catch (err) {
      logger.error('Mark paid error:', err);
      return false;
    }
  }, []);

  const deleteInvoice = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await apiDelete(`${API_ENDPOINTS.INVOICES}/${id}`);
      if (!response.ok) return false;
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      return true;
    } catch (err) {
      logger.error('Delete invoice error:', err);
      return false;
    }
  }, []);

  const downloadPdf = useCallback(async (id: number): Promise<void> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.INVOICES}/${id}/pdf`);
      if (!response.ok) throw new Error('Failed to download PDF');

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `invoice-${id}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

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
      logger.error('Download PDF error:', err);
      throw err;
    }
  }, []);

  return {
    invoices,
    setInvoices,
    outstandingBalance,
    totalPaid,
    fetchInvoices,
    sendInvoice,
    markAsPaid,
    deleteInvoice,
    downloadPdf
  };
}
