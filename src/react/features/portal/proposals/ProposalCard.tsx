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

export const ProposalCard = React.memo(({ proposal, onNavigate }: ProposalCardProps) => {
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
          <div className="text-secondary"><FileText className="icon-xs" /></div>
          <div className="portal-card-title-group flex-col">
            <h3 className="text-primary">{proposal.title}</h3>
            {proposal.projectType && (
              <span className="label">{proposal.projectType}</span>
            )}
          </div>
        </div>

        <div className="portal-card-status-group">
          <StatusBadge status={getStatusVariant(proposal.status)}>{proposal.status}</StatusBadge>
        </div>
      </div>

      {/* Meta row */}
      <div className="portal-card-meta">
        {proposal.amount != null && (
          <div className="portal-card-meta-item">
            <DollarSign className="icon-xs" />
            <span>{formatCurrency(proposal.amount)}</span>
          </div>
        )}

        {proposal.selectedTier && (
          <div className="portal-card-meta-item">
            <Layers className="icon-xs" />
            <span>{proposal.selectedTier}</span>
          </div>
        )}

        {proposal.sentAt && (
          <div className="portal-card-meta-item">
            <Calendar className="icon-xs" />
            <span>Sent {formatCardDate(proposal.sentAt)}</span>
          </div>
        )}

        {dueDaysText && (
          <div className={cn('portal-card-meta-item', overdue && 'text-primary')}>
            <span>{dueDaysText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {onNavigate && (
        <div className="portal-card-actions">
          <button className="btn-ghost" onClick={handleClick}>
            View Proposal
            <ChevronRight className="icon-xs" />
          </button>
        </div>
      )}
    </div>
  );
});
