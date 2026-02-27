/**
 * AdHocRequestCard
 * Card component displaying ad-hoc request details with quote and actions
 */

import * as React from 'react';
import { useState } from 'react';
import {
  Clock,
  DollarSign,
  FileText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { AdHocRequest } from './types';
import { AD_HOC_REQUEST_STATUS_CONFIG, AD_HOC_REQUEST_PRIORITY_CONFIG } from './types';

export interface AdHocRequestCardProps {
  /** The ad-hoc request data */
  request: AdHocRequest;
  /** Callback when quote is approved */
  onApprove?: (requestId: number) => Promise<void>;
  /** Callback when quote is declined */
  onDecline?: (requestId: number) => Promise<void>;
  /** Whether actions are disabled */
  disabled?: boolean;
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
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * AdHocRequestCard Component
 */
export function AdHocRequestCard({
  request,
  onApprove,
  onDecline,
  disabled = false,
}: AdHocRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasQuote = !!request.quote;
  const canRespond = request.status === 'quoted' && hasQuote;
  const hasAttachments = request.attachments && request.attachments.length > 0;

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsLoading(true);
    try {
      await onApprove(request.id);
    } finally {
      setIsLoading(false);
      setShowApproveDialog(false);
    }
  };

  const handleDecline = async () => {
    if (!onDecline) return;
    setIsLoading(true);
    try {
      await onDecline(request.id);
    } finally {
      setIsLoading(false);
      setShowDeclineDialog(false);
    }
  };

  return (
    <>
      <div className="tw-card">
        {/* Header */}
        <div
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 className="tw-text-primary" style={{ fontSize: '12px', fontWeight: 500 }}>
                {request.title}
              </h3>
              {hasAttachments && (
                <Paperclip className="tw-h-3 tw-w-3 tw-text-muted" style={{ flexShrink: 0 }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="tw-badge">
                {AD_HOC_REQUEST_STATUS_CONFIG[request.status]?.label || request.status}
              </span>
              <span
                className="tw-badge"
                style={{ color: AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.color }}
              >
                {AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.label || request.priority}
              </span>
              <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                {formatDate(request.created_at)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {hasQuote && (
              <span className="tw-text-primary" style={{ fontSize: '12px', fontWeight: 500 }}>
                {formatCurrency(request.quote!.total_amount)}
              </span>
            )}
            <button
              type="button"
              className="tw-btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronUp className="tw-h-3.5 tw-w-3.5" />
              ) : (
                <ChevronDown className="tw-h-3.5 tw-w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="tw-divider" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
            {/* Description */}
            <div>
              <label className="tw-label">Description</label>
              <p className="tw-text-secondary" style={{ fontSize: '12px', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                {request.description}
              </p>
            </div>

            {/* Project */}
            {request.project_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                <span className="tw-text-secondary" style={{ fontSize: '11px' }}>
                  Project: {request.project_name}
                </span>
              </div>
            )}

            {/* Attachments */}
            {hasAttachments && (
              <div>
                <label className="tw-label">Attachments</label>
                <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {request.attachments!.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="tw-list-item"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <Paperclip className="tw-h-3 tw-w-3 tw-text-muted" style={{ flexShrink: 0 }} />
                        <span className="tw-text-primary" style={{ fontSize: '11px' }}>
                          {attachment.filename}
                        </span>
                        <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                          ({formatFileSize(attachment.file_size)})
                        </span>
                      </div>
                      {attachment.download_url && (
                        <a
                          href={attachment.download_url}
                          download={attachment.filename}
                          className="tw-btn-icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="tw-h-3 tw-w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quote Details */}
            {hasQuote && (
              <div className="tw-panel" style={{ padding: '0.75rem' }}>
                <label className="tw-label">Quote Details</label>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Hours and Rate */}
                  {request.quote!.hours_estimated > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                        <span className="tw-text-secondary" style={{ fontSize: '11px' }}>
                          Estimated Hours
                        </span>
                      </div>
                      <span className="tw-text-primary" style={{ fontSize: '12px' }}>
                        {request.quote!.hours_estimated}h @ {formatCurrency(request.quote!.hourly_rate)}/hr
                      </span>
                    </div>
                  )}

                  {/* Flat Fee */}
                  {request.quote!.flat_fee && request.quote!.flat_fee > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                        <span className="tw-text-secondary" style={{ fontSize: '11px' }}>
                          Flat Fee
                        </span>
                      </div>
                      <span className="tw-text-primary" style={{ fontSize: '12px' }}>
                        {formatCurrency(request.quote!.flat_fee)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="tw-divider" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <span className="tw-text-primary" style={{ fontSize: '11px', fontWeight: 500 }}>
                      Total
                    </span>
                    <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {formatCurrency(request.quote!.total_amount)}
                    </span>
                  </div>

                  {/* Notes */}
                  {request.quote!.notes && (
                    <div style={{ paddingTop: '0.5rem' }}>
                      <span className="tw-text-muted" style={{ fontSize: '10px' }}>Notes:</span>
                      <p className="tw-text-secondary" style={{ fontSize: '11px', marginTop: '0.125rem' }}>
                        {request.quote!.notes}
                      </p>
                    </div>
                  )}

                  {/* Expiry */}
                  {request.quote!.expires_at && (
                    <div className="tw-text-muted" style={{ fontSize: '10px' }}>
                      Quote valid until: {formatDate(request.quote!.expires_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {canRespond && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                <button
                  className="tw-btn-secondary"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={disabled || isLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <X className="tw-h-3.5 tw-w-3.5" />
                  Decline
                </button>
                <button
                  className="tw-btn-primary"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={disabled || isLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <Check className="tw-h-3.5 tw-w-3.5" />
                  Approve Quote
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      {showApproveDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) setShowApproveDialog(false);
          }}
        >
          <div className="tw-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 className="tw-heading">Approve Quote</h3>
            <p className="tw-text-secondary" style={{ fontSize: '12px', marginTop: '0.5rem' }}>
              Are you sure you want to approve this quote for {hasQuote ? formatCurrency(request.quote!.total_amount) : ''}? Work will begin after approval.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="tw-btn-secondary"
                onClick={() => setShowApproveDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="tw-btn-primary"
                onClick={handleApprove}
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                {isLoading && <RefreshCw className="tw-h-3.5 tw-w-3.5 tw-animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Confirmation Dialog */}
      {showDeclineDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) setShowDeclineDialog(false);
          }}
        >
          <div className="tw-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 className="tw-heading">Decline Quote</h3>
            <p className="tw-text-secondary" style={{ fontSize: '12px', marginTop: '0.5rem' }}>
              Are you sure you want to decline this quote? You can submit a new request if your requirements change.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="tw-btn-secondary"
                onClick={() => setShowDeclineDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="tw-btn-primary"
                onClick={handleDecline}
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--status-cancelled)' }}
              >
                {isLoading && <RefreshCw className="tw-h-3.5 tw-w-3.5 tw-animate-spin" />}
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
