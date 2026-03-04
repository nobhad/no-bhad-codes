/**
 * ProposalCard
 * Card component for a single client proposal
 */

import * as React from 'react';
import { FileText, Calendar, DollarSign, Layers, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, isOverdue, getDueDaysText } from '@react/utils/cardFormatters';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { formatCurrency } from '@react/factories';
import type { PortalProposal } from './types';

interface ProposalCardProps {
  proposal: PortalProposal;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function ProposalCard({ proposal, onNavigate }: ProposalCardProps) {
  const overdue = isOverdue(proposal.validUntil ?? undefined);
  const dueDaysText = getDueDaysText(proposal.validUntil ?? undefined);

  const handleClick = () => {
    onNavigate?.('proposal', String(proposal.id));
  };

  return (
    <div
      className={cn('portal-card', onNavigate && 'card-clickable')}
      onClick={onNavigate ? handleClick : undefined}
    >
      {/* Header */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <div className="text-muted"><FileText className="icon-xs" /></div>
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <span className="tw-text-primary tw-text-sm">{proposal.title}</span>
            {proposal.projectType && (
              <span className="label tw-text-xs">{proposal.projectType}</span>
            )}
          </div>
        </div>

        <div className="portal-card-status-group">
          <StatusBadge status={getStatusVariant(proposal.status)}>{proposal.status}</StatusBadge>
        </div>
      </div>

      {/* Meta row */}
      <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap tw-mb-3">
        {proposal.amount != null && (
          <div className="tw-flex tw-items-center tw-gap-1 text-muted">
            <DollarSign className="icon-xs" />
            <span className="tw-text-xs">{formatCurrency(proposal.amount)}</span>
          </div>
        )}

        {proposal.selectedTier && (
          <div className="tw-flex tw-items-center tw-gap-1 text-muted">
            <Layers className="icon-xs" />
            <span className="tw-text-xs">{proposal.selectedTier}</span>
          </div>
        )}

        {proposal.sentAt && (
          <div className="tw-flex tw-items-center tw-gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="tw-text-xs">Sent {formatCardDate(proposal.sentAt)}</span>
          </div>
        )}

        {dueDaysText && (
          <div className={cn('tw-flex tw-items-center tw-gap-1', overdue ? 'tw-text-primary' : 'text-muted')}>
            <span className="tw-text-xs">{dueDaysText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {onNavigate && (
        <div className="tw-flex tw-justify-end">
          <button className="btn-ghost tw-text-sm" onClick={handleClick}>
            View Proposal
            <ChevronRight className="icon-xs" />
          </button>
        </div>
      )}
    </div>
  );
}
