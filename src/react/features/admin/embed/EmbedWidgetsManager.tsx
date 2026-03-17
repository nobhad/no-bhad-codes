/**
 * ===============================================
 * EMBED WIDGETS MANAGER
 * ===============================================
 * @file src/react/features/admin/embed/EmbedWidgetsManager.tsx
 *
 * Admin page for managing embeddable widget configurations.
 * Create, edit, copy embed code, and manage widgets.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Code, Inbox, Copy as _Copy, RefreshCw as _RefreshCw, Check as _Check, Plus as _Plus, Trash2 as _Trash2 } from 'lucide-react';
import { IconButton } from '@react/factories';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { StatusBadge, type StatusVariant } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { apiFetch, apiPost, apiPut as _apiPut, apiDelete } from '@/utils/api-client';
import { showToast } from '@/utils/toast-notifications';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

// ============================================
// Constants
// ============================================

const WIDGET_TYPE_LABELS: Record<string, string> = {
  contact_form: 'Contact Form',
  testimonials: 'Testimonials',
  status_badge: 'Status Badge'
};

const WIDGET_TYPE_OPTIONS = [
  { value: 'contact_form', label: 'Contact Form' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'status_badge', label: 'Status Badge' }
];

// ============================================
// Types
// ============================================

interface EmbedConfig {
  id: number;
  widgetType: string;
  name: string;
  token: string;
  config: Record<string, unknown>;
  allowedDomains: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Helpers
// ============================================

const MASK_VISIBLE_CHARS = 8;

function maskToken(token: string): string {
  if (token.length <= MASK_VISIBLE_CHARS) return token;
  return `${token.slice(0, MASK_VISIBLE_CHARS)}...`;
}

// ============================================
// COMPONENT
// ============================================

export function EmbedWidgetsManager() {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [widgets, setWidgets] = useState<EmbedConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();

  const [createForm, setCreateForm] = useState({
    widgetType: 'contact_form',
    name: '',
    allowedDomains: ''
  });

  // Fetch widgets
  const fetchWidgets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_ENDPOINTS.EMBED);
      if (!res.ok) throw new Error('Failed to load widgets');
      const json = await res.json();
      setWidgets(json.data?.configurations || json.configurations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load widgets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  // Create widget
  const handleCreate = useCallback(async () => {
    if (!createForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiPost(API_ENDPOINTS.EMBED, {
        widgetType: createForm.widgetType,
        name: createForm.name.trim(),
        allowedDomains: createForm.allowedDomains.trim() || undefined
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to create');
      }
      showToast('Widget created', 'success');
      setShowCreateForm(false);
      setCreateForm({ widgetType: 'contact_form', name: '', allowedDomains: '' });
      fetchWidgets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [createForm, fetchWidgets]);

  // Copy embed code
  const handleCopyCode = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(buildEndpoint.embedWidgetCode(id));
      if (!res.ok) throw new Error('Failed to get embed code');
      const json = await res.json();
      const code = json.data?.embedCode || json.embedCode || '';
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      showToast('Embed code copied', 'success');
      const COPIED_RESET_MS = 2000;
      setTimeout(() => setCopiedId(null), COPIED_RESET_MS);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to copy', 'error');
    }
  }, []);

  // Regenerate token
  const handleRegenerate = useCallback(async (id: number) => {
    try {
      const res = await apiPost(buildEndpoint.embedWidgetRegenerate(id), {});
      if (!res.ok) throw new Error('Failed to regenerate');
      showToast('Token regenerated — update your embed code', 'success');
      fetchWidgets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to regenerate', 'error');
    }
  }, [fetchWidgets]);

  // Delete
  const handleDeleteConfirm = useCallback(async () => {
    if (pendingDeleteId == null) return;
    try {
      const res = await apiDelete(buildEndpoint.embedWidget(pendingDeleteId));
      if (!res.ok) throw new Error('Failed to deactivate');
      showToast('Widget deactivated', 'success');
      setPendingDeleteId(null);
      fetchWidgets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate', 'error');
    }
  }, [pendingDeleteId, fetchWidgets]);

  const openDeleteConfirm = useCallback((id: number) => {
    setPendingDeleteId(id);
    deleteDialog.open();
  }, [deleteDialog]);

  // Stats
  const stats = useMemo(() => {
    const total = widgets.length;
    const active = widgets.filter(w => w.isActive).length;
    const types = new Set(widgets.map(w => w.widgetType)).size;

    return [
      { value: total, label: 'total' },
      { value: active, label: 'active' },
      { value: types, label: 'types' }
    ];
  }, [widgets]);

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="EMBED WIDGETS"
        stats={
          <TableStats
            items={stats}
            tooltip={`${widgets.length} Widget Configurations`}
          />
        }
        actions={
          <>
            <IconButton
              action="add"
              onClick={() => setShowCreateForm(prev => !prev)}
              title="Create widget"
            />
            <IconButton
              action="refresh"
              onClick={fetchWidgets}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
      >
        {/* Create Form */}
        {showCreateForm && (
          <div className="inline-create-form">
            <div className="inline-form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="widget-type">Widget Type</label>
                <select
                  id="widget-type"
                  className="form-input"
                  value={createForm.widgetType}
                  onChange={e => setCreateForm(prev => ({ ...prev, widgetType: e.target.value }))}
                >
                  {WIDGET_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="widget-name">Name</label>
                <input
                  id="widget-name"
                  className="form-input"
                  type="text"
                  placeholder="My Website Contact Form"
                  value={createForm.name}
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="widget-domains">Allowed Domains (optional)</label>
                <input
                  id="widget-domains"
                  className="form-input"
                  type="text"
                  placeholder="example.com, mysite.com"
                  value={createForm.allowedDomains}
                  onChange={e => setCreateForm(prev => ({ ...prev, allowedDomains: e.target.value }))}
                />
              </div>
            </div>

            <div className="inline-form-actions">
              <button className="btn-primary" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Widget'}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="name-col">Name</PortalTableHead>
              <PortalTableHead className="status-col">Type</PortalTableHead>
              <PortalTableHead className="status-col">Status</PortalTableHead>
              <PortalTableHead className="client-col">Token</PortalTableHead>
              <PortalTableHead className="client-col">Domains</PortalTableHead>
              <PortalTableHead className="date-col">Created</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={fetchWidgets} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={3} />
            ) : widgets.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message="No embed widgets yet"
              />
            ) : (
              widgets.map(w => (
                <PortalTableRow key={w.id}>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <Code className="icon-sm" />
                      <span className="cell-title">{w.name}</span>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="status-col">
                    <StatusBadge status="qualified">
                      {WIDGET_TYPE_LABELS[w.widgetType] || w.widgetType}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell className="status-col">
                    <StatusBadge status={w.isActive ? 'active' as StatusVariant : 'inactive' as StatusVariant}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell className="client-cell">
                    <code style={{ fontSize: '12px' }}>{maskToken(w.token)}</code>
                  </PortalTableCell>
                  <PortalTableCell className="client-cell">
                    {w.allowedDomains.length > 0 ? w.allowedDomains.join(', ') : 'Any'}
                  </PortalTableCell>
                  <PortalTableCell className="date-col">
                    {formatDate(w.createdAt)}
                  </PortalTableCell>
                  <PortalTableCell className="col-actions">
                    <div className="action-group">
                      <IconButton
                        action="view"
                        onClick={() => handleCopyCode(w.id)}
                        title={copiedId === w.id ? 'Copied!' : 'Copy embed code'}
                      />
                      <IconButton
                        action="edit"
                        onClick={() => handleRegenerate(w.id)}
                        title="Regenerate token"
                      />
                      <IconButton
                        action="delete"
                        onClick={() => openDeleteConfirm(w.id)}
                        title="Deactivate"
                      />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Deactivate Widget"
        description="Are you sure you want to deactivate this widget? Existing embeds will stop working."
        confirmText="Deactivate"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
