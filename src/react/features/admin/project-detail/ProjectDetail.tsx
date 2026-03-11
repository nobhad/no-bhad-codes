import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Package,
  MessageSquare,
  Receipt,
  FileSignature,
  StickyNote,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  FileText,
  Trash2,
  FolderKanban,
  ChevronDown
} from 'lucide-react';
import { IconButton, TabList, TabPanel } from '@react/factories';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
  PortalDropdownSeparator
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useProjectDetail } from '@react/hooks/useProjectDetail';
import { useFadeIn } from '@react/hooks/useGsap';
import { OverviewTab } from './tabs/OverviewTab';
import { FilesTab } from './tabs/FilesTab';
import { DeliverablesTab } from './tabs/DeliverablesTab';
import { MessagesTab } from './tabs/MessagesTab';
import { InvoicesTab } from './tabs/InvoicesTab';
import { ContractTab } from './tabs/ContractTab';
import { NotesTab } from './tabs/NotesTab';
import { IntakeTab } from './tabs/IntakeTab';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { ProjectDetailTab, ProjectStatus } from '../types';
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '../types';
import { buildEndpoint } from '@/constants/api-endpoints';
import { NOTIFICATIONS, statusUpdatedMessage } from '@/constants/notifications';
import { apiDelete } from '@/utils/api-client';

interface ProjectDetailProps {
  /** Project ID to display */
  projectId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to projects list */
  onBack?: () => void;
  /** Callback to edit project */
  onEdit?: (projectId: number) => void;
  /** Callback to navigate to related entities */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Initial tab to display */
  initialTab?: string;
}

// Tab icon components mapping
const TAB_ICONS: Record<ProjectDetailTab, React.ElementType> = {
  overview: LayoutDashboard,
  files: FolderOpen,
  deliverables: Package,
  messages: MessageSquare,
  invoices: Receipt,
  contract: FileSignature,
  notes: StickyNote,
  intake: ClipboardList
};

// Tab configuration
const TABS: Array<{ id: ProjectDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'messages', label: 'Messages' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'contract', label: 'Contract' },
  { id: 'notes', label: 'Notes' },
  { id: 'intake', label: 'Intake' }
];

/**
 * ProjectDetail
 * Main project detail view with tabbed interface
 */
