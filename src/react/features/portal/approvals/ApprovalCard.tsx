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
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Check if approval is overdue
 */
function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/**
 * Get days until due or days overdue
 */
function getDueDaysText(dueDate: string | undefined): string | null {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else {
    return `Due in ${diffDays} days`;
  }
}

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Entity type icon */}
            <div className="tw-text-muted">{entityIcon}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <span className="tw-text-primary" style={{ fontSize: '14px' }}>
                {approval.entity_name || `${entityLabel} #${approval.entity_id}`}
              </span>
              <span className="tw-label" style={{ fontSize: '11px' }}>{entityLabel}</span>
            </div>
          </div>

          {/* Status badge */}
          <span className="tw-badge">{approval.status}</span>
        </div>

        {/* Description */}
        {approval.description && (
          <p className="tw-text-muted" style={{ fontSize: '12px', marginBottom: '0.5rem' }}>
            {approval.description}
          </p>
        )}

        {/* Meta info row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {/* Requested date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="tw-text-muted">
            <Clock className="tw-h-3 tw-w-3" />
            <span style={{ fontSize: '11px' }}>Requested {formatDate(approval.requested_at)}</span>
          </div>

          {/* Due date indicator */}
          {dueDaysText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className={overdue ? 'tw-text-primary' : 'tw-text-muted'}>
              {overdue && <AlertCircle className="tw-h-3 tw-w-3" />}
              <span style={{ fontSize: '11px' }}>{dueDaysText}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="tw-btn-primary" disabled={disabled} onClick={() => setShowApproveDialog(true)}>
              <Check className="tw-h-4 tw-w-4" />
              Approve
            </button>
            <button className="tw-btn-secondary" disabled={disabled} onClick={() => setShowRejectDialog(true)}>
              <X className="tw-h-4 tw-w-4" />
              Reject
            </button>
          </div>

          {/* View detail link */}
          {onNavigate && (
            <button className="tw-btn-ghost" onClick={handleCardClick} style={{ fontSize: '12px' }}>
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
