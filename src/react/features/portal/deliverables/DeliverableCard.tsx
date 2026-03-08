/**
 * DeliverableCard
 * Card component for a single client deliverable
 */

import * as React from 'react';
import { Package, Calendar, FolderOpen, Layers, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, isOverdue, getDueDaysText } from '@react/utils/cardFormatters';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { PortalDeliverable } from './types';

interface DeliverableCardProps {
  deliverable: PortalDeliverable;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export const DeliverableCard = React.memo(({ deliverable, onNavigate }: DeliverableCardProps) => {
  const overdue = isOverdue(deliverable.review_deadline ?? undefined);
  const dueDaysText = getDueDaysText(deliverable.review_deadline ?? undefined);

  const handleClick = () => {
    onNavigate?.('deliverable', String(deliverable.id));
  };

  return (
    <div
      className={cn('portal-card', onNavigate && 'card-clickable')}
      onClick={onNavigate ? handleClick : undefined}
    >
      {/* Header */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <div className="text-muted"><Package className="icon-xs" /></div>
          <div className="flex flex-col gap-0.5">
            <span className="text-primary text-sm">{deliverable.title}</span>
            {deliverable.project_name && (
              <span className="label text-xs">
                <FolderOpen className="icon-xs inline mr-0.5" />
                {deliverable.project_name}
              </span>
            )}
          </div>
        </div>

        <div className="portal-card-status-group">
          <StatusBadge status={getStatusVariant(deliverable.status)}>
            {deliverable.approval_status || deliverable.status}
          </StatusBadge>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {deliverable.type && (
          <div className="flex items-center gap-1 text-muted">
            <Layers className="icon-xs" />
            <span className="text-xs">{deliverable.type}</span>
          </div>
        )}

        {deliverable.round_number > 1 && (
          <div className="flex items-center gap-1 text-muted">
            <span className="text-xs">Round {deliverable.round_number}</span>
          </div>
        )}

        {deliverable.review_deadline && (
          <div className="flex items-center gap-1 text-muted">
            <Calendar className="icon-xs" />
            <span className="text-xs">Due {formatCardDate(deliverable.review_deadline)}</span>
          </div>
        )}

        {dueDaysText && (
          <div className={cn('flex items-center gap-1', overdue ? 'text-primary' : 'text-muted')}>
            <span className="text-xs">{dueDaysText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {onNavigate && (
        <div className="flex justify-end">
          <button className="btn-ghost text-sm" onClick={handleClick}>
            View Deliverable
            <ChevronRight className="icon-xs" />
          </button>
        </div>
      )}
    </div>
  );
});
