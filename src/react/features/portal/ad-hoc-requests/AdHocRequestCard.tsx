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
  Download
} from 'lucide-react';
import { formatCardDate, formatCurrency, formatFileSize } from '@react/utils/cardFormatters';
import { ConfirmDialog } from '@react/components/portal/ConfirmDialog';
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
  disabled = false
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
      <div className="portal-card">
        {/* Header */}
        <div
          className="portal-card-header cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="portal-card-title-group flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm font-semibold">
                {request.title}
              </span>
              {hasAttachments && (
                <Paperclip className="icon-xs flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="badge">
                {AD_HOC_REQUEST_STATUS_CONFIG[request.status]?.label || request.status}
              </span>
              <span
                className="badge"
                data-priority={request.priority}
                style={{ color: AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.color }}
              >
                {AD_HOC_REQUEST_PRIORITY_CONFIG[request.priority]?.label || request.priority}
              </span>
              <span className="text-muted text-xs">
                {formatCardDate(request.created_at)}
              </span>
            </div>
          </div>

          <div className="portal-card-status-group">
            {hasQuote && (
              <span className="text-primary text-sm font-semibold">
                {formatCurrency(request.quote!.total_amount)}
              </span>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="icon-xs" />
              ) : (
                <ChevronDown className="icon-xs" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="section border-t border-[var(--color-border-primary)] mt-3">
            {/* Description */}
            <div>
              <label className="field-label">Description</label>
              <p className="text-muted text-sm mt-1 whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            {/* Project */}
            {request.project_name && (
              <div className="flex items-center gap-2">
                <FileText className="icon-xs" />
                <span className="text-muted text-xs">
                  Project: {request.project_name}
                </span>
              </div>
            )}

            {/* Attachments */}
            {hasAttachments && (
              <div>
                <label className="field-label">Attachments</label>
                <div className="mt-1 flex flex-col gap-1">
                  {request.attachments!.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="list-item justify-between"
                    >
                      <div className="flex items-center gap-2 card-content-truncate">
                        <Paperclip className="icon-xs flex-shrink-0" />
                        <span className="text-primary text-xs">
                          {attachment.filename}
                        </span>
                        <span className="text-muted text-xs">
                          ({formatFileSize(attachment.file_size)})
                        </span>
                      </div>
                      {attachment.download_url && (
                        <a
                          href={attachment.download_url}
                          download={attachment.filename}
                          className="icon-btn"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Download ${attachment.filename}`}
                        >
                          <Download className="icon-xs" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quote Details */}
            {hasQuote && (
              <div className="panel">
                <label className="field-label">Quote Details</label>
                <div className="mt-2 flex flex-col gap-2">
                  {/* Hours and Rate */}
                  {request.quote!.hours_estimated > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="icon-xs" />
                        <span className="text-muted text-xs">
                          Estimated Hours
                        </span>
                      </div>
                      <span className="text-primary text-sm">
                        {request.quote!.hours_estimated}h @ {formatCurrency(request.quote!.hourly_rate)}/hr
                      </span>
                    </div>
                  )}

                  {/* Flat Fee */}
                  {request.quote!.flat_fee && request.quote!.flat_fee > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="icon-xs" />
                        <span className="text-muted text-xs">
                          Flat Fee
                        </span>
                      </div>
                      <span className="text-primary text-sm">
                        {formatCurrency(request.quote!.flat_fee)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between mt-2 border-t border-[var(--color-border-primary)]">
                    <span className="text-primary text-xs font-semibold">
                      Total
                    </span>
                    <span className="text-primary text-sm font-bold">
                      {formatCurrency(request.quote!.total_amount)}
                    </span>
                  </div>

                  {/* Notes */}
                  {request.quote!.notes && (
                    <div className="mt-2">
                      <span className="text-muted text-xs">Notes:</span>
                      <p className="text-muted text-xs mt-0.5">
                        {request.quote!.notes}
                      </p>
                    </div>
                  )}

                  {/* Expiry */}
                  {request.quote!.expires_at && (
                    <div className="text-muted text-xs">
                      Quote valid until: {formatCardDate(request.quote!.expires_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {canRespond && (
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  className="btn-secondary flex items-center gap-1.5"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={disabled || isLoading}
                >
                  <X className="icon-xs" />
                  Decline
                </button>
                <button
                  className="btn-primary flex items-center gap-1.5"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={disabled || isLoading}
                >
                  <Check className="icon-xs" />
                  Approve Quote
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title="Approve Quote"
        description={`Are you sure you want to approve this quote${hasQuote ? ` for ${formatCurrency(request.quote!.total_amount)}` : ''}? Work will begin after approval.`}
        confirmText="Approve"
        variant="info"
        loading={isLoading}
        onConfirm={handleApprove}
      />

      {/* Decline Confirmation Dialog */}
      <ConfirmDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        title="Decline Quote"
        description="Are you sure you want to decline this quote? You can submit a new request if your requirements change."
        confirmText="Decline"
        variant="danger"
        loading={isLoading}
        onConfirm={handleDecline}
      />
    </>
  );
}