export function ProjectDetail({
  projectId,
  getAuthToken,
  onBack,
  onEdit,
  onNavigate,
  showNotification,
  initialTab
}: ProjectDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const validTabs: ProjectDetailTab[] = ['overview', 'files', 'deliverables', 'messages', 'invoices', 'contract', 'notes', 'intake'];
  const resolvedInitialTab = validTabs.includes(initialTab as ProjectDetailTab) ? (initialTab as ProjectDetailTab) : 'overview';
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(resolvedInitialTab);

  // Project data
  const {
    project,
    milestones,
    tasks,
    files,
    invoices,
    messages,
    isLoading,
    error,
    progress,
    outstandingBalance,
    totalPaid,
    refetch,
    updateProject,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneComplete,
    toggleTaskComplete,
    assignTaskToMilestone,
    uploadFile,
    deleteFile,
    toggleFileSharing,
    loadMessages,
    sendMessage,
    editMessage,
    reactions,
    toggleReaction
  } = useProjectDetail({ projectId, getAuthToken });

  // Dialogs
  const deleteDialog = useConfirmDialog();
  const archiveDialog = useConfirmDialog();

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: ProjectStatus) => {
      const success = await updateProject({ status: newStatus });
      if (success) {
        showNotification?.(statusUpdatedMessage(PROJECT_STATUS_CONFIG[newStatus].label), 'success');
      } else {
        showNotification?.(NOTIFICATIONS.project.STATUS_UPDATE_FAILED, 'error');
      }
    },
    [updateProject, showNotification]
  );

  // Handle archive
  const handleArchive = useCallback(async () => {
    const success = await updateProject({ status: 'cancelled' });
    if (success) {
      showNotification?.(NOTIFICATIONS.project.ARCHIVED, 'success');
      onBack?.();
    } else {
      showNotification?.(NOTIFICATIONS.project.ARCHIVE_FAILED, 'error');
    }
  }, [updateProject, showNotification, onBack]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      const response = await apiDelete(buildEndpoint.project(projectId));

      if (response.ok) {
        showNotification?.(NOTIFICATIONS.project.DELETED, 'success');
        onBack?.();
      } else {
        showNotification?.(NOTIFICATIONS.project.DELETE_FAILED, 'error');
      }
    } catch {
      showNotification?.(NOTIFICATIONS.project.DELETE_FAILED, 'error');
    }
  }, [projectId, showNotification, onBack]);

  // Handle duplicate (placeholder - would need API support)
  const handleDuplicate = useCallback(() => {
    showNotification?.(NOTIFICATIONS.project.DUPLICATE_COMING_SOON, 'info');
  }, [showNotification]);

  // Handle generate documents (placeholder)
  const handleGenerateDocuments = useCallback(() => {
    showNotification?.(NOTIFICATIONS.project.DOCS_COMING_SOON, 'info');
  }, [showNotification]);

  // Loading state
  if (isLoading && !project) {
    return <LoadingState message="Loading project..." />;
  }

  // Error state
  if (error && !project) {
    return (
      <ErrorState
        message={error}
        type="general"
        retryLabel="Retry"
        onRetry={refetch}
      />
    );
  }

  // No project found
  if (!project) {
    return (
      <div className="portal-card">
        <EmptyState
          icon={<FolderKanban className="icon-lg" />}
          message="Project not found."
          ctaLabel="Go Back"
          onCtaClick={onBack}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="section">
      {/* Header */}
      <div className="detail-title-row">
        <div className="detail-title-group">
          {/* Project Info */}
          <div className="detail-info">
            <div className="detail-name-row">
              <h1 className="detail-title">
                {project.project_name || 'Untitled Project'}
              </h1>
              <PortalDropdown>
                <PortalDropdownTrigger asChild>
                  <button className="status-dropdown-trigger" aria-label="Change project status">
                    <StatusBadge status={getStatusVariant(project.status)}>
                      {PROJECT_STATUS_CONFIG[project.status]?.label || project.status}
                    </StatusBadge>
                    <ChevronDown className="status-dropdown-caret" />
                  </button>
                </PortalDropdownTrigger>
                <PortalDropdownContent>
                  {Object.entries(PROJECT_STATUS_CONFIG)
                    .filter(([status]) => status !== project.status)
                    .map(([status, config]) => (
                      <PortalDropdownItem
                        key={status}
                        onClick={() => handleStatusChange(status as ProjectStatus)}
                      >
                        <StatusBadge status={getStatusVariant(status)}>
                          {config.label}
                        </StatusBadge>
                      </PortalDropdownItem>
                    ))}
                </PortalDropdownContent>
              </PortalDropdown>
            </div>

            <div className="detail-meta">
              {project.client_name && (
                <span className="meta-item">
                  <span className="field-label">Client:</span> <span className="meta-value">{project.client_name}</span>
                </span>
              )}
              {project.project_type && (
                <span className="meta-item">
                  <span className="field-label">Type:</span> <span className="meta-value">{PROJECT_TYPE_LABELS[project.project_type] || project.project_type}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="detail-actions">
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />

          <button
            className="icon-btn"
            onClick={() => onEdit?.(projectId)}
            title="Edit Project"
            aria-label="Edit Project"
          >
            <Pencil className="icon-md" />
          </button>

          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="icon-btn" aria-label="More actions">
                <MoreHorizontal className="icon-lg" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent align="end">
              <PortalDropdownItem onClick={() => onEdit?.(projectId)}>
                <Pencil className="icon-sm" />
                Edit Project
              </PortalDropdownItem>
              <PortalDropdownItem onClick={handleDuplicate}>
                <Copy className="icon-sm" />
                Duplicate Project
              </PortalDropdownItem>
              <PortalDropdownItem onClick={archiveDialog.open}>
                <Archive className="icon-sm" />
                Archive Project
              </PortalDropdownItem>
              <PortalDropdownItem onClick={handleGenerateDocuments}>
                <FileText className="icon-sm" />
                Generate Documents
              </PortalDropdownItem>
              <PortalDropdownSeparator />
              <PortalDropdownItem
                onClick={deleteDialog.open}
                className="danger"
              >
                <Trash2 className="icon-sm" />
                Delete Project
              </PortalDropdownItem>
            </PortalDropdownContent>
          </PortalDropdown>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-field">
        <div className="progress-field-header">
          <span className="field-label">Progress</span>
          <span className="text-muted">{progress}%</span>
        </div>
        <div className="progress-bar-sm">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <TabList
        tabs={TABS}
        tabIcons={TAB_ICONS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ariaLabel="Project detail tabs"
      />

      {/* Tab Content */}
      <TabPanel tabId="overview" isActive={activeTab === 'overview'}>
        <OverviewTab
          project={project}
          milestones={milestones}
          progress={progress}
          outstandingBalance={outstandingBalance}
          totalPaid={totalPaid}
          onUpdateProject={updateProject}
          onAddMilestone={addMilestone}
          onUpdateMilestone={updateMilestone}
          onToggleMilestone={toggleMilestoneComplete}
          onDeleteMilestone={deleteMilestone}
          onNavigate={onNavigate}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="files" isActive={activeTab === 'files'}>
        <FilesTab
          files={files}
          onUploadFile={uploadFile}
          onDeleteFile={deleteFile}
          onToggleSharing={toggleFileSharing}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="deliverables" isActive={activeTab === 'deliverables'}>
        <DeliverablesTab
          milestones={milestones}
          tasks={tasks}
          progress={progress}
          onToggleTaskComplete={toggleTaskComplete}
          onAssignTaskToMilestone={assignTaskToMilestone}
          onAddMilestone={addMilestone}
          onUpdateMilestone={updateMilestone}
          onDeleteMilestone={deleteMilestone}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="messages" isActive={activeTab === 'messages'}>
        <MessagesTab
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onLoadMessages={loadMessages}
          onEditMessage={editMessage}
          reactions={reactions}
          onToggleReaction={toggleReaction}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="invoices" isActive={activeTab === 'invoices'}>
        <InvoicesTab
          invoices={invoices}
          onViewInvoice={onNavigate ? (invoiceId) => onNavigate('invoice-detail', String(invoiceId)) : undefined}
          showNotification={showNotification}
        />
      </TabPanel>


      <TabPanel tabId="contract" isActive={activeTab === 'contract'}>
        <ContractTab
          project={project}
          files={files}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="notes" isActive={activeTab === 'notes'}>
        <NotesTab
          project={project}
          onUpdateProject={updateProject}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="intake" isActive={activeTab === 'intake'}>
        <IntakeTab
          project={project}
          onUpdateProject={updateProject}
          showNotification={showNotification}
        />
      </TabPanel>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialog.isOpen}
        onOpenChange={archiveDialog.setIsOpen}
        title="Archive Project"
        description="Are you sure you want to archive this project? You can restore it later."
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={handleArchive}
        variant="warning"
        loading={archiveDialog.isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
