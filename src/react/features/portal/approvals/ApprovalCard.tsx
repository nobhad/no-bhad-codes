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
  proposal: <FileText className="icon-xs" />,
  invoice: <Receipt className="icon-xs" />,
  contract: <FileSignature className="icon-xs" />,
  deliverable: <Package className="icon-xs" />,
  project: <FolderOpen className="icon-xs" />
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
  const entityIcon = ENTITY_ICONS[approval.entity_type] || <FileText className="icon-xs" />;
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
        className={cn('portal-card', onNavigate && 'card-clickable', overdue && 'text-status-cancelled')}
        onClick={onNavigate ? handleCardClick : undefined}
      >
        {/* Header */}
        <div className="portal-card-header">
          <div className="portal-card-title-group">
            {/* Entity type icon */}
            <div className="text-muted">{entityIcon}</div>

            <div className="flex flex-col gap-0.5">
              <span className="text-primary text-sm">
                {approval.entity_name || `${entityLabel} #${approval.entity_id}`}
              </span>
              <span className="label text-xs">{entityLabel}</span>
            </div>
          </div>

          {/* Status badge */}
          <div className="portal-card-status-group">
            <span className="badge">{approval.status}</span>
          </div>
        </div>

        {/* Description */}
        {approval.description && (
          <p className="text-muted text-sm mb-2">
            {approval.description}
          </p>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Requested date */}
          <div className="flex items-center gap-1 text-muted">
            <Clock className="icon-xs" />
            <span className="text-xs">Requested {formatCardDate(approval.requested_at)}</span>
          </div>

          {/* Due date indicator */}
          {dueDaysText && (
            <div className={cn('flex items-center gap-1', overdue ? 'text-primary' : 'text-muted')}>
              {overdue && <AlertCircle className="icon-xs" />}
              <span className="text-xs">{dueDaysText}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={disabled} onClick={() => setShowApproveDialog(true)}>
              <Check className="icon-xs" />
              Approve
            </button>
            <button className="btn-secondary" disabled={disabled} onClick={() => setShowRejectDialog(true)}>
              <X className="icon-xs" />
              Reject
            </button>
          </div>

          {/* View detail link */}
          {onNavigate && (
            <button className="btn-ghost text-sm" onClick={handleCardClick}>
              View Details
              <ChevronRight className="icon-xs" />
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
