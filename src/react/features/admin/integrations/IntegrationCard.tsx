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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-muted">{icon}</span>
            <span className="font-semibold">{integration.name}</span>
          </div>
          <span className={healthClass} />
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Configured</span>
            <span>{integration.configured ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Active</span>
            <span>{integration.active ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Last Activity</span>
            <span>{formatDate(integration.lastActivity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
