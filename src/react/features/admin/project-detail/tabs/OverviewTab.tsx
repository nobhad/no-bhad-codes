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
import { InlineEdit, formatCurrencyDisplay, parseCurrencyInput } from '@react/components/portal/InlineEdit';
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
  showNotification
}: OverviewTabProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();

  // Toggle milestone expansion
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

  // Handle add milestone
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

  // Handle toggle milestone
  const handleToggleMilestone = useCallback(
    async (id: number) => {
      const success = await onToggleMilestone(id);
      if (!success) {
        showNotification?.('Failed to update milestone', 'error');
      }
    },
    [onToggleMilestone, showNotification]
  );

  // Handle delete milestone
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

  // Handle inline edit save
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
    <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
      {/* Left Column - Project Info */}
      <div className="lg:tw-col-span-2 tw-flex tw-flex-col tw-gap-6">
        {/* Project Details Card */}
        <div className="tw-panel">
          <h3 className="tw-section-title">
            Project Details
          </h3>

          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            {/* Project Type */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Type</span>
              <span className="tw-text-primary">
                {PROJECT_TYPE_LABELS[project.project_type || ''] || project.project_type || ''}
              </span>
            </div>

            {/* Timeline */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Timeline</span>
              <span className="tw-text-primary">
                {project.timeline || ''}
              </span>
            </div>

            {/* Start Date */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Start Date</span>
              <span className="tw-text-primary tw-flex tw-items-center tw-gap-1">
                <Calendar className="icon-xs" />
                {formatDate(project.start_date)}
              </span>
            </div>

            {/* End Date */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Target End Date</span>
              <span className="tw-text-primary tw-flex tw-items-center tw-gap-1">
                <Calendar className="icon-xs" />
                {formatDate(project.end_date)}
              </span>
            </div>

            {/* Budget */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Budget</span>
              <div className="tw-flex tw-items-center tw-gap-1">
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

            {/* Price */}
            <div className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-label">Quoted Price</span>
              <div className="tw-flex tw-items-center tw-gap-1">
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

          {/* Description */}
          {project.description && (
            <div className="tw-divider tw-mt-4 tw-pt-4 tw-border-t tw-border-[var(--portal-border-color)]">
              <span className="tw-label tw-block tw-mb-1">
                Description
              </span>
              <p className="tw-text-muted tw-text-sm">
                {project.description}
              </p>
            </div>
          )}
        </div>

        {/* URLs Card */}
        {(project.preview_url || project.repo_url || project.production_url) && (
          <div className="tw-panel">
            <h3 className="tw-section-title ">
              Links
            </h3>

            <div className="tw-flex tw-flex-col tw-gap-3">
              {project.preview_url && (
                <a
                  href={project.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-list-item tw-text-primary hover:tw-underline"
                >
                  <LinkIcon className="icon-md" />
                  Preview URL
                  <ExternalLink className="icon-xs" />
                </a>
              )}
              {project.repo_url && (
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-list-item tw-text-primary hover:tw-underline"
                >
                  <LinkIcon className="icon-md" />
                  Repository
                  <ExternalLink className="icon-xs" />
                </a>
              )}
              {project.production_url && (
                <a
                  href={project.production_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-list-item tw-text-primary hover:tw-underline"
                >
                  <LinkIcon className="icon-md" />
                  Production URL
                  <ExternalLink className="icon-xs" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Milestones Card */}
        <div className="tw-panel">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
            <h3 className="tw-section-title">
              Milestones
            </h3>
            <button
              className="btn-ghost"
              onClick={() => setShowAddMilestone(true)}
            >
              <Plus className="icon-md" />
              Add
            </button>
          </div>

          {/* Progress Bar */}
          <div className="tw-mb-4">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
              <span className="tw-label">Progress</span>
              <span className="tw-text-primary tw-text-sm">{progress}%</span>
            </div>
            <div className="tw-progress-track">
              <div
                className="tw-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Add Milestone Form */}
          {showAddMilestone && (
            <div className="tw-card tw-flex tw-items-center tw-gap-2 tw-mb-4">
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
                className="tw-input tw-flex-1 tw-text-sm"
              />
              <button className="btn-primary" onClick={handleAddMilestone}>
                Add
              </button>
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
            <div className="tw-flex tw-flex-col tw-gap-2">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="tw-card"
                >
                  <div
                    className="tw-list-item"
                    onClick={() => toggleMilestoneExpand(milestone.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMilestone(milestone.id);
                      }}
                      className={cn(
                        'tw-w-5 tw-h-5 tw-border tw-flex tw-items-center tw-justify-center tw-transition-colors tw-rounded-none',
                        milestone.is_completed
                          ? 'tw-bg-white tw-border-primary'
                          : 'tw-border-[var(--portal-border-color)] hover:tw-border-primary'
                      )}
                    >
                      {milestone.is_completed && (
                        <Check className="icon-xs tw-text-black" />
                      )}
                    </button>

                    <span
                      className={cn(
                        'tw-flex-1 ',
                        milestone.is_completed
                          ? 'tw-text-muted tw-line-through'
                          : 'tw-text-primary'
                      )}
                    >
                      {decodeHtmlEntities(milestone.title)}
                    </span>

                    {milestone.due_date && (
                      <span className="tw-text-muted tw-text-sm">
                        {formatDate(milestone.due_date)}
                      </span>
                    )}

                    {expandedMilestones.has(milestone.id) ? (
                      <ChevronDown className="icon-md" />
                    ) : (
                      <ChevronRight className="icon-md" />
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedMilestones.has(milestone.id) && (
                    <div className="tw-px-3 tw-pb-3 tw-pt-0 tw-ml-8 ">
                      {milestone.description && (
                        <p className="tw-text-muted tw-mt-2 tw-text-sm">
                          {decodeHtmlEntities(milestone.description)}
                        </p>
                      )}

                      {milestone.deliverables && milestone.deliverables.length > 0 && (
                        <ul className="tw-mt-2 tw-space-y-1">
                          {milestone.deliverables.map((deliverable, idx) => (
                            <li
                              key={idx}
                              className="tw-text-muted tw-flex tw-items-start tw-gap-1 tw-text-sm"
                            >
                              <span>•</span>
                              {deliverable}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="tw-mt-3 tw-flex tw-justify-end">
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
      <div className="tw-flex tw-flex-col tw-gap-6">
        {/* Client Info Card */}
        <div className="tw-panel">
          <h3 className="tw-section-title ">
            Client
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-3">
            {project.contact_name && (
              <div className="tw-flex tw-items-center tw-gap-2">
                <User className="icon-md" />
                <span className="tw-text-primary ">
                  {project.contact_name}
                </span>
              </div>
            )}

            {project.company_name && (
              <div className="tw-flex tw-items-center tw-gap-2">
                <Building className="icon-md" />
                <span className="tw-text-primary ">
                  {project.company_name}
                </span>
              </div>
            )}

            {project.email && (
              <div className="tw-flex tw-items-center tw-gap-2">
                <Mail className="icon-md" />
                <a
                  href={`mailto:${project.email}`}
                  className="tw-text-primary "
                >
                  {project.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="tw-panel">
          <h3 className="tw-section-title ">
            Financials
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-4">
            <div className="tw-stat-card tw-flex tw-items-center tw-justify-between">
              <span className="tw-stat-label">
                Outstanding Balance
              </span>
              <span className="tw-stat-value">
                {formatCurrency(outstandingBalance)}
              </span>
            </div>

            <div className="tw-stat-card tw-flex tw-items-center tw-justify-between">
              <span className="tw-stat-label">
                Total Paid
              </span>
              <span className="tw-stat-value">
                {formatCurrency(totalPaid)}
              </span>
            </div>

            {project.deposit_amount !== undefined && project.deposit_amount > 0 && (
              <div className="tw-stat-card tw-flex tw-items-center tw-justify-between">
                <span className="tw-stat-label">
                  Deposit Amount
                </span>
                <span className="tw-stat-value">
                  {formatCurrency(project.deposit_amount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="tw-panel">
          <h3 className="tw-section-title ">
            Quick Stats
          </h3>

          <div className="tw-grid-stats tw-grid tw-grid-cols-2">
            <div className="tw-stat-card">
              <span className="tw-stat-label">Files</span>
              <span className="tw-stat-value">
                {project.file_count ?? 0}
              </span>
            </div>

            <div className="tw-stat-card">
              <span className="tw-stat-label">Messages</span>
              <span className="tw-stat-value">
                {project.message_count ?? 0}
                {(project.unread_count ?? 0) > 0 && (
                  <span className="tw-ml-1 tw-text-sm">
                    ({project.unread_count} new)
                  </span>
                )}
              </span>
            </div>

            <div className="tw-stat-card">
              <span className="tw-stat-label">Milestones</span>
              <span className="tw-stat-value">
                {milestones.filter((m) => m.is_completed).length}/{milestones.length}
              </span>
            </div>

            <div className="tw-stat-card">
              <span className="tw-stat-label">Created</span>
              <span className="tw-text-primary ">
                {formatDate(project.created_at)}
              </span>
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
