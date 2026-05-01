/**
 * DocumentRequestDetailPanel
 * Slide-in detail panel for document requests, built on the DetailPanel factory.
 * Renders Overview and Timeline tabs with status management and action buttons.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { DetailPanel, MetaGrid, Timeline } from '@react/factories/createDetailPanel';
import type { DetailPanelConfig, PanelMetaField } from '@react/factories/createDetailPanel';
import { IconButton } from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

interface DocumentRequest {
  id: number;
  title: string;
  description?: string;
  clientId: number;
  clientName: string;
  projectId?: number;
  projectName?: string;
  status: DocRequestStatus;
  dueDate?: string;
  submittedAt?: string;
  documents: number;
  createdAt: string;
  updatedAt: string;
}

type DocRequestStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';

const DOC_REQUEST_STATUS_CONFIG: Record<DocRequestStatus, { label: string }> = {
  pending: { label: 'Pending' },
  submitted: { label: 'Submitted' },
  approved: { label: 'Approved' },
  rejected: { label: 'Rejected' },
  expired: { label: 'Expired' }
};

// ============================================
// PROPS
// ============================================

interface DocumentRequestDetailPanelProps {
  request: DocumentRequest | null;
  onClose: () => void;
  onStatusChange?: (requestId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  onRemind?: (requestId: number) => void;
  onDownload?: (requestId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// COMPONENT
// ============================================

export function DocumentRequestDetailPanel({
  request,
  onClose,
  onStatusChange,
  onNavigate,
  onRemind,
  onDownload
}: DocumentRequestDetailPanelProps) {
  const config = useMemo<DetailPanelConfig<DocumentRequest>>(() => ({
    entityLabel: 'Document Request',
    panelId: 'doc-request-details-panel',

    title: (req) => decodeHtmlEntities(req.title) || 'Untitled Request',

    subtitle: (req) => decodeHtmlEntities(req.clientName),

    status: {
      current: (req) => req.status,
      config: DOC_REQUEST_STATUS_CONFIG,
      onChange: (req, newStatus) => onStatusChange?.(req.id, newStatus)
    },

    meta: (req) => {
      const fields: PanelMetaField[] = [];
      if (req.dueDate) {
        fields.push({ label: 'Due', value: formatDate(req.dueDate) });
      }
      fields.push({ label: 'Documents', value: String(req.documents) });
      fields.push({ label: 'Created', value: formatDate(req.createdAt) });
      return fields;
    },

    actions: (req) => (
      <>
        {req.status === 'pending' && (
          <IconButton
            action="remind"
            onClick={() => onRemind?.(req.id)}
            title="Send Reminder"
          />
        )}
        {req.documents > 0 && (
          <IconButton
            action="download"
            onClick={() => onDownload?.(req.id)}
            title="Download All"
          />
        )}
      </>
    ),

    tabs: (req) => [
      {
        id: 'overview',
        label: 'Overview',
        render: () => {
          const fields: PanelMetaField[] = [
            {
              label: 'Client',
              value: decodeHtmlEntities(req.clientName),
              onClick: () => {
                onClose();
                onNavigate?.('client-detail', String(req.clientId));
              }
            },
            {
              label: 'Project',
              value: req.projectName ? decodeHtmlEntities(req.projectName) : undefined,
              visible: !!req.projectName,
              onClick: req.projectId
                ? () => {
                  onClose();
                  onNavigate?.('project-detail', String(req.projectId));
                }
                : undefined
            },
            {
              label: 'Due Date',
              value: req.dueDate ? formatDate(req.dueDate) : undefined,
              visible: !!req.dueDate
            },
            {
              label: 'Documents',
              value: String(req.documents)
            }
          ];

          const descriptions = req.description
            ? [{ label: 'Description', value: decodeHtmlEntities(req.description) }]
            : undefined;

          return <MetaGrid fields={fields} descriptions={descriptions} />;
        }
      },
      {
        id: 'timeline',
        label: 'Timeline',
        render: () => (
          <Timeline
            events={[
              { label: 'Created', date: req.createdAt },
              { label: 'Submitted', date: req.submittedAt },
              { label: 'Updated', date: req.updatedAt }
            ]}
            formatDate={formatDate}
          />
        )
      }
    ]
  }), [onStatusChange, onNavigate, onClose, onRemind, onDownload]);

  return (
    <DetailPanel<DocumentRequest>
      entity={request}
      onClose={onClose}
      config={config}
    />
  );
}
