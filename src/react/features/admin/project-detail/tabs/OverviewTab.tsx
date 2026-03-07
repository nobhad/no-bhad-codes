import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  Calendar,
  DollarSign,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  Mail,
  Building,
  User,
  ListTodo
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { InlineEdit, InlineSelect, InlineTextarea, formatCurrencyDisplay, parseCurrencyInput } from '@react/components/portal/InlineEdit';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { Project, ProjectMilestone } from '../../types';
import { PROJECT_TYPE_LABELS } from '../../types';
import { formatCurrency } from '../../../../../utils/format-utils';
import { decodeHtmlEntities } from '@react/utils/decodeText';

interface OverviewTabProps {
  project: Project;
  milestones: ProjectMilestone[];
  progress: number;
  outstandingBalance: number;
  totalPaid: number;
  onUpdateProject: (updates: Partial<Project>) => Promise<boolean>;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onToggleMilestone: (id: number) => Promise<boolean>;
  onDeleteMilestone: (id: number) => Promise<boolean>;
  onNavigate?: (tab: string, entityId?: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date for display
 */
function formatDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/** Project type options for InlineSelect */
const PROJECT_TYPE_OPTIONS = [
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' }
];

/**
 * OverviewTab
 * Project overview with key information, progress, and milestones
 */
export function OverviewTab({
  project,
  milestones,
  progress,
  outstandingBalance,
  totalPaid,
  onUpdateProject,
  onAddMilestone,
  onToggleMilestone,
  onDeleteMilestone,
  onNavigate,
  showNotification
}: OverviewTabProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();

  const toggleMilestoneExpand = useCallback((id: number) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddMilestone = useCallback(async () => {
    if (!newMilestoneTitle.trim()) return;

    const success = await onAddMilestone({
      title: newMilestoneTitle.trim(),
      is_completed: false
    });

    if (success) {
      setNewMilestoneTitle('');
      setShowAddMilestone(false);
      showNotification?.('Milestone added', 'success');
    } else {
      showNotification?.('Failed to add milestone', 'error');
    }
  }, [newMilestoneTitle, onAddMilestone, showNotification]);

  const handleToggleMilestone = useCallback(
    async (id: number) => {
      const success = await onToggleMilestone(id);
      if (!success) {
        showNotification?.('Failed to update milestone', 'error');
      }
    },
    [onToggleMilestone, showNotification]
  );

  const handleDeleteMilestone = useCallback(async () => {
    if (deletingMilestoneId === null) return;

    const success = await onDeleteMilestone(deletingMilestoneId);
    if (success) {
      showNotification?.('Milestone deleted', 'success');
    } else {
      showNotification?.('Failed to delete milestone', 'error');
    }
    setDeletingMilestoneId(null);
  }, [deletingMilestoneId, onDeleteMilestone, showNotification]);

  const handleSaveField = useCallback(
    async (field: keyof Project, value: string): Promise<boolean> => {
      const success = await onUpdateProject({ [field]: value });
      if (success) {
        showNotification?.('Updated successfully', 'success');
      } else {
        showNotification?.('Failed to update', 'error');
      }
      return success;
    },
    [onUpdateProject, showNotification]
  );

  return (
    <div className="project-overview-grid">
      {/* Left Column - Project Info */}
      <div className="project-overview-main">
        {/* Project Details Card */}
        <div className="tw-panel">
          <h3 className="section-title">Project Details</h3>

          <div className="project-info-grid">
            <div className="project-info-field">
              <span className="field-label">Type</span>
              <InlineSelect
                value={project.project_type || ''}
                options={PROJECT_TYPE_OPTIONS}
                placeholder="Select type"
                formatDisplay={(val) => PROJECT_TYPE_LABELS[val] || val || 'Select type'}
                onSave={(value) => handleSaveField('project_type', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Timeline</span>
              <InlineEdit
                value={project.timeline || ''}
                type="text"
                placeholder="Set timeline"
                onSave={(value) => handleSaveField('timeline', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Start Date</span>
              <div className="project-info-field-value">
                <Calendar className="icon-xs" />
                <InlineEdit
                  value={project.start_date || ''}
                  type="date"
                  placeholder="Set start date"
                  onSave={(value) => handleSaveField('start_date', value)}
                />
              </div>
            </div>

            <div className="project-info-field">
              <span className="field-label">Target End Date</span>
              <div className="project-info-field-value">
                <Calendar className="icon-xs" />
                <InlineEdit
                  value={project.end_date || ''}
                  type="date"
                  placeholder="Set end date"
                  onSave={(value) => handleSaveField('end_date', value)}
                />
              </div>
            </div>

            <div className="project-info-field">
              <span className="field-label">Budget</span>
              <div className="project-info-field-value">
                <DollarSign className="icon-xs" />
                <InlineEdit
                  value={String(project.budget || '')}
                  type="currency"
                  placeholder="Set budget"
                  formatDisplay={formatCurrencyDisplay}
                  parseInput={parseCurrencyInput}
                  onSave={(value) => handleSaveField('budget', value)}
                />
              </div>
            </div>

            <div className="project-info-field">
              <span className="field-label">Quoted Price</span>
              <div className="project-info-field-value">
                <DollarSign className="icon-xs" />
                <InlineEdit
                  value={String(project.price || '')}
                  type="currency"
                  placeholder="Set price"
                  formatDisplay={formatCurrencyDisplay}
                  parseInput={parseCurrencyInput}
                  onSave={(value) => handleSaveField('price', value)}
                />
              </div>
            </div>
          </div>

          <div className="panel-description">
            <span className="field-label">Description</span>
            <InlineTextarea
              value={project.description || ''}
              placeholder="Add description"
              onSave={(value) => handleSaveField('description', value)}
            />
          </div>
        </div>

        {/* URLs Card */}
        <div className="tw-panel">
          <h3 className="section-title">Links</h3>
          <div className="project-info-grid">
            <div className="project-info-field">
              <div className="field-label">
                <LinkIcon className="icon-xs" /> Preview URL
                {project.preview_url && (
                  <a href={project.preview_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open preview URL">
                    <ExternalLink className="icon-xs" />
                  </a>
                )}
              </div>
              <InlineEdit
                value={project.preview_url || ''}
                type="text"
                placeholder="Set preview URL"
                onSave={(value) => handleSaveField('preview_url', value)}
              />
            </div>

            <div className="project-info-field">
              <div className="field-label">
                <LinkIcon className="icon-xs" /> Repository
                {project.repo_url && (
                  <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open repository URL">
                    <ExternalLink className="icon-xs" />
                  </a>
                )}
              </div>
              <InlineEdit
                value={project.repo_url || ''}
                type="text"
                placeholder="Set repository URL"
                onSave={(value) => handleSaveField('repo_url', value)}
              />
            </div>

            <div className="project-info-field">
              <div className="field-label">
                <LinkIcon className="icon-xs" /> Production URL
                {project.production_url && (
                  <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open production URL">
                    <ExternalLink className="icon-xs" />
                  </a>
                )}
              </div>
              <InlineEdit
                value={project.production_url || ''}
                type="text"
                placeholder="Set production URL"
                onSave={(value) => handleSaveField('production_url', value)}
              />
            </div>
          </div>
        </div>

        {/* Milestones Card */}
        <div className="tw-panel">
          <div className="panel-card-header">
            <h3 className="section-title">Milestones</h3>
            <button className="btn-ghost" onClick={() => setShowAddMilestone(true)}>
              <Plus className="icon-md" />
              Add
            </button>
          </div>

          {/* Progress Bar */}
          <div className="progress-field">
            <div className="progress-field-header">
              <span className="field-label">Progress</span>
              <span className="text-muted">{progress}%</span>
            </div>
            <div className="progress-bar progress-sm">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Add Milestone Form */}
          {showAddMilestone && (
            <div className="milestone-add-form">
              <input
                type="text"
                placeholder="Milestone title..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMilestone();
                  if (e.key === 'Escape') {
                    setShowAddMilestone(false);
                    setNewMilestoneTitle('');
                  }
                }}
                autoFocus
                className="form-input"
                style={{ flex: 1 }}
              />
              <PortalButton variant="primary" size="sm" onClick={handleAddMilestone}>
                Add
              </PortalButton>
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowAddMilestone(false);
                  setNewMilestoneTitle('');
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Milestones List */}
          {milestones.length === 0 ? (
            <div className="empty-state">
              <ListTodo className="icon-xl" />
              <span>No milestones yet</span>
            </div>
          ) : (
            <div className="milestone-list">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="milestone-item-wrapper">
                  {/* Milestone row */}
                  <div className="milestone-item">
                    <button
                      className={cn(
                        'milestone-checkbox',
                        milestone.is_completed && 'is-completed'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMilestone(milestone.id);
                      }}
                      aria-label={milestone.is_completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {milestone.is_completed && <Check className="icon-xs" />}
                    </button>

                    <div
                      className="milestone-content"
                      onClick={() => toggleMilestoneExpand(milestone.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleMilestoneExpand(milestone.id);
                        }
                      }}
                    >
                      <span
                        className={cn(
                          'milestone-title',
                          milestone.is_completed && 'completed'
                        )}
                      >
                        {decodeHtmlEntities(milestone.title)}
                      </span>

                      {milestone.due_date && (
                        <span className="milestone-due">{formatDate(milestone.due_date)}</span>
                      )}
                    </div>

                    <button
                      className="icon-btn"
                      onClick={() => toggleMilestoneExpand(milestone.id)}
                      aria-label={expandedMilestones.has(milestone.id) ? 'Collapse' : 'Expand'}
                    >
                      {expandedMilestones.has(milestone.id) ? (
                        <ChevronDown className="icon-sm" />
                      ) : (
                        <ChevronRight className="icon-sm" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {expandedMilestones.has(milestone.id) && (
                    <div className="milestone-expanded-content">
                      {milestone.description && (
                        <p className="milestone-description">
                          {decodeHtmlEntities(milestone.description)}
                        </p>
                      )}

                      {milestone.deliverables && milestone.deliverables.length > 0 && (
                        <ul className="milestone-deliverables">
                          {milestone.deliverables.map((deliverable, idx) => (
                            <li key={idx} className="milestone-description">
                              <span>•</span>
                              {deliverable}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="milestone-actions">
                        <button
                          className="btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingMilestoneId(milestone.id);
                            deleteDialog.open();
                          }}
                        >
                          <Trash2 className="icon-xs" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="project-overview-sidebar">
        {/* Client Info Card */}
        <div className="tw-panel">
          <h3 className="section-title">Client</h3>

          <div className="link-list">
            {project.contact_name && (
              <div className="project-info-field-value">
                <User className="icon-md" />
                {project.client_id && onNavigate ? (
                  <button
                    className="client-nav-link"
                    onClick={() => onNavigate('client-detail', String(project.client_id))}
                  >
                    {project.contact_name}
                  </button>
                ) : (
                  <span>{project.contact_name}</span>
                )}
              </div>
            )}

            {project.company_name && (
              <div className="project-info-field-value">
                <Building className="icon-md" />
                {project.client_id && onNavigate ? (
                  <button
                    className="client-nav-link"
                    onClick={() => onNavigate('client-detail', String(project.client_id))}
                  >
                    {project.company_name}
                  </button>
                ) : (
                  <span>{project.company_name}</span>
                )}
              </div>
            )}

            {project.email && (
              <div className="project-info-field-value">
                <Mail className="icon-md" />
                <a href={`mailto:${project.email}`} className="text-primary">
                  {project.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="tw-panel">
          <h3 className="section-title">Financials</h3>

          <div>
            <div className="financial-row">
              <span className="financial-row-label">Outstanding Balance</span>
              <span className="financial-row-value">{formatCurrency(outstandingBalance)}</span>
            </div>

            <div className="financial-row">
              <span className="financial-row-label">Total Paid</span>
              <span className="financial-row-value">{formatCurrency(totalPaid)}</span>
            </div>

            {project.deposit_amount !== undefined && project.deposit_amount > 0 && (
              <div className="financial-row">
                <span className="financial-row-label">Deposit Amount</span>
                <span className="financial-row-value">{formatCurrency(project.deposit_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="tw-panel">
          <h3 className="section-title">Quick Stats</h3>

          <div className="quick-stats-grid">
            <div className="stat-card">
              <span className="stat-label">Files</span>
              <span className="stat-value">{project.file_count ?? 0}</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Messages</span>
              <span className="stat-value">
                {project.message_count ?? 0}
                {(project.unread_count ?? 0) > 0 && (
                  <span className="text-muted"> ({project.unread_count} new)</span>
                )}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Milestones</span>
              <span className="stat-value">
                {milestones.filter((m) => m.is_completed).length}/{milestones.length}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Created</span>
              <span className="text-muted">{formatDate(project.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Milestone Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteMilestone}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
