import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Package,
  MessageSquare,
  Receipt,
  CheckSquare,
  FileSignature,
  StickyNote,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  FileText,
  Trash2,
  RefreshCw,
  FolderKanban
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { IconButton, TabList, TabPanel } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import { TasksTab } from './tabs/TasksTab';
import { ContractTab } from './tabs/ContractTab';
import { NotesTab } from './tabs/NotesTab';
import type { ProjectDetailTab, ProjectStatus } from '../types';
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '../types';
import { buildEndpoint } from '../../../../constants/api-endpoints';

interface ProjectDetailProps {
  /** Project ID to display */
  projectId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to projects list */
  onBack?: () => void;
  /** Callback to edit project */
  onEdit?: (projectId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Tab icon components mapping
const TAB_ICONS: Record<ProjectDetailTab, React.ElementType> = {
  overview: LayoutDashboard,
  files: FolderOpen,
  deliverables: Package,
  messages: MessageSquare,
  invoices: Receipt,
  tasks: CheckSquare,
  contract: FileSignature,
  notes: StickyNote
};

// Tab configuration
const TABS: Array<{ id: ProjectDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'messages', label: 'Messages' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'contract', label: 'Contract' },
  { id: 'notes', label: 'Notes' }
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
  showNotification
}: ProjectDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('overview');

  // Project data
  const {
    project,
    milestones,
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
    uploadFile,
    deleteFile,
    toggleFileSharing,
    loadMessages,
    sendMessage
  } = useProjectDetail({ projectId, getAuthToken });

  // Dialogs
  const deleteDialog = useConfirmDialog();
  const archiveDialog = useConfirmDialog();

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: ProjectStatus) => {
      const success = await updateProject({ status: newStatus });
      if (success) {
        showNotification?.(`Status updated to ${PROJECT_STATUS_CONFIG[newStatus].label}`, 'success');
      } else {
        showNotification?.('Failed to update status', 'error');
      }
    },
    [updateProject, showNotification]
  );

  // Handle archive
  const handleArchive = useCallback(async () => {
    const success = await updateProject({ status: 'cancelled' });
    if (success) {
      showNotification?.('Project archived', 'success');
      onBack?.();
    } else {
      showNotification?.('Failed to archive project', 'error');
    }
  }, [updateProject, showNotification, onBack]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(buildEndpoint.project(projectId), {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        showNotification?.('Project deleted', 'success');
        onBack?.();
      } else {
        showNotification?.('Failed to delete project', 'error');
      }
    } catch {
      showNotification?.('Failed to delete project', 'error');
    }
  }, [projectId, getAuthToken, showNotification, onBack]);

  // Handle duplicate (placeholder - would need API support)
  const handleDuplicate = useCallback(() => {
    showNotification?.('Duplicate feature coming soon', 'info');
  }, [showNotification]);

  // Handle generate documents (placeholder)
  const handleGenerateDocuments = useCallback(() => {
    showNotification?.('Document generation coming soon', 'info');
  }, [showNotification]);

  // Loading state
  if (isLoading && !project) {
    return (
      <div className="loading-state">
        <span className="loading-spinner" />
        <span>Loading project...</span>
      </div>
    );
  }

  // Error state
  if (error && !project) {
    return (
      <div className="tw-section tw-border tw-border-portal">
        <div className="error-state">
          <p>{error}</p>
          <button className="btn-secondary" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No project found
  if (!project) {
    return (
      <div className="tw-section tw-border tw-border-portal">
        <div className="empty-state">
          <FolderKanban className="icon-xl" />
          <span>Project not found</span>
          <button className="btn-secondary" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-flex tw-items-center tw-gap-3">
          {/* Back Button */}
          <IconButton action="back" onClick={onBack} title="Back to projects" />

          {/* Project Info */}
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <div className="tw-flex tw-items-center tw-gap-2">
              <h1 className="tw-heading tw-text-lg tw-m-0">
                {project.project_name || 'Untitled Project'}
              </h1>
              <PortalDropdown>
                <PortalDropdownTrigger asChild>
                  <button className="tw-bg-transparent tw-border-none tw-cursor-pointer tw-p-0">
                    <span className="tw-badge">
                      {PROJECT_STATUS_CONFIG[project.status]?.label || project.status}
                    </span>
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
                        <span className="tw-badge">{config.label}</span>
                      </PortalDropdownItem>
                    ))}
                </PortalDropdownContent>
              </PortalDropdown>
            </div>

            <div className="tw-flex tw-items-center tw-gap-3 tw-text-muted tw-text-xs">
              {project.client_name && (
                <span>
                  Client: <span className="tw-text-primary">{project.client_name}</span>
                </span>
              )}
              {project.project_type && (
                <span>
                  Type: <span className="tw-text-primary">{PROJECT_TYPE_LABELS[project.project_type] || project.project_type}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="tw-flex tw-items-center tw-gap-2">
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />

          <button
            className="btn-secondary"
            onClick={() => onEdit?.(projectId)}
          >
            <Pencil className="icon-md" />
            Edit
          </button>

          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="btn-icon">
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
                className="tw-text-[var(--status-cancelled)]"
              >
                <Trash2 className="icon-sm" />
                Delete Project
              </PortalDropdownItem>
            </PortalDropdownContent>
          </PortalDropdown>
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
          onToggleMilestone={toggleMilestoneComplete}
          onDeleteMilestone={deleteMilestone}
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
          progress={progress}
        />
      </TabPanel>

      <TabPanel tabId="messages" isActive={activeTab === 'messages'}>
        <MessagesTab
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onLoadMessages={loadMessages}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="invoices" isActive={activeTab === 'invoices'}>
        <InvoicesTab
          invoices={invoices}
          projectId={projectId}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="tasks" isActive={activeTab === 'tasks'}>
        <TasksTab
          milestones={milestones}
          progress={progress}
          onAddMilestone={addMilestone}
          onUpdateMilestone={updateMilestone}
          onDeleteMilestone={deleteMilestone}
          onToggleMilestone={toggleMilestoneComplete}
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
