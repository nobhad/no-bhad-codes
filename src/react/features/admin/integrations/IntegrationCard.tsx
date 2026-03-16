/**
 * Integration Card
 * @file src/react/features/admin/integrations/IntegrationCard.tsx
 */

import * as React from 'react';
import { Zap } from 'lucide-react';
import {
  SERVICE_ICONS,
  getIntegrationHealthClass,
  formatDate,
  type IntegrationStatus
} from './types';

interface IntegrationCardProps {
  integration: IntegrationStatus;
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
  const icon = SERVICE_ICONS[integration.name] || <Zap className="icon-lg" />;
  const healthClass = getIntegrationHealthClass(integration.configured, integration.active);

  return (
    <div className="portal-card">
      <div className="stat-card">
        <div className="portal-card-header">
          <div className="portal-card-title-group">
            <span className="text-secondary">{icon}</span>
            <h3><span className="title-full">{integration.name}</span></h3>
          </div>
          <span className={healthClass} />
        </div>
        <div className="portal-card-detail-list">
          <div className="portal-card-detail-row">
            <span className="text-secondary">Configured</span>
            <span>{integration.configured ? 'Yes' : 'No'}</span>
          </div>
          <div className="portal-card-detail-row">
            <span className="text-secondary">Active</span>
            <span>{integration.active ? 'Yes' : 'No'}</span>
          </div>
          <div className="portal-card-detail-row">
            <span className="text-secondary">Last Activity</span>
            <span>{formatDate(integration.lastActivity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
