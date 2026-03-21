/**
 * InvoiceDetailPanel
 * Slide-in overlay panel showing invoice details with inline editing for drafts.
 * Built on the DetailPanel factory.
 */

import * as React from 'react';
import { useMemo, useCallback, useState } from 'react';
import {
  DetailPanel,
  MetaGrid,
  Timeline,
  IconButton
} from '@react/factories';
import type {
  DetailPanelConfig,
  PanelMetaField,
  TimelineEvent
} from '@react/factories';
import { InlineEdit } from '@react/components/portal/InlineEdit';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
import { apiPut } from '@/utils/api-client';
import { buildEndpoint } from '@/constants/api-endpoints';
import type { Invoice } from '../types';
import { INVOICE_STATUS_CONFIG } from '../types';

// ============================================
// PROPS
// ============================================

interface InvoiceDetailPanelProps {
  invoice: Invoice | null;
  onClose: () => void;
  onStatusChange?: (invoiceId: number, status: string) => void;
  onSend?: (invoiceId: number) => Promise<boolean>;
  onMarkPaid?: (invoiceId: number) => Promise<boolean>;
  onDownloadPdf?: (invoiceId: number) => Promise<void>;
  onNavigate?: (tab: string, entityId?: string) => void;
  onRefresh?: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// HELPERS
// ============================================

function parseCurrencyInput(value: string): string {
  return value.replace(/[^0-9.]/g, '');
}

function formatCurrencyDisplay(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return formatCurrency(num);
}

// ============================================
// COMPONENT
// ============================================

export function InvoiceDetailPanel({
  invoice,
  onClose,
  onStatusChange,
  onSend,
  onMarkPaid,
  onDownloadPdf,
  onNavigate,
  onRefresh,
  showNotification
}: InvoiceDetailPanelProps) {
  const [isSending, setIsSending] = useState(false);

  const handleNavigateToProject = useCallback(
    (projectId: number) => {
      onClose();
      onNavigate?.('project-detail', String(projectId));
    },
    [onClose, onNavigate]
  );

  const handleSaveField = useCallback(
    async (field: string, value: string): Promise<boolean> => {
      if (!invoice) return false;
      try {
        const res = await apiPut(buildEndpoint.invoice(invoice.id), { [field]: value });
        if (res.ok) {
          showNotification?.('Invoice updated', 'success');
          onRefresh?.();
          return true;
        }
        showNotification?.('Failed to save', 'error');
        return false;
      } catch {
        showNotification?.('Failed to save', 'error');
        return false;
      }
    },
    [invoice, showNotification, onRefresh]
  );

  const handleSend = useCallback(async () => {
    if (!invoice || !onSend) return;
    setIsSending(true);
    await onSend(invoice.id);
    setIsSending(false);
  }, [invoice, onSend]);

  const config = useMemo<DetailPanelConfig<Invoice>>(
    () => ({
      entityLabel: 'Invoice',
      panelId: 'invoice-details-panel',

      title: (inv) => inv.invoice_number || `Invoice #${inv.id}`,

      subtitle: (inv) =>
        inv.project_name || inv.client_name || undefined,

      status: {
        current: (inv) => inv.status,
        config: INVOICE_STATUS_CONFIG as Record<string, { label: string }>,
        onChange: (inv, newStatus) => onStatusChange?.(inv.id, newStatus)
      },

      meta: (inv) => [
        {
          label: 'Amount',
          value: formatCurrency(inv.amount_total)
        },
        {
          label: 'Due Date',
          value: inv.due_date ? formatDate(inv.due_date) : undefined
        },
        {
          label: 'Created',
          value: formatDate(inv.created_at)
        }
      ],

      actions: (inv) => (
        <>
          {inv.status === 'draft' && onSend && (
            <IconButton
              action="send"
              onClick={handleSend}
              title={isSending ? 'Sending...' : 'Send Invoice'}
            />
          )}
          {['sent', 'overdue', 'pending'].includes(inv.status) && onMarkPaid && (
            <IconButton
              action="edit"
              icon="check"
              onClick={() => onMarkPaid(inv.id)}
              title="Mark as Paid"
            />
          )}
          {inv.status !== 'draft' && onDownloadPdf && (
            <IconButton
              action="download"
              onClick={() => onDownloadPdf(inv.id)}
              title="Download PDF"
            />
          )}
        </>
      ),

      tabs: (inv) => {
        const tabs = [
          {
            id: 'details',
            label: 'Details',
            render: () => {
              const isDraftInv = inv.status === 'draft';

              const fields: PanelMetaField[] = [
                {
                  label: 'Project',
                  value: inv.project_name,
                  onClick: inv.project_id ? () => handleNavigateToProject(inv.project_id) : undefined,
                  visible: !!inv.project_name
                },
                {
                  label: 'Client',
                  value: inv.client_name,
                  visible: !!inv.client_name
                },
                {
                  label: 'Invoice Number',
                  render: isDraftInv ? (
                    <InlineEdit
                      value={inv.invoice_number || ''}
                      onSave={(v) => handleSaveField('invoice_number', v)}
                      placeholder="Set invoice number"
                    />
                  ) : undefined,
                  value: isDraftInv ? undefined : inv.invoice_number,
                  visible: true
                },
                {
                  label: 'Amount',
                  render: isDraftInv ? (
                    <InlineEdit
                      value={String(typeof inv.amount_total === 'string' ? inv.amount_total : inv.amount_total || 0)}
                      type="currency"
                      formatDisplay={formatCurrencyDisplay}
                      parseInput={parseCurrencyInput}
                      onSave={(v) => handleSaveField('amount_total', v)}
                      placeholder="Set amount"
                    />
                  ) : undefined,
                  value: isDraftInv ? undefined : formatCurrency(inv.amount_total),
                  visible: true
                },
                {
                  label: 'Due Date',
                  render: isDraftInv ? (
                    <InlineEdit
                      value={inv.due_date || ''}
                      type="date"
                      onSave={(v) => handleSaveField('due_date', v)}
                      placeholder="Set due date"
                    />
                  ) : undefined,
                  value: isDraftInv ? undefined : (inv.due_date ? formatDate(inv.due_date) : undefined),
                  visible: true
                },
                {
                  label: 'Paid Date',
                  value: inv.paid_date ? formatDate(inv.paid_date) : undefined,
                  visible: !!inv.paid_date
                },
                {
                  label: 'Notes',
                  render: isDraftInv ? (
                    <InlineEdit
                      value={inv.notes || ''}
                      onSave={(v) => handleSaveField('notes', v)}
                      placeholder="Add notes"
                    />
                  ) : undefined,
                  value: isDraftInv ? undefined : (inv.notes || undefined),
                  visible: isDraftInv || !!inv.notes
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
                { label: 'Created', date: inv.created_at },
                { label: 'Due', date: inv.due_date },
                { label: 'Paid', date: inv.paid_date }
              ];

              return <Timeline events={events} formatDate={formatDate} />;
            }
          }
        ];

        return tabs;
      }
    }),
    [onStatusChange, onSend, onMarkPaid, onDownloadPdf, handleSend, isSending, handleSaveField, handleNavigateToProject]
  );

  return <DetailPanel entity={invoice} onClose={onClose} config={config} />;
}
