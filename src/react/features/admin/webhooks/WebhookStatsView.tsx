/**
 * Webhook Stats View
 * @file src/react/features/admin/webhooks/WebhookStatsView.tsx
 */

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@react/factories';
import type { WebhookItem, WebhookStats } from './types';

interface WebhookStatsViewProps {
  containerRef: React.RefObject<HTMLElement | null>;
  selectedWebhook: WebhookItem;
  stats: WebhookStats;
  onBack: () => void;
  onRefresh: (webhookId: number) => void;
}

export function WebhookStatsView({
  containerRef,
  selectedWebhook,
  stats,
  onBack,
  onRefresh
}: WebhookStatsViewProps) {
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="portal-card">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h3 className="font-semibold">Stats: {selectedWebhook.name}</h3>
        <IconButton
          action="refresh"
          onClick={() => onRefresh(selectedWebhook.id)}
          title="Refresh"
        />
      </div>

      <div className="detail-grid">
        <div className="detail-row">
          <span className="detail-label">Total Deliveries</span>
          <span className="detail-value">{stats.total}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Successful</span>
          <span className="detail-value text-success">{stats.success}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Failed</span>
          <span className="detail-value text-danger">{stats.failed}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Pending</span>
          <span className="detail-value text-warning">{stats.pending}</span>
        </div>
        {stats.total > 0 && (
          <div className="detail-row">
            <span className="detail-label">Success Rate</span>
            <span className="detail-value">
              {Math.round((stats.success / stats.total) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
