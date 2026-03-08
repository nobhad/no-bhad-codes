/**
 * useProjectInvoices
 * Handles fetching invoices and computing financial summaries for a project.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Invoice } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, buildAuthHeaders } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectInvoices');

/** Invoice statuses excluded from outstanding balance calculation */
const EXCLUDED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'draft']);
const PAID_STATUS = 'paid';

interface InvoiceFinancials {
  outstandingBalance: number;
  totalPaid: number;
}

interface UseProjectInvoicesReturn {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  outstandingBalance: number;
  totalPaid: number;
  fetchInvoices: () => Promise<Invoice[]>;
}

/** Safely parse a numeric value that may arrive as a string from the API */
function parseAmount(value: string | number | undefined | null): number {
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value || 0;
}

export function useProjectInvoices({
  projectId,
  getAuthToken
}: ProjectDetailHookOptions): UseProjectInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const { outstandingBalance, totalPaid } = useMemo<InvoiceFinancials>(() => {
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
      const response = await fetch(`${API_ENDPOINTS.INVOICES}/project/${projectId}`, {
        method: 'GET',
        headers: buildAuthHeaders(getAuthToken),
        credentials: 'include'
      });

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
  }, [projectId, getAuthToken]);

  return {
    invoices,
    setInvoices,
    outstandingBalance,
    totalPaid,
    fetchInvoices
  };
}
