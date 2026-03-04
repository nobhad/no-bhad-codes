/**
 * ContractCard
 * Card component for a single client contract
 */

import * as React from 'react';
import { FileSignature, Calendar, FolderOpen, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, isOverdue, getDueDaysText } from '@react/utils/cardFormatters';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { PortalContract } from './types';

interface ContractCardProps {
  contract: PortalContract;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function ContractCard({ contract, onNavigate }: ContractCardProps) {
  const overdue = isOverdue(contract.expiresAt ?? undefined);
  const dueDaysText = getDueDaysText(contract.expiresAt ?? undefined);

  const handleClick = () => {
    onNavigate?.('contract', String(contract.id));
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
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <span className="tw-text-primary tw-text-sm">
              {contract.projectName || `Contract #${contract.id}`}
            </span>
            {contract.projectName && (
              <span className="label tw-text-xs">
                <FolderOpen className="icon-xs tw-inline tw-mr-0.5" />
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
      <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap tw-mb-3">
        {contract.signedAt && (
          <div className="tw-flex tw-items-center tw-gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="tw-text-xs">Signed {formatCardDate(contract.signedAt)}</span>
          </div>
        )}

        {!contract.signedAt && contract.createdAt && (
          <div className="tw-flex tw-items-center tw-gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="tw-text-xs">Created {formatCardDate(contract.createdAt)}</span>
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
            View Contract
            <ChevronRight className="icon-xs" />
          </button>
        </div>
      )}
    </div>
  );
}
