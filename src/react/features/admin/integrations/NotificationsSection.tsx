/**
 * Notifications Section
 * @file src/react/features/admin/integrations/NotificationsSection.tsx
 */

import * as React from 'react';
import {
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Send
} from 'lucide-react';
import { formatDate, type NotificationConfig } from './types';

interface NotificationsSectionProps {
  notifications: NotificationConfig[];
  testingId: number | null;
  onAdd: () => void;
  onEdit: (notification: NotificationConfig) => void;
  onDelete: (notification: NotificationConfig) => void;
  onTest: (id: number) => void;
}

export function NotificationsSection({
  notifications,
  testingId,
  onAdd,
  onEdit,
  onDelete,
  onTest
}: NotificationsSectionProps) {
  return (
    <div className="status-section">
      <div className="data-table-header">
        <h3><span className="title-full">Notification Configurations</span></h3>
        <div className="data-table-actions">
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus className="icon-sm" />
            Add Notification
          </button>
        </div>
      </div>

      {notifications.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Channel</th>
              <th>Event</th>
              <th>Enabled</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notif) => (
              <tr key={notif.id}>
                <td>{notif.name}</td>
                <td>
                  <span className="status-badge">{notif.channel}</span>
                </td>
                <td>{notif.event}</td>
                <td>
                  <span className={`health-indicator ${notif.enabled ? 'health-ok' : 'health-error'}`} />
                </td>
                <td>{formatDate(notif.createdAt)}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-secondary"
                      onClick={() => onTest(notif.id)}
                      disabled={testingId === notif.id}
                      title="Test notification"
                    >
                      {testingId === notif.id ? (
                        <RefreshCw className="icon-sm animate-spin" />
                      ) : (
                        <Send className="icon-sm" />
                      )}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => onEdit(notif)}
                      title="Edit notification"
                    >
                      <Pencil className="icon-sm" />
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => onDelete(notif)}
                      title="Delete notification"
                    >
                      <Trash2 className="icon-sm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="status-empty">
          <AlertCircle className="icon-lg text-muted" />
          <span>No notification configurations yet.</span>
        </div>
      )}
    </div>
  );
}
