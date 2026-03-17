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
          <div className="text-secondary"><Package className="icon-xs" /></div>
          <div className="portal-card-title-group flex-col">
            <h3 className="text-primary">{deliverable.title}</h3>
            {deliverable.project_name && (
              <span className="label">
                <FolderOpen className="icon-xs inline" />
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
      <div className="portal-card-meta">
        {deliverable.type && (
          <div className="portal-card-meta-item">
            <Layers className="icon-xs" />
            <span>{deliverable.type}</span>
          </div>
        )}

        {deliverable.round_number > 1 && (
          <div className="portal-card-meta-item">
            <span>Round {deliverable.round_number}</span>
          </div>
        )}

        {deliverable.review_deadline && (
          <div className="portal-card-meta-item">
            <Calendar className="icon-xs" />
            <span>Due {formatCardDate(deliverable.review_deadline)}</span>
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
        <div className="action-group">
          <button className="btn-ghost" onClick={handleClick}>
            View Deliverable
            <ChevronRight className="icon-xs" />
          </button>
        </div>
      )}
    </div>
  );
});
