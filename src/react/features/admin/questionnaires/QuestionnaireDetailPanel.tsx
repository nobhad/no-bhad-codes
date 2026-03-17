/**
 * QuestionnaireDetailPanel
 * Slide-in overlay panel showing questionnaire details with tabs (Overview, Progress).
 * Built on the DetailPanel factory -- all shared panel/overlay/keyboard logic is handled there.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  DetailPanel,
  MetaGrid,
  Timeline,
  IconButton
} from '@react/factories';
import type {
  DetailPanelConfig,
  PanelMetaField,
  PanelDescriptionField,
  TimelineEvent
} from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

type QuestionnaireStatus = 'draft' | 'sent' | 'pending' | 'in_progress' | 'completed' | 'expired';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  client_id: number;
  client_name: string;
  project_id?: number;
  project_name: string | null;
  questionnaire_name?: string;
  status: QuestionnaireStatus;
  questions_count: number;
  responses_count: number;
  completion_rate: number;
  due_date: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const QUESTIONNAIRE_STATUS_CONFIG: Record<QuestionnaireStatus, { label: string }> = {
  draft: { label: 'Draft' },
  sent: { label: 'Sent' },
  pending: { label: 'Pending' },
  in_progress: { label: 'In Progress' },
  completed: { label: 'Completed' },
  expired: { label: 'Expired' }
};

// ============================================
// PROPS
// ============================================

interface QuestionnaireDetailPanelProps {
  questionnaire: Questionnaire | null;
  onClose: () => void;
  onStatusChange?: (questionnaireId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  onSend?: (questionnaireId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// HELPERS
// ============================================

function formatProgress(responses: number, questions: number, rate: number): string {
  return `${responses}/${questions} (${rate}%)`;
}

// ============================================
// COMPONENT
// ============================================

export function QuestionnaireDetailPanel({
  questionnaire,
  onClose,
  onStatusChange,
  onNavigate,
  onSend,
  showNotification
}: QuestionnaireDetailPanelProps) {
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

  const config = useMemo<DetailPanelConfig<Questionnaire>>(
    () => ({
      entityLabel: 'Questionnaire',
      panelId: 'questionnaire-details-panel',

      title: (q) =>
        q.title ? decodeHtmlEntities(q.title) : 'Untitled Questionnaire',

      subtitle: (q) => decodeHtmlEntities(q.client_name),

      status: {
        current: (q) => q.status,
        config: QUESTIONNAIRE_STATUS_CONFIG,
        onChange: (q, newStatus) => onStatusChange?.(q.id, newStatus)
      },

      meta: (q) => [
        {
          label: 'Progress',
          value: formatProgress(q.responses_count, q.questions_count, q.completion_rate)
        },
        {
          label: 'Due',
          value: q.due_date ? formatDate(q.due_date) : undefined,
          visible: !!q.due_date
        }
      ],

      actions: (q) => (
        <>
          {q.status === 'draft' && onSend && (
            <IconButton
              action="send"
              onClick={() => onSend(q.id)}
              title="Send Questionnaire"
            />
          )}
        </>
      ),

      tabs: (q) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Client',
                value: decodeHtmlEntities(q.client_name),
                onClick: () => handleNavigateToClient(q.client_id)
              },
              {
                label: 'Project',
                value: q.project_name ? decodeHtmlEntities(q.project_name) : undefined,
                onClick: q.project_id
                  ? () => handleNavigateToProject(q.project_id!)
                  : undefined,
                visible: !!q.project_name
              },
              {
                label: 'Questions',
                value: String(q.questions_count)
              },
              {
                label: 'Responses',
                value: String(q.responses_count)
              },
              {
                label: 'Completion Rate',
                value: `${q.completion_rate}%`
              },
              {
                label: 'Due Date',
                value: q.due_date ? formatDate(q.due_date) : undefined,
                visible: !!q.due_date
              }
            ];

            const descriptions: PanelDescriptionField[] = [
              {
                label: 'Description',
                value: q.description ? decodeHtmlEntities(q.description) : undefined,
                visible: !!q.description
              }
            ];

            return <MetaGrid fields={fields} descriptions={descriptions} />;
          }
        },
        {
          id: 'progress',
          label: 'Progress',
          render: () => {
            const events: TimelineEvent[] = [
              { label: 'Created', date: q.created_at },
              { label: 'Sent', date: q.sent_at },
              { label: 'Completed', date: q.completed_at }
            ];

            return <Timeline events={events} formatDate={formatDate} />;
          }
        }
      ]
    }),
    [onStatusChange, onSend, handleNavigateToClient, handleNavigateToProject]
  );

  return <DetailPanel entity={questionnaire} onClose={onClose} config={config} />;
}
