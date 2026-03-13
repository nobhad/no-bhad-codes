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
          <div className="text-muted"><FileSignature className="icon-xs" /></div>
          <div className="flex flex-col gap-0.5">
            <span className="text-primary text-sm">
              {contract.projectName || `Contract #${contract.id}`}
            </span>
            {contract.projectName && (
              <span className="label text-xs">
                <FolderOpen className="icon-xs inline mr-0.5" />
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
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {contract.signedAt && (
          <div className="flex items-center gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="text-xs">Signed {formatCardDate(contract.signedAt)}</span>
          </div>
        )}

        {!contract.signedAt && contract.createdAt && (
          <div className="flex items-center gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="text-xs">Created {formatCardDate(contract.createdAt)}</span>
          </div>
        )}

        {dueDaysText && (
          <div className={cn('flex items-center gap-1', overdue ? 'text-primary' : 'text-muted')}>
            <span className="text-xs">{dueDaysText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {canSign && onSign && (
          <button className="btn-primary text-sm" onClick={handleSignClick}>
            <PenTool size={14} />
            Sign
          </button>
        )}
        {onNavigate && (
          <button className="btn-ghost text-sm" onClick={handleClick}>
            View Contract
            <ChevronRight className="icon-xs" />
          </button>
        )}
      </div>
    </div>
  );
});
