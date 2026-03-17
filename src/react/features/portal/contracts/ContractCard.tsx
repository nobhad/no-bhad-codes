/**
 * ContractCard
 * Card component for a single client contract
 */

import * as React from 'react';
import { FileSignature, Calendar, FolderOpen, ChevronRight, PenTool } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, isOverdue, getDueDaysText } from '@react/utils/cardFormatters';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { PortalContract } from './types';

/** Statuses that allow signing in the portal */
const SIGNABLE_STATUSES = new Set(['sent', 'viewed']);

interface ContractCardProps {
  contract: PortalContract;
  onNavigate?: (entityType: string, entityId: string) => void;
  onSign?: (contract: PortalContract) => void;
}

export const ContractCard = React.memo(({ contract, onNavigate, onSign }: ContractCardProps) => {
  const overdue = isOverdue(contract.expiresAt ?? undefined);
  const dueDaysText = getDueDaysText(contract.expiresAt ?? undefined);
  const canSign = SIGNABLE_STATUSES.has(contract.status);

  const handleClick = () => {
    onNavigate?.('contract', String(contract.id));
  };

  const handleSignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSign?.(contract);
  };

  return (
    <div
      className={cn('portal-card', onNavigate && 'card-clickable')}
      onClick={onNavigate ? handleClick : undefined}
    >
      {/* Header */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <div className="text-secondary"><FileSignature className="icon-xs" /></div>
          <div className="portal-card-title-group flex-col">
            <h3 className="text-primary">
              {contract.projectName || `Contract #${contract.id}`}
            </h3>
            {contract.projectName && (
              <span className="label">
                <FolderOpen className="icon-xs inline" />
                {contract.projectName}
              </span>
            )}
          </div>
        </div>

        <div className="portal-card-status-group">
          <StatusBadge status={getStatusVariant(contract.status)}>{contract.status}</StatusBadge>
        </div>
      </div>

      {/* Meta row */}
      <div className="portal-card-meta">
        {contract.signedAt && (
          <div className="portal-card-meta-item">
            <Calendar className="icon-xs" />
            <span>Signed {formatCardDate(contract.signedAt)}</span>
          </div>
        )}

        {!contract.signedAt && contract.createdAt && (
          <div className="portal-card-meta-item">
            <Calendar className="icon-xs" />
            <span>Created {formatCardDate(contract.createdAt)}</span>
          </div>
        )}

        {dueDaysText && (
          <div className={cn('portal-card-meta-item', overdue && 'text-primary')}>
            <span>{dueDaysText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="action-group">
        {canSign && onSign && (
          <button className="btn-primary" onClick={handleSignClick}>
            <PenTool />
            Sign
          </button>
        )}
        {onNavigate && (
          <button className="btn-ghost" onClick={handleClick}>
            View Contract
            <ChevronRight className="icon-xs" />
          </button>
        )}
      </div>
    </div>
  );
});
