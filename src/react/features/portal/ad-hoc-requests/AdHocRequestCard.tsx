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
import { formatDate, formatCurrency, formatFileSize } from '@react/utils/cardFormatters';
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
          className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="tw-flex-1 card-content-truncate">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
              <h3 className="tw-text-primary tw-text-sm tw-font-semibold">
                {request.title}
              </h3>
              {hasAttachments && (
                <Paperclip className="tw-h-3 tw-w-3 tw-text-muted tw-shrink-0" />
              )}
            </div>
            <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
              <span className="tw-badge">
                {AD_HOC_REQUEST_STATUS_CONFIG[request.status]?.label || request.status}
              </span>
              <span
                className="tw-badge"
                style={{ color: AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.color }}
              >
                {AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.label || request.priority}
              </span>
              <span className="tw-text-muted tw-text-xs">
                {formatDate(request.created_at)}
              </span>
            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            {hasQuote && (
              <span className="tw-text-primary tw-text-sm tw-font-semibold">
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
          <div className="tw-divider tw-flex tw-flex-col tw-gap-3 tw-mt-3 tw-pt-3">
            {/* Description */}
            <div>
              <label className="tw-label">Description</label>
              <p className="tw-text-secondary tw-text-sm tw-mt-1 tw-whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            {/* Project */}
            {request.project_name && (
              <div className="tw-flex tw-items-center tw-gap-2">
                <FileText className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                <span className="tw-text-secondary tw-text-xs">
                  Project: {request.project_name}
                </span>
              </div>
            )}

            {/* Attachments */}
            {hasAttachments && (
              <div>
                <label className="tw-label">Attachments</label>
                <div className="tw-mt-1 tw-flex tw-flex-col tw-gap-1">
                  {request.attachments!.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="tw-list-item tw-justify-between"
                    >
                      <div className="tw-flex tw-items-center tw-gap-2 card-content-truncate">
                        <Paperclip className="tw-h-3 tw-w-3 tw-text-muted tw-shrink-0" />
                        <span className="tw-text-primary tw-text-xs">
                          {attachment.filename}
                        </span>
                        <span className="tw-text-muted tw-text-xs">
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
              <div className="tw-panel tw-p-3">
                <label className="tw-label">Quote Details</label>
                <div className="tw-mt-2 tw-flex tw-flex-col tw-gap-2">
                  {/* Hours and Rate */}
                  {request.quote!.hours_estimated > 0 && (
                    <div className="tw-flex tw-items-center tw-justify-between">
                      <div className="tw-flex tw-items-center tw-gap-2">
                        <Clock className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                        <span className="tw-text-secondary tw-text-xs">
                          Estimated Hours
                        </span>
                      </div>
                      <span className="tw-text-primary tw-text-sm">
                        {request.quote!.hours_estimated}h @ {formatCurrency(request.quote!.hourly_rate)}/hr
                      </span>
                    </div>
                  )}

                  {/* Flat Fee */}
                  {request.quote!.flat_fee && request.quote!.flat_fee > 0 && (
                    <div className="tw-flex tw-items-center tw-justify-between">
                      <div className="tw-flex tw-items-center tw-gap-2">
                        <DollarSign className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                        <span className="tw-text-secondary tw-text-xs">
                          Flat Fee
                        </span>
                      </div>
                      <span className="tw-text-primary tw-text-sm">
                        {formatCurrency(request.quote!.flat_fee)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="tw-divider tw-flex tw-items-center tw-justify-between tw-pt-2 tw-mt-2">
                    <span className="tw-text-primary tw-text-xs tw-font-semibold">
                      Total
                    </span>
                    <span className="tw-text-primary tw-text-sm tw-font-bold">
                      {formatCurrency(request.quote!.total_amount)}
                    </span>
                  </div>

                  {/* Notes */}
                  {request.quote!.notes && (
                    <div className="tw-pt-2">
                      <span className="tw-text-muted tw-text-xs">Notes:</span>
                      <p className="tw-text-secondary tw-text-xs tw-mt-0.5">
                        {request.quote!.notes}
                      </p>
                    </div>
                  )}

                  {/* Expiry */}
                  {request.quote!.expires_at && (
                    <div className="tw-text-muted tw-text-xs">
                      Quote valid until: {formatDate(request.quote!.expires_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {canRespond && (
              <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-pt-2">
                <button
                  className="tw-btn-secondary tw-flex tw-items-center tw-gap-1.5"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={disabled || isLoading}
                >
                  <X className="tw-h-3.5 tw-w-3.5" />
                  Decline
                </button>
                <button
                  className="tw-btn-primary tw-flex tw-items-center tw-gap-1.5"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={disabled || isLoading}
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
          className="tw-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) setShowApproveDialog(false);
          }}
        >
          <div className="tw-modal">
            <h3 className="tw-heading">Approve Quote</h3>
            <p className="tw-text-secondary tw-text-sm tw-mt-2">
              Are you sure you want to approve this quote for {hasQuote ? formatCurrency(request.quote!.total_amount) : ''}? Work will begin after approval.
            </p>
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mt-4">
              <button
                className="tw-btn-secondary"
                onClick={() => setShowApproveDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="tw-btn-primary tw-flex tw-items-center tw-gap-1.5"
                onClick={handleApprove}
                disabled={isLoading}
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
          className="tw-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) setShowDeclineDialog(false);
          }}
        >
          <div className="tw-modal">
            <h3 className="tw-heading">Decline Quote</h3>
            <p className="tw-text-secondary tw-text-sm tw-mt-2">
              Are you sure you want to decline this quote? You can submit a new request if your requirements change.
            </p>
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mt-4">
              <button
                className="tw-btn-secondary"
                onClick={() => setShowDeclineDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="tw-btn-danger tw-flex tw-items-center tw-gap-1.5"
                onClick={handleDecline}
                disabled={isLoading}
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
