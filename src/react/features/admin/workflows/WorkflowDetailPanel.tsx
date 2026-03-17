/**
 * WorkflowDetailPanel
 * Slide-in overlay panel showing workflow details with tabs (Overview, Stats).
 * Built on the DetailPanel factory.
 */

import * as React from 'react';
import { useMemo } from 'react';
import {
  DetailPanel,
  MetaGrid,
  IconButton
} from '@react/factories';
import type {
  DetailPanelConfig,
  PanelMetaField,
  PanelDescriptionField
} from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

type WorkflowStatus = 'active' | 'inactive';

interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  trigger: string;
  status: WorkflowStatus;
  lastRun?: string | null;
  runCount: number;
  successRate: number;
  steps: number;
  createdAt: string;
  updatedAt: string;
}

const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, { label: string }> = {
  active: { label: 'Active' },
  inactive: { label: 'Inactive' }
};

// ============================================
// PROPS
// ============================================

interface WorkflowDetailPanelProps {
  workflow: Workflow | null;
  onClose: () => void;
  onStatusChange?: (workflowId: number, status: string) => void;
  onEdit?: (workflowId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// HELPERS
// ============================================

const formatPercentage = (value: number): string => `${Math.round(value)}%`;

// ============================================
// COMPONENT
// ============================================

export function WorkflowDetailPanel({
  workflow,
  onClose,
  onStatusChange,
  onEdit
}: WorkflowDetailPanelProps) {
  const config = useMemo<DetailPanelConfig<Workflow>>(
    () => ({
      entityLabel: 'Workflow',
      panelId: 'workflow-details-panel',

      title: (w) => decodeHtmlEntities(w.name),

      subtitle: (w) => w.trigger,

      status: {
        current: (w) => w.status,
        config: WORKFLOW_STATUS_CONFIG,
        onChange: (w, newStatus) => onStatusChange?.(w.id, newStatus)
      },

      meta: (w) => [
        {
          label: 'Steps',
          value: String(w.steps)
        },
        {
          label: 'Updated',
          value: formatDate(w.updatedAt)
        }
      ],

      actions: (w) => (
        <>
          {onEdit && (
            <IconButton
              action="edit"
              onClick={() => onEdit(w.id)}
              title="Edit Workflow"
            />
          )}
        </>
      ),

      tabs: (w) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Trigger',
                value: w.trigger
              },
              {
                label: 'Steps',
                value: String(w.steps)
              },
              {
                label: 'Status',
                value: WORKFLOW_STATUS_CONFIG[w.status].label
              },
              {
                label: 'Last Run',
                value: w.lastRun ? formatDate(w.lastRun) : 'Never'
              }
            ];

            const descriptions: PanelDescriptionField[] = [
              {
                label: 'Description',
                value: w.description ? decodeHtmlEntities(w.description) : undefined,
                visible: !!w.description
              }
            ];

            return <MetaGrid fields={fields} descriptions={descriptions} />;
          }
        },
        {
          id: 'stats',
          label: 'Stats',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Run Count',
                value: String(w.runCount)
              },
              {
                label: 'Success Rate',
                value: formatPercentage(w.successRate)
              },
              {
                label: 'Last Run',
                value: w.lastRun ? formatDate(w.lastRun) : 'Never'
              },
              {
                label: 'Created',
                value: formatDate(w.createdAt)
              },
              {
                label: 'Updated',
                value: formatDate(w.updatedAt)
              }
            ];

            return <MetaGrid fields={fields} />;
          }
        }
      ]
    }),
    [onStatusChange, onEdit]
  );

  return <DetailPanel entity={workflow} onClose={onClose} config={config} />;
}
