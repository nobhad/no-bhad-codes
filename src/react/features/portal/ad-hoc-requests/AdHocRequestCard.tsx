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
import { formatCardDate, formatCurrency } from '@react/utils/cardFormatters';
import { ConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { buildEndpoint } from '@/constants/api-endpoints';
import type { AdHocRequest } from './types';
import {
  AD_HOC_REQUEST_STATUS_CONFIG,
  AD_HOC_REQUEST_PRIORITY_CONFIG,
  AD_HOC_REQUEST_TYPE_CONFIG
} from './types';

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

  const quotedPrice = request.quotedPrice ?? null;
  const hasQuote = quotedPrice !== null && quotedPrice > 0;
  const canRespond = request.status === 'quoted' && hasQuote;
  const hasAttachment = !!request.attachmentFileId;
  const estimatedHours = request.estimatedHours ?? 0;
  const hourlyRate = request.hourlyRate ?? 0;
  const flatRate = request.flatRate ?? 0;

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
            <div className="portal-card-meta-item gap-2">
              <h3 className="text-primary font-semibold">
                {request.title}
              </h3>
              {hasAttachment && (
                <Paperclip className="icon-xs flex-shrink-0" />
              )}
            </div>
            <div className="portal-card-meta">
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
              <span className="text-secondary">
                {formatCardDate(request.createdAt)}
              </span>
            </div>
          </div>

          <div className="portal-card-status-group">
            {hasQuote && (
              <span className="text-primary font-semibold">
                {formatCurrency(quotedPrice!)}
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
          <div className="section border-t mt-3">
            {/* Description */}
            <div>
              <label className="field-label">Description</label>
              <p className="text-secondary mt-1 whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            {/* Type */}
            <div className="portal-card-meta-item">
              <span className="text-secondary">
                {AD_HOC_REQUEST_TYPE_CONFIG[request.requestType]?.label || request.requestType}
              </span>
            </div>

            {/* Project */}
            {request.projectName && (
              <div className="portal-card-meta-item">
                <FileText className="icon-xs" />
                <span>
                  Project: {request.projectName}
                </span>
              </div>
            )}

            {/* Attachment */}
            {hasAttachment && (
              <div>
                <label className="field-label">Attachment</label>
                <div className="mt-1 list-item justify-between">
                  <div className="portal-card-meta-item card-content-truncate">
                    <Paperclip className="icon-xs flex-shrink-0" />
                    <span className="text-primary">Attached file</span>
                  </div>
                  <a
                    href={buildEndpoint.fileDownload(request.attachmentFileId!)}
                    className="icon-btn"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Download attachment"
                  >
                    <Download className="icon-xs" />
                  </a>
                </div>
              </div>
            )}

            {/* Quote Details */}
            {hasQuote && (
              <div className="panel">
                <label className="field-label">Quote Details</label>
                <div className="mt-2 portal-card-detail-list">
                  {/* Hours and Rate */}
                  {estimatedHours > 0 && hourlyRate > 0 && (
                    <div className="portal-card-detail-row">
                      <div className="portal-card-meta-item">
                        <Clock className="icon-xs" />
                        <span>
                          Estimated Hours
                        </span>
                      </div>
                      <span className="text-primary">
                        {estimatedHours}h @ {formatCurrency(hourlyRate)}/hr
                      </span>
                    </div>
                  )}

                  {/* Flat Fee */}
                  {flatRate > 0 && (
                    <div className="portal-card-detail-row">
                      <div className="portal-card-meta-item">
                        <DollarSign className="icon-xs" />
                        <span>
                          Flat Fee
                        </span>
                      </div>
                      <span className="text-primary">
                        {formatCurrency(flatRate)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="portal-card-detail-row mt-2 border-t">
                    <span className="text-primary font-semibold">
                      Total
                    </span>
                    <span className="text-primary font-bold">
                      {formatCurrency(quotedPrice!)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Estimate pending — priced but not yet quoted */}
            {!hasQuote && estimatedHours > 0 && (
              <div className="portal-card-meta-item">
                <Clock className="icon-xs" />
                <span>Estimated at {estimatedHours}h — quote to follow</span>
              </div>
            )}

            {/* Actions */}
            {canRespond && (
              <div className="action-group mt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={disabled || isLoading}
                >
                  <X className="icon-xs" />
                  Decline
                </button>
                <button
                  className="btn-primary"
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
        description={`Are you sure you want to approve this quote${hasQuote ? ` for ${formatCurrency(quotedPrice!)}` : ''}? Work will begin after approval.`}
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
