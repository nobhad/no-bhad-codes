/**
 * PortalInvoicesTable
 * Client portal invoices list with summary and actions
 */

import * as React from 'react';
import { useCallback } from 'react';
import { Eye, Download, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { usePortalInvoices } from '@react/hooks/usePortalInvoices';
import { useFadeIn } from '@react/hooks/useGsap';
import { PORTAL_INVOICE_STATUS_CONFIG } from '../types';
import type { PortalInvoice } from '../types';

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
    window.open(`/api/invoices/${invoice.id}/pdf?preview=true`, '_blank');
  };

  // Handle download invoice
  const handleDownload = async (invoice: PortalInvoice) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
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
      console.error('Error downloading invoice:', err);
      showNotification?.('Failed to download invoice', 'error');
    }
  };

  // Handle download receipt
  const handleDownloadReceipt = async (invoice: PortalInvoice) => {
    try {
      const receiptsResponse = await fetch(`/api/receipts/invoice/${invoice.id}`, {
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
      const pdfResponse = await fetch(`/api/receipts/${latestReceipt.id}/pdf`, {
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
      console.error('Error downloading receipt:', err);
      showNotification?.('Failed to download receipt', 'error');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading invoices...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={refetch}>
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
        <div className="tw-empty-state">
          No invoices yet. Your first invoice will appear here once your project begins.
        </div>
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
                        className="tw-btn-icon"
                        onClick={() => handlePreview(invoice)}
                        title="Preview"
                      >
                        <Eye className="tw-h-4 tw-w-4" />
                      </button>
                      <button
                        className="tw-btn-icon"
                        onClick={() => handleDownload(invoice)}
                        title="Download Invoice"
                      >
                        <Download className="tw-h-4 tw-w-4" />
                      </button>
                      {showReceipt && (
                        <button
                          className="tw-btn-icon"
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
