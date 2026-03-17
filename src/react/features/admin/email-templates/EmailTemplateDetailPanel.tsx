/**
 * EmailTemplateDetailPanel
 * Slide-in overlay panel showing email template details with tabs (Overview, Variables).
 * Built on the DetailPanel factory.
 */

import * as React from 'react';
import { useMemo } from 'react';
import {
  DetailPanel,
  MetaGrid,
  IconButton,
  EmptyState,
} from '@react/factories';
import type {
  DetailPanelConfig,
  PanelMetaField,
  PanelDescriptionField,
} from '@react/factories';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

interface TemplateVariable {
  name: string;
  description: string;
}

interface EmailTemplate {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  variables: TemplateVariable[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROPS
// ============================================

interface EmailTemplateDetailPanelProps {
  template: EmailTemplate | null;
  onClose: () => void;
  onEdit?: (templateId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// HELPERS
// ============================================

const formatBoolean = (value: boolean): string => (value ? 'Yes' : 'No');

// ============================================
// COMPONENT
// ============================================

export function EmailTemplateDetailPanel({
  template,
  onClose,
  onEdit,
}: EmailTemplateDetailPanelProps) {
  const config = useMemo<DetailPanelConfig<EmailTemplate>>(
    () => ({
      entityLabel: 'Email Template',
      panelId: 'email-template-details-panel',

      title: (t) => decodeHtmlEntities(t.name),

      subtitle: (t) => t.category,

      meta: (t) => [
        {
          label: 'Category',
          value: t.category,
        },
        {
          label: 'Active',
          value: t.is_active ? 'Active' : 'Inactive',
        },
        {
          label: 'System',
          value: 'System Template',
          visible: t.is_system,
        },
      ],

      actions: (t) => (
        <>
          {onEdit && (
            <IconButton
              action="edit"
              onClick={() => onEdit(t.id)}
              title="Edit Template"
            />
          )}
        </>
      ),

      tabs: (t) => [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const fields: PanelMetaField[] = [
              {
                label: 'Subject',
                value: decodeHtmlEntities(t.subject),
              },
              {
                label: 'Category',
                value: t.category,
              },
              {
                label: 'Active',
                value: formatBoolean(t.is_active),
              },
              {
                label: 'System',
                value: formatBoolean(t.is_system),
              },
              {
                label: 'Created',
                value: formatDate(t.created_at),
              },
              {
                label: 'Updated',
                value: formatDate(t.updated_at),
              },
            ];

            const descriptions: PanelDescriptionField[] = [
              {
                label: 'Description',
                value: t.description ? decodeHtmlEntities(t.description) : undefined,
                visible: !!t.description,
              },
            ];

            return <MetaGrid fields={fields} descriptions={descriptions} />;
          },
        },
        {
          id: 'variables',
          label: 'Variables',
          badge: t.variables.length,
          render: () => {
            if (t.variables.length === 0) {
              return <EmptyState message="No variables defined" />;
            }

            return (
              <ul className="activity-feed">
                {t.variables.map((variable) => (
                  <li key={variable.name} className="activity-feed-item">
                    <div className="activity-body">
                      <span className="activity-text">{variable.name}</span>
                      <span className="activity-time">{variable.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            );
          },
        },
      ],
    }),
    [onEdit]
  );

  return <DetailPanel entity={template} onClose={onClose} config={config} />;
}
