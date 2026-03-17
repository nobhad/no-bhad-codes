/**
 * ContractDetailPanel
 * Slide-in overlay panel showing contract details with tabs (Overview, Timeline).
 * Built on the DetailPanel factory — all shared panel/overlay/keyboard logic is handled there.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  DetailPanel,
  MetaGrid,
  MetaItem as _MetaItem,
  Timeline,
  IconButton
} from '@react/factories';
import type {
  DetailPanelConfig,
  PanelMetaField,
  TimelineEvent
} from '@react/factories';
import { CopyEmailButton } from '@react/components/portal';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';

interface Contract {
  id: number;
  templateId?: number | null;
  templateName?: string;
  templateType?: string | null;
  projectId: number;
  projectName?: string;
  clientId: number;
  clientName?: string;
  clientEmail?: string;
  status: ContractStatus;
  content?: string;
  sentAt?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string }> = {
  draft: { label: 'Draft' },
  sent: { label: 'Sent' },
  viewed: { label: 'Viewed' },
  signed: { label: 'Signed' },
  expired: { label: 'Expired' },
  cancelled: { label: 'Cancelled' }
};

// ============================================
// PROPS
// ============================================

interface ContractDetailPanelProps {
  contract: Contract | null;
  onClose: () => void;
  onStatusChange?: (contractId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  onSend?: (contractId: number) => void;
  onDownload?: (contractId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// COMPONENT
// ============================================

export function ContractDetailPanel({
  contract,
  onClose,
  onStatusChange,
  onNavigate,
  onSend,
  onDownload,
  showNotification
}: ContractDetailPanelProps) {
  const handleNavigateToClient = useCallback(
    (clientId: number) => {
      onClose();
      onNavigate?.('client-detail', String(clientId));
    },
    [onClose, onNavigate]
  );

  const handleNavigateToProject = useCallback(
    (projectId: number) => {
      onClose();
      onNavigate?.('project-detail', String(projectId));
    },
    [onClose, onNavigate]
  );

  const config = useMemo<DetailPanelConfig<Contract>>(
    () => ({
      entityLabel: 'Contract',
      panelId: 'contract-details-panel',

      title: (c) =>
        c.templateName ? decodeHtmlEntities(c.templateName) : 'Untitled Contract',

      subtitle: (c) =>
        c.clientName ? decodeHtmlEntities(c.clientName) : undefined,

      status: {
        current: (c) => c.status,
        config: CONTRACT_STATUS_CONFIG,
        onChange: (c, newStatus) => onStatusChange?.(c.id, newStatus)
      },

      meta: (c) => [
        {
          label: 'Template Type',
          value: c.templateType ?? undefined,
          visible: !!c.templateType
        },
        {
          label: 'Created',
          value: formatDate(c.createdAt)
        }
      ],

      actions: (c) => (
        <>
          {c.status === 'draft' && onSend && (
            <IconButton
              action="send"
              onClick={() => onSend(c.id)}
              title="Send Contract"
            />
          )}
          {onDownload && (
            <IconButton
              action="download"
              onClick={() => onDownload(c.id)}
              title="Download PDF"
            />
          )}
        </>
      ),

      tabs: (c) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Client',
                value: c.clientName ? decodeHtmlEntities(c.clientName) : undefined,
                onClick: c.clientId ? () => handleNavigateToClient(c.clientId) : undefined,
                visible: !!c.clientName
              },
              {
                label: 'Project',
                value: c.projectName ? decodeHtmlEntities(c.projectName) : undefined,
                onClick: c.projectId ? () => handleNavigateToProject(c.projectId) : undefined,
                visible: !!c.projectName
              },
              {
                label: 'Email',
                render: c.clientEmail ? (
                  <span className="meta-value meta-value-with-copy">
                    {c.clientEmail}
                    <CopyEmailButton
                      email={c.clientEmail}
                      showNotification={showNotification}
                    />
                  </span>
                ) : undefined,
                visible: !!c.clientEmail
              },
              {
                label: 'Template',
                value: c.templateName ? decodeHtmlEntities(c.templateName) : undefined,
                visible: !!c.templateName
              },
              {
                label: 'Expires',
                value: c.expiresAt ? formatDate(c.expiresAt) : undefined,
                visible: !!c.expiresAt
              }
            ];

            return <MetaGrid fields={fields} />;
          }
        },
        {
          id: 'timeline',
          label: 'Timeline',
          render: () => {
            const events: TimelineEvent[] = [
              { label: 'Created', date: c.createdAt },
              { label: 'Sent', date: c.sentAt },
              { label: 'Viewed', date: undefined },
              { label: 'Signed', date: c.signedAt },
              { label: 'Expires', date: c.expiresAt }
            ];

            return <Timeline events={events} formatDate={formatDate} />;
          }
        }
      ]
    }),
    [onStatusChange, onSend, onDownload, showNotification, handleNavigateToClient, handleNavigateToProject]
  );

  return <DetailPanel entity={contract} onClose={onClose} config={config} />;
}
