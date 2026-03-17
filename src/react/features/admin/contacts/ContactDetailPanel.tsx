/**
 * ContactDetailPanel
 * Slide-in detail panel for contacts, built on the DetailPanel factory.
 * Renders a single Overview tab with contact metadata and action buttons.
 */

import * as React from 'react';
import { useMemo } from 'react';
import {
  DetailPanel,
  MetaGrid,
  IconButton
} from '@react/factories';
import type { DetailPanelConfig, PanelMetaField } from '@react/factories';
import { CopyEmailButton } from '@react/components/portal';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';

// ============================================
// TYPES
// ============================================

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  clientId?: number;
  clientName?: string;
  isPrimary: boolean;
  status: ContactStatus;
  createdAt: string;
  lastContactedAt?: string;
}

type ContactStatus = 'active' | 'inactive';

const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string }> = {
  active: { label: 'Active' },
  inactive: { label: 'Inactive' }
};

// ============================================
// PROPS
// ============================================

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
  onStatusChange?: (contactId: number, status: string) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// COMPONENT
// ============================================

export function ContactDetailPanel({
  contact,
  onClose,
  onStatusChange,
  onNavigate,
  showNotification
}: ContactDetailPanelProps) {
  const config = useMemo<DetailPanelConfig<Contact>>(() => ({
    entityLabel: 'Contact',
    panelId: 'contact-details-panel',

    title: (c) => `${decodeHtmlEntities(c.firstName)} ${decodeHtmlEntities(c.lastName)}`,

    subtitle: (c) => {
      if (c.company) return decodeHtmlEntities(c.company);
      if (c.role) return decodeHtmlEntities(c.role);
      return undefined;
    },

    status: {
      current: (c) => c.status,
      config: CONTACT_STATUS_CONFIG,
      onChange: (c, newStatus) => onStatusChange?.(c.id, newStatus)
    },

    meta: (c) => {
      const fields: PanelMetaField[] = [];
      if (c.isPrimary) {
        fields.push({ label: 'Role', value: 'Primary Contact' });
      }
      fields.push({ label: 'Created', value: formatDate(c.createdAt) });
      return fields;
    },

    actions: (c) => (
      <>
        <IconButton
          action="email"
          onClick={() => { window.location.href = `mailto:${c.email}`; }}
          title="Email"
        />
        {c.phone && (
          <IconButton
            action="call"
            onClick={() => { window.location.href = `tel:${c.phone}`; }}
            title="Call"
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
              label: 'Email',
              render: (
                <span className="meta-value meta-value-with-copy">
                  {c.email}
                  <CopyEmailButton email={c.email} showNotification={showNotification} />
                </span>
              )
            },
            {
              label: 'Phone',
              value: c.phone,
              visible: !!c.phone
            },
            {
              label: 'Company',
              value: c.company ? decodeHtmlEntities(c.company) : undefined,
              visible: !!c.company
            },
            {
              label: 'Role',
              value: c.role ? decodeHtmlEntities(c.role) : undefined,
              visible: !!c.role
            },
            {
              label: 'Client',
              value: c.clientName ? decodeHtmlEntities(c.clientName) : undefined,
              visible: !!c.clientId && !!c.clientName,
              onClick: c.clientId
                ? () => {
                    onClose();
                    onNavigate?.('client-detail', String(c.clientId));
                  }
                : undefined
            },
            {
              label: 'Primary',
              value: c.isPrimary ? 'Yes' : 'No'
            },
            {
              label: 'Last Contacted',
              value: c.lastContactedAt ? formatDate(c.lastContactedAt) : undefined,
              visible: !!c.lastContactedAt
            },
            {
              label: 'Created',
              value: formatDate(c.createdAt)
            }
          ];

          return <MetaGrid fields={fields} />;
        }
      }
    ]
  }), [onStatusChange, onNavigate, onClose, showNotification]);

  return (
    <DetailPanel<Contact>
      entity={contact}
      onClose={onClose}
      config={config}
    />
  );
}
