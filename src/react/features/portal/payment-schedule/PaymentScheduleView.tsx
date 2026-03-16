/**
 * PaymentScheduleView
 * Client portal view for payment schedule installments.
 * Shows installments with status and a summary card.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatCurrency, formatDate } from '@react/factories/formatters';
import type { PortalViewProps } from '../types';

// ============================================
// TYPES
// ============================================

interface PaymentInstallment {
  id: number;
  installmentNumber: number;
  label: string | null;
  amount: number;
  dueDate: string;
  status: string;
  paidDate: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  projectName?: string;
}

interface PaymentSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  installmentCount: number;
  paidCount: number;
  overdueCount: number;
}

export interface PaymentScheduleViewProps extends PortalViewProps {}

// ============================================
// STATUS LABELS
// ============================================

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled'
};

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentScheduleView(_props: PaymentScheduleViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { data: installmentData, isLoading: loadingInstallments, error: installmentError, refetch } = usePortalData<{ installments: PaymentInstallment[] }>({
    url: API_ENDPOINTS.PAYMENT_SCHEDULES_MY
  });

  const { data: summaryData } = usePortalData<{ summary: PaymentSummary }>({
    url: API_ENDPOINTS.PAYMENT_SCHEDULES_MY_SUMMARY
  });

  const installments = useMemo(() => installmentData?.installments || [], [installmentData]);
  const summary = summaryData?.summary;

  if (loadingInstallments) return <div ref={containerRef}><LoadingState message="Loading payment schedule..." /></div>;
  if (installmentError) return <div ref={containerRef}><ErrorState message={installmentError} onRetry={refetch} /></div>;
  if (installments.length === 0) {
    return <div ref={containerRef}><EmptyState message="No payment schedule has been set up yet." /></div>;
  }

  return (
    <div ref={containerRef}>
      {/* Summary Card */}
      {summary && (
        <div className="card payment-summary-card">
          <div className="payment-summary-grid">
            <div>
              <span className="payment-stat-label">Total</span>
              <div className="payment-stat-value">{formatCurrency(summary.totalAmount)}</div>
            </div>
            <div>
              <span className="payment-stat-label">Paid</span>
              <div className="payment-stat-value payment-stat-value--success">{formatCurrency(summary.paidAmount)}</div>
            </div>
            <div>
              <span className="payment-stat-label">Remaining</span>
              <div className="payment-stat-value">{formatCurrency(summary.pendingAmount)}</div>
            </div>
            {summary.overdueAmount > 0 && (
              <div>
                <span className="payment-stat-label">Overdue</span>
                <div className="payment-stat-value payment-stat-value--danger">{formatCurrency(summary.overdueAmount)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Installments List */}
      <div className="card">
        {installments.map((inst) => (
          <div key={inst.id} className="payment-item-row">
            <div>
              <div className="payment-item-label">
                {inst.label || `Payment ${inst.installmentNumber}`}
              </div>
              <span className="payment-item-meta">
                Due {formatDate(inst.dueDate)}
                {inst.paidDate && ` - Paid ${formatDate(inst.paidDate)}`}
              </span>
            </div>
            <div className="payment-item-actions">
              <span className="payment-item-amount">{formatCurrency(inst.amount)}</span>
              <StatusBadge status={getStatusVariant(inst.status)}>
                {STATUS_LABELS[inst.status] || inst.status}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
