/**
 * ApprovalCard
 * Approval item card with entity info and actions
 */

import * as React from 'react';
import { useState } from 'react';
import {
  FileText,
  Receipt,
  FileSignature,
  Package,
  FolderOpen,
  Clock,
  AlertCircle,
  Check,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, isOverdue, getDueDaysText } from '@react/utils/cardFormatters';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { ConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { PendingApproval, ApprovalEntityType } from './types';

interface ApprovalCardProps {
  /** The approval request data */
  approval: PendingApproval;
  /** Callback when approval is submitted */
  onApprove: (id: number, comment?: string) => Promise<void>;
  /** Callback when rejection is submitted */
  onReject: (id: number, comment?: string) => Promise<void>;
  /** Callback to navigate to entity detail */
  onNavigate?: (entityType: string, entityId: string) => void;
  /** Whether actions are currently loading */
  isSubmitting?: boolean;
}

/** Entity type icon mapping */
const ENTITY_ICONS: Record<ApprovalEntityType, React.ReactNode> = {
  proposal: <FileText className="tw-h-3.5 tw-w-3.5" />,
  invoice: <Receipt className="tw-h-3.5 tw-w-3.5" />,
  contract: <FileSignature className="tw-h-3.5 tw-w-3.5" />,
  deliverable: <Package className="tw-h-3.5 tw-w-3.5" />,
  project: <FolderOpen className="tw-h-3.5 tw-w-3.5" />
};

/** Entity type display labels */
const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  proposal: 'Proposal',
  invoice: 'Invoice',
  contract: 'Contract',
  deliverable: 'Deliverable',
  project: 'Project'
};

/**
 * ApprovalCard Component
 */
export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onNavigate,
  isSubmitting = false
}: ApprovalCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const overdue = isOverdue(approval.due_by);
  const dueDaysText = getDueDaysText(approval.due_by);
  const entityIcon = ENTITY_ICONS[approval.entity_type] || <FileText className="tw-h-3.5 tw-w-3.5" />;
  const entityLabel = ENTITY_LABELS[approval.entity_type] || approval.entity_type;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(approval.id);
    } finally {
      setIsProcessing(false);
      setShowApproveDialog(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(approval.id);
    } finally {
      setIsProcessing(false);
      setShowRejectDialog(false);
    }
  };

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate(approval.entity_type, String(approval.entity_id));
    }
  };

  const disabled = isSubmitting || isProcessing;

  return (
    <>
      <div
        className={cn('tw-card', onNavigate && 'tw-card-hover')}
        style={{ borderColor: overdue ? 'var(--portal-text-light)' : undefined }}
        onClick={onNavigate ? handleCardClick : undefined}
      >
        {/* Header */}
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-2">
          <div className="tw-flex tw-items-center tw-gap-2">
            {/* Entity type icon */}
            <div className="tw-text-muted">{entityIcon}</div>

            <div className="tw-flex tw-flex-col tw-gap-0.5">
              <span className="tw-text-primary tw-text-sm">
                {approval.entity_name || `${entityLabel} #${approval.entity_id}`}
              </span>
              <span className="tw-label tw-text-xs">{entityLabel}</span>
            </div>
          </div>

          {/* Status badge */}
          <span className="tw-badge">{approval.status}</span>
        </div>

        {/* Description */}
        {approval.description && (
          <p className="tw-text-muted tw-text-sm tw-mb-2">
            {approval.description}
          </p>
        )}

        {/* Meta info row */}
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3">
          {/* Requested date */}
          <div className="tw-flex tw-items-center tw-gap-1 tw-text-muted">
            <Clock className="tw-h-3 tw-w-3" />
            <span className="tw-text-xs">Requested {formatCardDate(approval.requested_at)}</span>
          </div>

          {/* Due date indicator */}
          {dueDaysText && (
            <div className={cn('tw-flex tw-items-center tw-gap-1', overdue ? 'tw-text-primary' : 'tw-text-muted')}>
              {overdue && <AlertCircle className="tw-h-3 tw-w-3" />}
              <span className="tw-text-xs">{dueDaysText}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="tw-flex tw-items-center tw-gap-2">
            <button className="btn-primary" disabled={disabled} onClick={() => setShowApproveDialog(true)}>
              <Check className="tw-h-4 tw-w-4" />
              Approve
            </button>
            <button className="btn-secondary" disabled={disabled} onClick={() => setShowRejectDialog(true)}>
              <X className="tw-h-4 tw-w-4" />
              Reject
            </button>
          </div>

          {/* View detail link */}
          {onNavigate && (
            <button className="btn-ghost tw-text-sm" onClick={handleCardClick}>
              View Details
              <ChevronRight className="tw-h-3 tw-w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Approve confirmation dialog */}
      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title="Approve Request"
        description={`Are you sure you want to approve this ${entityLabel.toLowerCase()}? This action cannot be undone.`}
        confirmText="Approve"
        variant="info"
        loading={isProcessing}
        onConfirm={handleApprove}
      />

      {/* Reject confirmation dialog */}
      <ConfirmDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        title="Reject Request"
        description={`Are you sure you want to reject this ${entityLabel.toLowerCase()}? You may be asked to provide feedback.`}
        confirmText="Reject"
        variant="danger"
        loading={isProcessing}
        onConfirm={handleReject}
      />
    </>
  );
}
