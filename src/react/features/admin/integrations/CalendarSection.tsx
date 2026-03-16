/**
 * Calendar Integration Section
 * @file src/react/features/admin/integrations/CalendarSection.tsx
 */

import * as React from 'react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { formatDate, type CalendarStatus } from './types';

interface CalendarSectionProps {
  calendarStatus: CalendarStatus | null;
  onToggleSync: () => void;
}

export function CalendarSection({ calendarStatus, onToggleSync }: CalendarSectionProps) {
  return (
    <div className="status-section">
      <div className="data-table-header"><h3><span className="title-full">Calendar</span></h3></div>
      {calendarStatus ? (
        <div className="stats-grid">
          <div className="portal-card">
            <div className="stat-card">
              <div className="portal-card-header">
                <div className="portal-card-title-group">
                  <Calendar className="icon-lg text-muted" />
                  <span className="font-semibold">Calendar Sync</span>
                </div>
              </div>
              <div className="portal-card-detail-list">
                <div className="portal-card-detail-row">
                  <span className="text-muted">Connected</span>
                  <span>
                    {calendarStatus.connected ? (
                      <CheckCircle className="icon-sm text-status-success" />
                    ) : (
                      <XCircle className="icon-sm text-status-danger" />
                    )}
                  </span>
                </div>
                {calendarStatus.provider && (
                  <div className="portal-card-detail-row">
                    <span className="text-muted">Provider</span>
                    <span>{calendarStatus.provider}</span>
                  </div>
                )}
                <div className="portal-card-detail-row">
                  <span className="text-muted">Sync Enabled</span>
                  <button
                    className="btn btn-secondary p-0 border-0"
                    onClick={onToggleSync}
                    title={calendarStatus.syncEnabled ? 'Disable sync' : 'Enable sync'}
                  >
                    {calendarStatus.syncEnabled ? (
                      <ToggleRight className="icon-md text-status-success" />
                    ) : (
                      <ToggleLeft className="icon-md text-muted" />
                    )}
                  </button>
                </div>
                <div className="portal-card-detail-row">
                  <span className="text-muted">Last Sync</span>
                  <span>{formatDate(calendarStatus.lastSync)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="status-empty">
          <Calendar className="icon-lg text-muted" />
          <span>Calendar status unavailable.</span>
        </div>
      )}
    </div>
  );
}
