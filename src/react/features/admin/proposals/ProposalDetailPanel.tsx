/**
 * ProposalDetailPanel
 * Slide-in overlay panel showing proposal details with tabs (Overview, Timeline).
 * Built on the DetailPanel factory — all shared panel/overlay/keyboard logic is handled there.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { DetailPanel, MetaGrid, Timeline } from '@react/factories/createDetailPanel';
import type { DetailPanelConfig, PanelMetaField, TimelineEvent } from '@react/factories/createDetailPanel';
import { IconButton } from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { formatCurrency } from '@/utils/format-utils';
import { downloadFromUrl } from '@/utils/file-download';

// ============================================
// TYPES
// ============================================

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

interface Proposal {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  projectType?: string;
  status: ProposalStatus;
  amount: number;
  validUntil?: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
}

const PROPOSAL_STATUS_CONFIG: Record<ProposalStatus, { label: string }> = {
  draft: { label: 'Draft' },
  sent: { label: 'Sent' },
  viewed: { label: 'Viewed' },
  accepted: { label: 'Accepted' },
  declined: { label: 'Declined' },
  expired: { label: 'Expired' }
};

// ============================================
// PROPS
// ============================================

interface ProposalDetailPanelProps {
  proposal: Proposal | null;
  onClose: () => void;
  onStatusChange?: (proposalId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  onSend?: (proposalId: number) => void;
  onDuplicate?: (proposalId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// COMPONENT
// ============================================

export function ProposalDetailPanel({
  proposal,
  onClose,
  onStatusChange,
  onNavigate,
  onSend,
  onDuplicate,
  showNotification: _showNotification
}: ProposalDetailPanelProps) {
  const handleNavigateToClient = useCallback(
    (clientId: number) => {
      onClose();
      onNavigate?.('client-detail', String(clientId));
    },
    [onClose, onNavigate]
  );

  const config = useMemo<DetailPanelConfig<Proposal>>(
    () => ({
      entityLabel: 'Proposal',
      panelId: 'proposal-details-panel',

      title: (p) =>
        p.title ? decodeHtmlEntities(p.title) : 'Untitled Proposal',

      subtitle: (p) => decodeHtmlEntities(p.clientName),

      status: {
        current: (p) => p.status,
        config: PROPOSAL_STATUS_CONFIG,
        onChange: (p, newStatus) => onStatusChange?.(p.id, newStatus)
      },

      meta: (p) => [
        {
          label: 'Amount',
          value: formatCurrency(p.amount)
        },
        {
          label: 'Created',
          value: formatDate(p.createdAt)
        }
      ],

      actions: (p) => (
        <>
          {p.status === 'draft' && onSend && (
            <IconButton
              action="send"
              onClick={() => onSend(p.id)}
              title="Send Proposal"
            />
          )}
          <IconButton
            action="download"
            onClick={() => downloadFromUrl(`/api/proposals/${p.id}/pdf`, `proposal-${p.id}.pdf`)}
            title="Download PDF"
          />
          {onDuplicate && (
            <IconButton
              action="copy"
              onClick={() => onDuplicate(p.id)}
              title="Duplicate Proposal"
            />
          )}
        </>
      ),

      tabs: (p) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Client',
                value: decodeHtmlEntities(p.clientName),
                onClick: () => handleNavigateToClient(p.clientId)
              },
              {
                label: 'Project Type',
                value: p.projectType ?? undefined,
                visible: !!p.projectType
              },
              {
                label: 'Amount',
                value: formatCurrency(p.amount)
              },
              {
                label: 'Valid Until',
                value: p.validUntil ? formatDate(p.validUntil) : undefined,
                visible: !!p.validUntil
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
              { label: 'Created', date: p.createdAt },
              { label: 'Sent', date: p.sentAt },
              { label: 'Viewed', date: p.viewedAt },
              { label: 'Accepted', date: p.acceptedAt }
            ];

            return <Timeline events={events} formatDate={formatDate} />;
          }
        }
      ]
    }),
    [onStatusChange, onSend, onDuplicate, handleNavigateToClient]
  );

  return <DetailPanel entity={proposal} onClose={onClose} config={config} />;
}
