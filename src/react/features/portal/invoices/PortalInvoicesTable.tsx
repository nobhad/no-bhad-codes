/**
 * PortalInvoicesTable
 * Client portal invoices list with summary and actions
 */

import * as React from 'react';
import { useCallback } from 'react';
import { FileText, Inbox, RefreshCw, Eye, Download } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { usePortalInvoices } from '@react/hooks/usePortalInvoices';
import { useFadeIn } from '@react/hooks/useGsap';
import { PORTAL_INVOICE_STATUS_CONFIG } from '../types';
import type { PortalInvoice } from '../types';
import { createLogger } from '../../../../utils/logger';
import { buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalInvoicesTable');

interface PortalInvoicesTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * PortalInvoicesTable Component
 */
export function PortalInvoicesTable({
  getAuthToken,
  showNotification,
}: PortalInvoicesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const { invoices, summary, isLoading, error, refetch } = usePortalInvoices({
    getAuthToken,
  });

  // Auth headers helper for downloads
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  // Handle preview invoice
  const handlePreview = (invoice: PortalInvoice) => {
    window.open(`${buildEndpoint.invoicePdf(invoice.id)}?preview=true`, '_blank');
  };

  // Handle download invoice
  const handleDownload = async (invoice: PortalInvoice) => {
    try {
      const response = await fetch(buildEndpoint.invoicePdf(invoice.id), {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Error downloading invoice:', err);
      showNotification?.('Failed to download invoice', 'error');
    }
  };

  // Handle download receipt
  const handleDownloadReceipt = async (invoice: PortalInvoice) => {
    try {
      const receiptsResponse = await fetch(buildEndpoint.receiptsByInvoice(invoice.id), {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!receiptsResponse.ok) {
        throw new Error('Failed to fetch receipts');
      }

      const receiptsData = await receiptsResponse.json();
      const receipts = receiptsData.receipts || [];

      if (receipts.length === 0) {
        showNotification?.('No receipt found for this invoice', 'warning');
        return;
      }

      const latestReceipt = receipts[0];
      const pdfResponse = await fetch(buildEndpoint.receiptPdf(latestReceipt.id), {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!pdfResponse.ok) {
        throw new Error('Failed to download receipt');
      }

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${latestReceipt.receipt_number || invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification?.('Receipt downloaded successfully', 'success');
    } catch (err) {
      logger.error('Error downloading receipt:', err);
      showNotification?.('Failed to download receipt', 'error');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading invoices...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="btn-secondary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Summary Cards */}
      <div className="tw-grid-stats">
        <div className="tw-stat-card">
          <span className="tw-stat-label">Outstanding</span>
          <span className="tw-stat-value">{formatCurrency(summary.totalOutstanding)}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Total Paid</span>
          <span className="tw-stat-value">{formatCurrency(summary.totalPaid)}</span>
        </div>
      </div>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={<Inbox className="tw-h-6 tw-w-6" />}
          message="No invoices yet. Your first invoice will appear here once your project begins."
        />
      ) : (
        <table className="tw-table">
          <thead>
            <tr>
              <th className="tw-table-header">Invoice</th>
              <th className="tw-table-header">Project</th>
              <th className="tw-table-header">Date</th>
              <th className="tw-table-header tw-text-right">Amount</th>
              <th className="tw-table-header">Status</th>
              <th className="tw-table-header tw-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const showReceipt = invoice.status === 'paid' || invoice.status === 'partial';

              return (
                <tr key={invoice.id} className="tw-table-row">
                  <td className="tw-table-cell">{invoice.invoice_number}</td>
                  <td className="tw-table-cell tw-text-muted">{invoice.project_name || 'Project'}</td>
                  <td className="tw-table-cell tw-text-muted">{formatDate(invoice.created_at)}</td>
                  <td className="tw-table-cell tw-text-right">
                    {formatCurrency(invoice.amount_total)}
                  </td>
                  <td className="tw-table-cell">
                    <span className="tw-badge">
                      {PORTAL_INVOICE_STATUS_CONFIG[invoice.status]?.label || invoice.status}
                    </span>
                  </td>
                  <td className="tw-table-cell tw-text-right">
                    <div className="tw-flex tw-justify-end tw-gap-1">
                      <button
                        className="btn-icon"
                        onClick={() => handlePreview(invoice)}
                        title="Preview"
                      >
                        <Eye className="tw-h-4 tw-w-4" />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDownload(invoice)}
                        title="Download Invoice"
                      >
                        <Download className="tw-h-4 tw-w-4" />
                      </button>
                      {showReceipt && (
                        <button
                          className="btn-icon"
                          onClick={() => handleDownloadReceipt(invoice)}
                          title="Download Receipt"
                        >
                          <FileText className="tw-h-4 tw-w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
