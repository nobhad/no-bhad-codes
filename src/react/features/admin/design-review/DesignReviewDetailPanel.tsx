/**
 * DesignReviewDetailPanel
 * Slide-in overlay panel showing design review details with tabs (Overview, Timeline).
 * Built on the DetailPanel factory -- all shared panel/overlay/keyboard logic is handled there.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { DetailPanel, MetaGrid, Timeline } from '@react/factories/createDetailPanel';
import type { DetailPanelConfig, PanelMetaField, PanelDescriptionField, TimelineEvent } from '@react/factories/createDetailPanel';
import { IconButton } from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

type DesignReviewStatus = 'pending' | 'in-review' | 'approved' | 'revision-requested' | 'rejected';

interface DesignReview {
  id: number;
  title: string;
  description?: string;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  status: DesignReviewStatus;
  version: number;
  comments: number;
  attachments: number;
  reviewer?: string;
  dueDate?: string;
  submittedAt: string;
  reviewedAt?: string;
  createdAt: string;
}

const DESIGN_REVIEW_STATUS_CONFIG: Record<DesignReviewStatus, { label: string }> = {
  'pending': { label: 'Pending' },
  'in-review': { label: 'In Review' },
  'approved': { label: 'Approved' },
  'revision-requested': { label: 'Revision Requested' },
  'rejected': { label: 'Rejected' }
};

// ============================================
// PROPS
// ============================================

interface DesignReviewDetailPanelProps {
  review: DesignReview | null;
  onClose: () => void;
  onStatusChange?: (reviewId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  onApprove?: (reviewId: number) => void;
  onRequestRevision?: (reviewId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// HELPERS
// ============================================

const VERSION_PREFIX = 'v';

function formatVersion(version: number): string {
  return `${VERSION_PREFIX}${version}`;
}

// ============================================
// COMPONENT
// ============================================

export function DesignReviewDetailPanel({
  review,
  onClose,
  onStatusChange,
  onNavigate,
  onApprove,
  onRequestRevision,
  showNotification: _showNotification
}: DesignReviewDetailPanelProps) {
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

  const config = useMemo<DetailPanelConfig<DesignReview>>(
    () => ({
      entityLabel: 'Design Review',
      panelId: 'design-review-details-panel',

      title: (r) =>
        r.title ? decodeHtmlEntities(r.title) : 'Untitled Design Review',

      subtitle: (r) => decodeHtmlEntities(r.projectName),

      status: {
        current: (r) => r.status,
        config: DESIGN_REVIEW_STATUS_CONFIG,
        onChange: (r, newStatus) => onStatusChange?.(r.id, newStatus)
      },

      meta: (r) => [
        {
          label: 'Version',
          value: formatVersion(r.version)
        },
        {
          label: 'Comments',
          value: String(r.comments)
        },
        {
          label: 'Submitted',
          value: formatDate(r.submittedAt)
        }
      ],

      actions: (r) => (
        <>
          {r.status === 'in-review' && onApprove && (
            <IconButton
              action="approve"
              onClick={() => onApprove(r.id)}
              title="Approve"
            />
          )}
          {r.status === 'in-review' && onRequestRevision && (
            <IconButton
              action="edit"
              onClick={() => onRequestRevision(r.id)}
              title="Request Revision"
            />
          )}
        </>
      ),

      tabs: (r) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Client',
                value: decodeHtmlEntities(r.clientName),
                onClick: () => handleNavigateToClient(r.clientId)
              },
              {
                label: 'Project',
                value: decodeHtmlEntities(r.projectName),
                onClick: () => handleNavigateToProject(r.projectId)
              },
              {
                label: 'Reviewer',
                value: r.reviewer ? decodeHtmlEntities(r.reviewer) : undefined,
                visible: !!r.reviewer
              },
              {
                label: 'Version',
                value: formatVersion(r.version)
              },
              {
                label: 'Comments',
                value: String(r.comments)
              },
              {
                label: 'Attachments',
                value: String(r.attachments)
              },
              {
                label: 'Due Date',
                value: r.dueDate ? formatDate(r.dueDate) : undefined,
                visible: !!r.dueDate
              }
            ];

            const descriptions: PanelDescriptionField[] = [
              {
                label: 'Description',
                value: r.description ? decodeHtmlEntities(r.description) : undefined,
                visible: !!r.description
              }
            ];

            return <MetaGrid fields={fields} descriptions={descriptions} />;
          }
        },
        {
          id: 'timeline',
          label: 'Timeline',
          render: () => {
            const events: TimelineEvent[] = [
              { label: 'Created', date: r.createdAt },
              { label: 'Submitted', date: r.submittedAt },
              { label: 'Reviewed', date: r.reviewedAt }
            ];

            return <Timeline events={events} formatDate={formatDate} />;
          }
        }
      ]
    }),
    [onStatusChange, onApprove, onRequestRevision, handleNavigateToClient, handleNavigateToProject]
  );

  return <DetailPanel entity={review} onClose={onClose} config={config} />;
}
