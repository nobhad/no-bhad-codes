/**
 * LeadDetailPanel
 * Slide-in overlay panel showing lead details with tabs (Overview, Tasks, Notes).
 * Replaces the old vanilla JS showLeadDetails() from admin-leads.ts.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronDown,
  Check,
  Pin,
  Trash2,
  Rocket,
  Copy
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { IconButton } from '@react/factories';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { Lead, LeadStatus } from '../types';
import { LEAD_STATUS_CONFIG, LEAD_SOURCE_LABELS, PROJECT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';
import { createLogger } from '../../../../utils/logger';

const logger = createLogger('LeadDetailPanel');

// ============================================
// TYPES
// ============================================

interface LeadTask {
  id: number;
  title: string;
  status: string;
  task_type?: string;
  due_date?: string;
}

interface LeadNote {
  id: number;
  content: string;
  is_pinned: boolean;
  author?: string;
  created_at: string;
}

type PanelTab = 'overview' | 'tasks' | 'notes';

// ============================================
// PROPS
// ============================================

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange?: (leadId: number, status: LeadStatus) => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// COMPONENT
// ============================================

export function LeadDetailPanel({
  lead,
  onClose,
  onStatusChange,
  onNavigate,
  getAuthToken,
  showNotification
}: LeadDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('overview');
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const activateDialog = useConfirmDialog();

  const isOpen = lead !== null;

  // Auth headers
  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAuthToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  // Fetch tasks for lead
  const fetchTasks = useCallback(async (leadId: number) => {
    setIsLoadingTasks(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/${leadId}/tasks`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        const data = unwrapApiData<Record<string, unknown>>(await response.json());
        setTasks((data.tasks as LeadTask[]) || []);
      }
    } catch (err) {
      logger.error('Failed to fetch tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [getHeaders]);

  // Fetch notes for lead
  const fetchNotes = useCallback(async (leadId: number) => {
    setIsLoadingNotes(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/${leadId}/notes`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        const data = unwrapApiData<Record<string, unknown>>(await response.json());
        setNotes((data.notes as LeadNote[]) || []);
      }
    } catch (err) {
      logger.error('Failed to fetch notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [getHeaders]);

  // Load tasks + notes when lead changes
  useEffect(() => {
    if (lead) {
      setActiveTab('overview');
      fetchTasks(lead.id);
      fetchNotes(lead.id);
    } else {
      setTasks([]);
      setNotes([]);
    }
  }, [lead, fetchTasks, fetchNotes]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Complete a task
  const handleCompleteTask = useCallback(async (taskId: number) => {
    if (!lead) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'completed' } : t));
        showNotification?.('Task completed', 'success');
      }
    } catch (err) {
      logger.error('Failed to complete task:', err);
      showNotification?.('Failed to complete task', 'error');
    }
  }, [lead, getHeaders, showNotification]);

  // Toggle note pin
  const handleTogglePin = useCallback(async (noteId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/notes/${noteId}/toggle-pin`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, is_pinned: !n.is_pinned } : n));
      }
    } catch (err) {
      logger.error('Failed to toggle pin:', err);
    }
  }, [getHeaders]);

  // Delete a note
  const handleDeleteNote = useCallback(async (noteId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/notes/${noteId}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        showNotification?.('Note deleted', 'success');
      }
    } catch (err) {
      logger.error('Failed to delete note:', err);
      showNotification?.('Failed to delete note', 'error');
    }
  }, [getHeaders, showNotification]);

  // Copy email to clipboard
  const handleCopyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      showNotification?.('Email copied to clipboard', 'info');
    });
  }, [showNotification]);

  // Activate lead as project
  const handleActivate = useCallback(async () => {
    if (!lead) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.LEADS}/${lead.id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: 'in-progress' })
      });
      if (response.ok) {
        onStatusChange?.(lead.id, 'in-progress');
        showNotification?.('Lead activated as project', 'success');
        onClose();
      }
    } catch (err) {
      logger.error('Failed to activate lead:', err);
      showNotification?.('Failed to activate lead', 'error');
    }
  }, [lead, getHeaders, onStatusChange, showNotification, onClose]);

  if (!isOpen || !lead) return null;

  const canActivate = ['new', 'contacted', 'qualified'].includes(lead.status);
  const decodedName = decodeHtmlEntities(lead.contact_name) || 'Unknown';
  const decodedCompany = decodeHtmlEntities(lead.company_name);

  return createPortal(
    <>
      {/* Overlay backdrop */}
      <div className="details-overlay" onClick={onClose} />

      {/* Panel */}
      <div ref={panelRef} id="lead-details-panel" className="details-panel" role="dialog" aria-label="Lead details">
        {/* Header */}
        <div className="details-header">
          <h3>{decodedName}</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close panel">
            <X />
          </button>
        </div>

        {/* Created date */}
        <div className="field-label" style={{ marginBottom: 'var(--space-2)' }}>
          Created {formatDate(lead.created_at)}
        </div>

        {/* Actions row */}
        <div className="details-actions">
          {canActivate && (
            <button
              className="icon-btn icon-btn-outline"
              onClick={activateDialog.open}
              title="Activate as Project"
            >
              <Rocket className="icon-sm" />
            </button>
          )}
          {lead.email && (
            <IconButton
              action="email"
              onClick={() => window.location.href = `mailto:${lead.email}`}
              title="Send email"
            />
          )}
        </div>

        {/* Status row */}
        <div className="panel-status-row">
          <span className="field-label">Status</span>
          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="status-dropdown-trigger">
                <StatusBadge status={getStatusVariant(lead.status)}>
                  {LEAD_STATUS_CONFIG[lead.status]?.label || lead.status}
                </StatusBadge>
                <ChevronDown className="status-dropdown-caret" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent sideOffset={0} align="start">
              {Object.entries(LEAD_STATUS_CONFIG)
                .filter(([status]) => status !== lead.status)
                .map(([status, config]) => (
                  <PortalDropdownItem
                    key={status}
                    onClick={() => onStatusChange?.(lead.id, status as LeadStatus)}
                  >
                    <StatusBadge status={getStatusVariant(status)} size="sm">
                      {config.label}
                    </StatusBadge>
                  </PortalDropdownItem>
                ))}
            </PortalDropdownContent>
          </PortalDropdown>
        </div>

        {/* Tabs */}
        <div className="details-content">
          <div className="lead-details-tabs">
            <button
              className={cn('lead-tab', activeTab === 'overview' && 'active')}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={cn('lead-tab', activeTab === 'tasks' && 'active')}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks ({tasks.length})
            </button>
            <button
              className={cn('lead-tab', activeTab === 'notes' && 'active')}
              onClick={() => setActiveTab('notes')}
            >
              Notes ({notes.length})
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="lead-tab-content active">
              <div className="project-detail-meta">
                {lead.project_name && (
                  <MetaItem label="Project" value={decodeHtmlEntities(lead.project_name)} />
                )}
                {decodedCompany && (
                  <MetaItem
                    label="Company"
                    value={decodedCompany}
                    onClick={lead.client_id ? () => onNavigate?.('clients', String(lead.client_id)) : undefined}
                  />
                )}
                <MetaItem label="Name" value={decodedName} />
                <MetaItem label="Email">
                  <span className="meta-value meta-value-with-copy">
                    {lead.email}
                    {lead.email && (
                      <button
                        className="copy-email-btn"
                        onClick={() => handleCopyEmail(lead.email)}
                        title="Copy email"
                      >
                        <Copy className="icon-xs" />
                      </button>
                    )}
                  </span>
                </MetaItem>
                {lead.phone && <MetaItem label="Phone" value={lead.phone} />}
                {lead.source && (
                  <MetaItem label="Source" value={LEAD_SOURCE_LABELS[lead.source] || lead.source} />
                )}
                {lead.project_type && (
                  <MetaItem label="Project Type" value={PROJECT_TYPE_LABELS[lead.project_type] || lead.project_type} />
                )}
                {lead.budget_range && <MetaItem label="Budget" value={lead.budget_range} />}
                {lead.timeline && <MetaItem label="Timeline" value={lead.timeline} />}
              </div>

              {lead.description && (
                <div className="project-description-row">
                  <div className="meta-item description-item">
                    <span className="field-label">Description</span>
                    <span className="meta-value">{decodeHtmlEntities(lead.description)}</span>
                  </div>
                </div>
              )}

              {lead.features && (
                <div className="project-description-row">
                  <div className="meta-item description-item">
                    <span className="field-label">Features</span>
                    <span className="meta-value">{decodeHtmlEntities(lead.features.replace(/,/g, ', '))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="lead-tab-content active">
              {isLoadingTasks ? (
                <div className="loading-state"><div className="loading-spinner" /></div>
              ) : tasks.length === 0 ? (
                <div className="empty-state">
                  <span>No tasks yet</span>
                </div>
              ) : (
                <ul className="activity-feed">
                  {tasks.map((task) => (
                    <li key={task.id} className="lead-task-item activity-feed-item">
                      <button
                        className={cn('icon-btn icon-btn-ghost', task.status === 'completed' && 'task-done')}
                        onClick={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                        title={task.status === 'completed' ? 'Completed' : 'Mark complete'}
                        disabled={task.status === 'completed'}
                      >
                        <Check className="icon-sm" />
                      </button>
                      <div className="activity-body">
                        <span className="activity-text" style={task.status === 'completed' ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span className="activity-time">{formatDate(task.due_date)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="lead-tab-content active">
              {isLoadingNotes ? (
                <div className="loading-state"><div className="loading-spinner" /></div>
              ) : notes.length === 0 ? (
                <div className="empty-state">
                  <span>No notes yet</span>
                </div>
              ) : (
                <ul className="activity-feed">
                  {[...notes].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).map((note) => (
                    <li key={note.id} className="lead-note-item activity-feed-item">
                      <div className="activity-body">
                        <span className="activity-text">{note.content}</span>
                        <span className="activity-time">
                          {note.author && `${note.author} · `}
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                      <div className="table-actions">
                        <button
                          className={cn('icon-btn icon-btn-ghost', note.is_pinned && 'active')}
                          onClick={() => handleTogglePin(note.id)}
                          title={note.is_pinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin className="icon-xs" />
                        </button>
                        <button
                          className="icon-btn icon-btn-ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                        >
                          <Trash2 className="icon-xs" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Activate confirmation */}
      <ConfirmDialog
        open={activateDialog.isOpen}
        onOpenChange={activateDialog.setIsOpen}
        title="Activate Lead"
        description="Activate this lead as a project? This will change the status to In Progress."
        confirmText="Activate"
        onConfirm={handleActivate}
      />
    </>,
    document.body
  );
}

// ============================================
// META ITEM HELPER
// ============================================

function MetaItem({
  label,
  value,
  onClick,
  children
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="meta-item">
      <span className="field-label">{label}</span>
      {children || (
        onClick ? (
          <a href="#" className="meta-value panel-link" onClick={(e) => { e.preventDefault(); onClick(); }}>
            {value}
          </a>
        ) : (
          <span className="meta-value">{value || '—'}</span>
        )
      )}
    </div>
  );
}
